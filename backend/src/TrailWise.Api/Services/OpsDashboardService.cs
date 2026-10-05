using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Api.Contracts.Reports;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Services;

public class OpsDashboardService
{
    private const int UpcomingTourLimit = 10;
    private const int UtilizationWindowDays = 30;

    private readonly TrailWiseDbContext _db;
    private readonly IOperationsReportService _reports;
    private readonly IClock _clock;

    public OpsDashboardService(TrailWiseDbContext db, IOperationsReportService reports, IClock clock)
    {
        _db = db;
        _reports = reports;
        _clock = clock;
    }

    public async Task<OpsDashboardDto> GetAsync(CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var windowEnd = today.AddDays(UtilizationWindowDays - 1);
        var window = new UtilizationWindowDto(today, windowEnd, UtilizationWindowDays);

        return new OpsDashboardDto(
            now,
            await UpcomingToursAsync(today, ct),
            await ApprovalsAsync(today, ct),
            await GuideUtilizationAsync(window, ct),
            await VehicleUtilizationAsync(window, ct),
            await WorkflowsAsync(ct));
    }

    private async Task<List<UpcomingTourDto>> UpcomingToursAsync(DateOnly today, CancellationToken ct)
    {
        var bookings = await _db.Bookings
            .AsNoTracking()
            .Where(b => b.Status == BookingStatus.Confirmed && b.StartDate >= today)
            .OrderBy(b => b.StartDate).ThenBy(b => b.Id)
            .Take(UpcomingTourLimit)
            .Select(b => new
            {
                b.Id,
                PackageName = b.TourPackage.Name,
                TravelerName = b.Traveler.Name,
                b.StartDate,
                b.EndDate,
                b.GroupSize,
                GuideName = b.GuideAvailabilities
                    .Where(g => g.AssignedBookingId == b.Id)
                    .Select(g => g.Guide.Name)
                    .FirstOrDefault(),
                Vehicle = b.VehicleAssignments
                    .Select(a => new { a.Vehicle.RegistrationNumber, DriverName = a.Driver.Name })
                    .FirstOrDefault()
            })
            .ToListAsync(ct);

        return bookings.Select(b => new UpcomingTourDto(
            b.Id,
            b.PackageName,
            b.TravelerName,
            b.StartDate,
            b.EndDate,
            b.GroupSize,
            CancellationPolicy.DaysUntilStart(today, b.StartDate),
            b.GuideName,
            b.Vehicle?.RegistrationNumber,
            b.Vehicle?.DriverName)).ToList();
    }

    private async Task<DashboardApprovalsDto> ApprovalsAsync(DateOnly today, CancellationToken ct)
    {
        var typeCounts = await _db.ApprovalRequests
            .AsNoTracking()
            .Where(a => a.Status == ApprovalStatus.Pending)
            .GroupBy(a => a.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int CountOf(ApprovalType t) => typeCounts.FirstOrDefault(c => c.Type == t)?.Count ?? 0;
        var counts = new ApprovalCountsDto(
            CountOf(ApprovalType.LargeGroupOrCustomItinerary),
            CountOf(ApprovalType.BudgetOverride),
            CountOf(ApprovalType.RefundException),
            typeCounts.Sum(c => c.Count));

        var refunds = await _db.ApprovalRequests
            .AsNoTracking()
            .Where(a => a.Status == ApprovalStatus.Pending && a.Type == ApprovalType.RefundException)
            .Select(a => new
            {
                a.Id,
                a.BookingId,
                PackageName = a.Booking.TourPackage.Name,
                TravelerName = a.Booking.Traveler.Name,
                a.Booking.StartDate,
                a.RequestedAt
            })
            .ToListAsync(ct);

        var items = refunds
            .Select(r =>
            {
                var days = CancellationPolicy.DaysUntilStart(today, r.StartDate);
                return new DashboardRefundExceptionDto(
                    r.Id, r.BookingId, r.PackageName, r.TravelerName, r.StartDate, days,
                    CancellationPolicy.IsUrgent(days), r.RequestedAt);
            })
            .OrderBy(i => i.StartDate).ThenBy(i => i.RequestedAt)
            .ToList();

        return new DashboardApprovalsDto(
            counts,
            CancellationPolicy.UrgentRefundExceptionDays,
            items.Count(i => i.Urgent),
            items);
    }

    private async Task<GuideUtilizationSummaryDto> GuideUtilizationAsync(UtilizationWindowDto window, CancellationToken ct)
    {
        var guides = await _reports.GetGuideUtilizationReportAsync(window.From, window.To, ct);
        var recorded = guides.Sum(g => g.RecordedDays);
        var overall = recorded > 0 ? Math.Round((double)guides.Sum(g => g.AssignedDays) / recorded * 100.0, 2) : 0.0;

        return new GuideUtilizationSummaryDto(
            window,
            overall,
            guides.Select(g => new GuideUtilizationDto(
                g.GuideId, g.GuideName, g.AssignedDays, g.AvailableDays, g.RecordedDays, g.UtilizationPercentage)).ToList());
    }

    private async Task<VehicleUtilizationSummaryDto> VehicleUtilizationAsync(UtilizationWindowDto window, CancellationToken ct)
    {
        var vehicles = await _reports.GetVehicleUtilizationReportAsync(window.From, window.To, ct);
        var inService = vehicles.Where(v => v.MaintenanceStatus != VehicleMaintenanceStatus.OutOfService).ToList();
        var capacityDays = inService.Count * window.Days;
        var overall = capacityDays > 0 ? Math.Round((double)inService.Sum(v => v.BookedDays) / capacityDays * 100.0, 2) : 0.0;

        return new VehicleUtilizationSummaryDto(
            window,
            overall,
            inService.Count,
            vehicles.Select(v => new VehicleUtilizationItemDto(
                v.VehicleId, v.RegistrationNumber, v.Type, v.MaintenanceStatus, v.BookedDays, v.UtilizationPercentage)).ToList());
    }

    private async Task<DashboardWorkflowsDto> WorkflowsAsync(CancellationToken ct)
    {
        var statusCounts = await _db.AgentWorkflowRuns
            .AsNoTracking()
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int CountOf(string status) => statusCounts.FirstOrDefault(c => c.Status == status)?.Count ?? 0;

        var manualReview = await _db.Bookings.CountAsync(b => b.Status == BookingStatus.NeedsManualReview, ct);
        return new DashboardWorkflowsDto(CountOf("Running"), CountOf("AwaitingApproval"), CountOf("Failed"), manualReview);
    }
}
