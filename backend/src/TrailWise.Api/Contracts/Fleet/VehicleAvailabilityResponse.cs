namespace TrailWise.Api.Contracts.Fleet;

public record VehicleAvailabilityResponse(
    Guid VehicleId,
    DateOnly From,
    DateOnly To,
    bool IsAvailable,
    string? Reason = null);
