using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Fleet;

public record VehicleAssignmentDetailDto(
    Guid Id,
    Guid VehicleId,
    string VehicleName,
    Guid BookingId,
    Guid DriverId,
    string DriverName,
    string DriverContact,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    VehicleType? VehicleType = null,
    int? Capacity = null,
    bool? HasAC = null,
    string? RegistrationNumber = null,
    BookingStatus? BookingStatus = null,
    string? TravelerName = null,
    string? TravelerContact = null,
    string? PackageName = null,
    string? PackageTier = null,
    IReadOnlyList<string>? ItineraryHighlights = null,
    string? DriverLicenseNumber = null,
    string? GuideName = null,
    string? GuideContact = null,
    int? GroupSize = null,
    string? SpecialRequests = null,
    string? LanguagePreference = null);
