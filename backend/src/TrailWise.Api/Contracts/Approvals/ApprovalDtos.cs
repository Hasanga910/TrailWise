using System.ComponentModel.DataAnnotations;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Approvals;

public record ApprovalCountsDto(int LargeGroupOrCustomItinerary, int BudgetOverride, int RefundException, int Total);

public record PendingApprovalsDto(ApprovalCountsDto Counts, List<ApprovalItemDto> Items);

public record ApprovalItemDto(
    Guid Id,
    ApprovalType Type,
    ApprovalStatus Status,
    Guid BookingId,
    DateTimeOffset RequestedAt,
    List<string> Reasons,
    ApprovalBookingDto Booking,
    ApprovalEvidenceDto Evidence,
    Guid? WorkflowRunId);

public record ApprovalBookingDto(
    string TravelerName,
    string TourPackageName,
    ClassType ClassType,
    bool IncludesFood,
    bool RequiresAc,
    int GroupSize,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal BudgetPerPerson,
    string? SpecialRequests,
    string? LanguagePreference);

/// <summary>The evidence the Operations Manager reviews (design doc 8.2 step 7).</summary>
public record ApprovalEvidenceDto(
    GuideEvidenceDto? Guide,
    VehicleEvidenceDto? Vehicle,
    PricingEvidenceDto? Pricing,
    ValidationEvidenceDto? Validation,
    string? SummaryText,
    List<string> AdvisoryFlags);

public record GuideEvidenceDto(Guid? GuideId, string? Name, double MatchScore, string Reasoning);

public record VehicleEvidenceDto(
    Guid? VehicleId,
    string? RegistrationNumber,
    VehicleType? Type,
    int? Capacity,
    bool? HasAc,
    string? SeatConfiguration,
    Guid? DriverId,
    string? DriverName,
    bool AcMatch,
    bool SeatConfigMatch,
    bool ConflictCheck);

public record PricingEvidenceDto(
    decimal TotalCost,
    string Breakdown,
    string ValidationResult,
    decimal TotalBudget,
    decimal BudgetCeiling);

public record ValidationEvidenceDto(string Decision, List<string> Reasons);

public class ApprovalDecisionRequest
{
    [Required]
    public ApprovalDecision Decision { get; set; }

    /// <summary>Required when rejecting or requesting a revision.</summary>
    [MaxLength(500)]
    public string? Note { get; set; }
}

public record ApprovalDecidedDto(Guid Id, ApprovalStatus Status, BookingDto Booking);
