using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class OperationsReportService : IOperationsReportService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<OperationsReportService> _logger;

    public OperationsReportService(TrailWiseDbContext db, ILogger<OperationsReportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    // This implementation uses average confirmed group size versus package maximum capacity
    // because the project currently has no per-departure capacity entity.
    public async Task<IReadOnlyList<PackageOccupancyResult>> GetOccupancyReportAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct = default)
    {
        var packages = await _db.TourPackages
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        var matchingBookings = await _db.Bookings
            .AsNoTracking()
            .Where(b => (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Completed) &&
                        b.StartDate <= to && b.EndDate >= from)
            .ToListAsync(ct);

        var bookingsByPackage = matchingBookings
            .GroupBy(b => b.TourPackageId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var results = new List<PackageOccupancyResult>();

        foreach (var package in packages)
        {
            var packageBookings = bookingsByPackage.TryGetValue(package.Id, out var list)
                ? list
                : new List<Booking>();

            var bookingCount = packageBookings.Count;
            var bookedTravelers = packageBookings.Sum(b => b.GroupSize);
            var averageGroupSize = bookingCount > 0
                ? Math.Round((double)bookedTravelers / bookingCount, 2)
                : 0.0;

            var occupancyPercentage = package.MaxGroupSize > 0
                ? Math.Min(100.0, Math.Round((averageGroupSize / package.MaxGroupSize) * 100.0, 2))
                : 0.0;

            results.Add(new PackageOccupancyResult(
                package.Id,
                package.Name,
                package.MaxGroupSize,
                bookingCount,
                bookedTravelers,
                averageGroupSize,
                occupancyPercentage
            ));
        }

        _logger.LogInformation(
            "Computed occupancy report for {PackageCount} packages between {From} and {To}",
            results.Count, from, to);

        return results;
    }

    public async Task<RevenueReportResult> GetRevenueReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct = default)
    {
        var query = _db.Payments
            .AsNoTracking()
            .Include(p => p.Booking)
                .ThenInclude(b => b.TourPackage)
            .Where(p => (p.Status == PaymentStatus.DepositPaid || p.Status == PaymentStatus.FullyPaid) &&
                        p.PaidAt != null);

        if (from.HasValue)
        {
            var fromUtc = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(p => p.PaidAt >= fromUtc);
        }

        if (to.HasValue)
        {
            var toExclusiveUtc = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(p => p.PaidAt < toExclusiveUtc);
        }

        var payments = await query.ToListAsync(ct);

        var totalRevenue = payments.Sum(p => p.Amount);

        var byPackage = payments
            .Where(p => p.Booking?.TourPackage != null)
            .GroupBy(p => new { p.Booking.TourPackageId, p.Booking.TourPackage.Name })
            .Select(g => new PackageRevenueResult(
                g.Key.TourPackageId,
                g.Key.Name,
                g.Sum(p => p.Amount)))
            .OrderByDescending(p => p.Revenue)
            .ToList();

        var byMonth = payments
            .Where(p => p.PaidAt.HasValue)
            .GroupBy(p => new { p.PaidAt!.Value.Year, p.PaidAt!.Value.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new MonthlyRevenueResult(
                g.Key.Year,
                g.Key.Month,
                new DateTime(g.Key.Year, g.Key.Month, 1, 0, 0, 0, DateTimeKind.Utc).ToString("MMM yyyy", CultureInfo.InvariantCulture),
                g.Sum(p => p.Amount)))
            .ToList();

        _logger.LogInformation(
            "Computed revenue report: TotalRevenue={TotalRevenue}, Packages={PackageCount}, Months={MonthCount}",
            totalRevenue, byPackage.Count, byMonth.Count);

        return new RevenueReportResult(totalRevenue, byPackage, byMonth);
    }

    // Utilization is based only on recorded GuideAvailability rows because
    // Person 2's reservation flow does not yet populate every calendar day.
    public async Task<IReadOnlyList<GuideUtilizationResult>> GetGuideUtilizationReportAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct = default)
    {
        var guides = await _db.Guides
            .AsNoTracking()
            .OrderBy(g => g.Name)
            .ToListAsync(ct);

        var availabilityQuery = _db.GuideAvailabilities.AsNoTracking();

        if (from.HasValue)
        {
            availabilityQuery = availabilityQuery.Where(a => a.Date >= from.Value);
        }

        if (to.HasValue)
        {
            availabilityQuery = availabilityQuery.Where(a => a.Date <= to.Value);
        }

        var availabilities = await availabilityQuery.ToListAsync(ct);

        var availabilitiesByGuide = availabilities
            .GroupBy(a => a.GuideId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var results = new List<GuideUtilizationResult>();

        foreach (var guide in guides)
        {
            var rows = availabilitiesByGuide.TryGetValue(guide.Id, out var list)
                ? list
                : new List<GuideAvailability>();

            var assignedDays = rows.Count(a => a.AssignedBookingId != null);
            var availableDays = rows.Count(a => a.IsAvailable && a.AssignedBookingId == null);
            var recordedDays = assignedDays + availableDays;

            var utilizationPercentage = recordedDays > 0
                ? Math.Round(((double)assignedDays / recordedDays) * 100.0, 2)
                : 0.0;

            results.Add(new GuideUtilizationResult(
                guide.Id,
                guide.Name,
                assignedDays,
                availableDays,
                recordedDays,
                utilizationPercentage
            ));
        }

        _logger.LogInformation(
            "Computed guide utilization report for {GuideCount} guides",
            results.Count);

        return results;
    }
}
