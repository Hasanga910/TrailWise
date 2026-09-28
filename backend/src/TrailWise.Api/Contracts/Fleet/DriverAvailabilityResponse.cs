namespace TrailWise.Api.Contracts.Fleet;

public record DriverAvailabilityResponse(
    Guid DriverId,
    DateOnly From,
    DateOnly To,
    bool IsAvailable,
    string? Reason = null);
