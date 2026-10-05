using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Services;

/// <summary>
/// Builds the approval queue with the evidence for each item, read back from the persisted
/// AgentWorkflowRuns / AgentStepLogs (design doc 8.2 step 7).
/// </summary>
public class ApprovalQueueService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<ApprovalQueueService> _logger;

    public ApprovalQueueService(TrailWiseDbContext db, ILogger<ApprovalQueueService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PendingApprovalsDto> GetPendingAsync(ApprovalType? type, CancellationToken ct)
    {
        var pending = _db.ApprovalRequests.AsNoTracking().Where(a => a.Status == ApprovalStatus.Pending);

        var typeCounts = await pending
            .GroupBy(a => a.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int CountOf(ApprovalType t) => typeCounts.FirstOrDefault(c => c.Type == t)?.Count ?? 0;
        var counts = new ApprovalCountsDto(
            CountOf(ApprovalType.LargeGroupOrCustomItinerary),
            CountOf(ApprovalType.BudgetOverride),
            CountOf(ApprovalType.RefundException),
            typeCounts.Sum(c => c.Count));

        var query = pending
            .Include(a => a.Booking).ThenInclude(b => b.Traveler)
            .Include(a => a.Booking).ThenInclude(b => b.TourPackage)
            .Include(a => a.Booking).ThenInclude(b => b.PackageTier)
            .AsQueryable();
        if (type is not null)
        {
            query = query.Where(a => a.Type == type);
        }

        var requests = await query.OrderBy(a => a.RequestedAt).ToListAsync(ct);
        var items = new List<ApprovalItemDto>(requests.Count);
        foreach (var request in requests)
        {
            items.Add(await ToItemAsync(request, ct));
        }

        return new PendingApprovalsDto(counts, items);
    }

    private async Task<ApprovalItemDto> ToItemAsync(ApprovalRequest request, CancellationToken ct)
    {
        var booking = request.Booking;
        var run = await _db.AgentWorkflowRuns
            .AsNoTracking()
            .Include(r => r.StepLogs)
            .Where(r => r.BookingId == booking.Id)
            .OrderByDescending(r => r.StartedAt)
            .FirstOrDefaultAsync(ct);

        var logs = run?.StepLogs.OrderBy(s => s.CreatedAt).ToList() ?? new List<AgentStepLog>();

        var guideResult = ReadLog<GuideMatchResult>(logs.LastOrDefault(s => s.AgentName == "GuideMatchingAgent"));
        var vehicleResult = ReadLog<VehicleMatchResult>(logs.LastOrDefault(s => s.AgentName == "FleetCapacityAgent"));
        // The pricing agent writes two logs: the quotation (no ValidationResult) and the validation.
        var pricingResult = ReadLog<PricingResult>(
            logs.LastOrDefault(s => s.AgentName == "PricingValidationAgent" && s.ValidationResult is null));
        var validation = ReadLog<ValidationLogOutput>(
            logs.LastOrDefault(s => s.AgentName == "PricingValidationAgent" && s.ValidationResult is not null));
        var summary = ReadLog<ProposalSummary>(logs.LastOrDefault(s => s.AgentName == "ProposalSummaryAgent"));

        GuideEvidenceDto? guide = null;
        if (guideResult is not null)
        {
            var guideId = guideResult.GuideId == Guid.Empty ? (Guid?)null : guideResult.GuideId;
            var guideName = guideId is null
                ? null
                : await _db.Guides.AsNoTracking().Where(g => g.Id == guideId).Select(g => g.Name).FirstOrDefaultAsync(ct);
            guide = new GuideEvidenceDto(guideId, guideName, guideResult.MatchScore, guideResult.Reasoning);
        }

        VehicleEvidenceDto? vehicle = null;
        if (vehicleResult is not null)
        {
            var vehicleId = vehicleResult.VehicleId == Guid.Empty ? (Guid?)null : vehicleResult.VehicleId;
            var driverId = vehicleResult.DriverId == Guid.Empty ? (Guid?)null : vehicleResult.DriverId;
            var vehicleRow = vehicleId is null
                ? null
                : await _db.Vehicles.AsNoTracking().FirstOrDefaultAsync(v => v.Id == vehicleId, ct);
            var driverName = driverId is null
                ? null
                : await _db.Drivers.AsNoTracking().Where(d => d.Id == driverId).Select(d => d.Name).FirstOrDefaultAsync(ct);
            vehicle = new VehicleEvidenceDto(
                vehicleId,
                vehicleRow?.RegistrationNumber,
                vehicleRow?.Type,
                vehicleRow?.Capacity,
                vehicleRow?.HasAC,
                vehicleRow?.SeatConfiguration,
                driverId,
                driverName,
                vehicleResult.AcMatch,
                vehicleResult.SeatConfigMatch,
                vehicleResult.ConflictCheck);
        }

        PricingEvidenceDto? pricing = null;
        if (pricingResult is not null)
        {
            var totalBudget = booking.BudgetPerPerson * booking.GroupSize;
            pricing = new PricingEvidenceDto(
                pricingResult.TotalCost,
                pricingResult.Breakdown,
                pricingResult.ValidationResult,
                totalBudget,
                totalBudget * BookingApprovalEvaluator.BudgetMarginMultiplier);
        }

        var reasons = ParseReasons(request.ReasonsJson);
        var validationEvidence = validation is null
            ? null
            : new ValidationEvidenceDto(validation.Decision ?? "Unknown", validation.Reasons ?? new List<string>());

        return new ApprovalItemDto(
            request.Id,
            request.Type,
            request.Status,
            booking.Id,
            request.RequestedAt,
            reasons,
            new ApprovalBookingDto(
                booking.Traveler.Name,
                booking.TourPackage.Name,
                booking.PackageTier.ClassType,
                booking.PackageTier.IncludesFood,
                booking.PackageTier.RequiresAC,
                booking.GroupSize,
                booking.StartDate,
                booking.EndDate,
                booking.BudgetPerPerson,
                booking.SpecialRequests,
                booking.LanguagePreference),
            new ApprovalEvidenceDto(
                guide,
                vehicle,
                pricing,
                validationEvidence,
                run?.SummaryText,
                summary?.AdvisoryFlags ?? new List<string>()),
            run?.Id);
    }

    private T? ReadLog<T>(AgentStepLog? log) where T : class
    {
        if (log is null || string.IsNullOrWhiteSpace(log.OutputJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(log.OutputJson, AgentJsonOptions.Default);
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Could not read {Agent} step log {LogId} as {Type}.", log.AgentName, log.Id, typeof(T).Name);
            return null;
        }
    }

    private static List<string> ParseReasons(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, AgentJsonOptions.Default) ?? new List<string>();
        }
        catch (JsonException)
        {
            return new List<string>();
        }
    }

    private sealed record ValidationLogOutput(string? Decision, List<string>? Reasons);
}
