using TrailWise.Api.Contracts.Approvals;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Reports;

/// <summary>Operations dashboard (design doc section 6): upcoming tours, pending approvals, utilisation.</summary>
public record OpsDashboardDto(
    DateTimeOffset GeneratedAt,
    List<UpcomingTourDto> UpcomingTours,
    DashboardApprovalsDto Approvals,
    GuideUtilizationSummaryDto GuideUtilization,
    VehicleUtilizationSummaryDto VehicleUtilization,
    DashboardWorkflowsDto Workflows);

public record UpcomingTourDto(
    Guid BookingId,
    string TourPackageName,
    string TravelerName,
    DateOnly StartDate,
    DateOnly EndDate,
    int GroupSize,
    int DaysUntilStart,
    string? GuideName,
    string? VehicleRegistration,
    string? DriverName);

public record DashboardApprovalsDto(
    ApprovalCountsDto Counts,
    int UrgentWithinDays,
    int UrgentCount,
    List<DashboardRefundExceptionDto> RefundExceptions);

/// <summary>A pending refund exception; Urgent when the tour starts within UrgentWithinDays (or already has).</summary>
public record DashboardRefundExceptionDto(
    Guid ApprovalId,
    Guid BookingId,
    string TourPackageName,
    string TravelerName,
    DateOnly StartDate,
    int DaysUntilStart,
    bool Urgent,
    DateTimeOffset RequestedAt);

public record UtilizationWindowDto(DateOnly From, DateOnly To, int Days);

public record GuideUtilizationSummaryDto(UtilizationWindowDto Window, double OverallPercentage, List<GuideUtilizationDto> Guides);

public record VehicleUtilizationItemDto(
    Guid VehicleId,
    string RegistrationNumber,
    VehicleType Type,
    VehicleMaintenanceStatus MaintenanceStatus,
    int BookedDays,
    double UtilizationPercentage);

/// <summary>Overall percentage counts only vehicles that are not OutOfService.</summary>
public record VehicleUtilizationSummaryDto(
    UtilizationWindowDto Window,
    double OverallPercentage,
    int InServiceVehicles,
    List<VehicleUtilizationItemDto> Vehicles);

public record DashboardWorkflowsDto(int Running, int AwaitingApproval, int Failed, int BookingsNeedingManualReview);
