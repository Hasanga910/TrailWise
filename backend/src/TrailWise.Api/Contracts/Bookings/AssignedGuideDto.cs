namespace TrailWise.Api.Contracts.Bookings;

public record AssignedGuideDto(
    Guid Id,
    string Name,
    string? ContactInfo,
    string[] Languages,
    string[] Specializations);
