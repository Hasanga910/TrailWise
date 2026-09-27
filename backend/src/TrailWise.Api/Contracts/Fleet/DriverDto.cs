using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Fleet;

public record DriverDto(
    Guid Id,
    string Name,
    string LicenseNumber,
    string ContactInfo,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static DriverDto FromEntity(Driver driver) => new(
        driver.Id,
        driver.Name,
        driver.LicenseNumber,
        driver.ContactInfo,
        driver.CreatedAt,
        driver.UpdatedAt);
}
