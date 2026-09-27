using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Fleet;

public record VehicleDto(
    Guid Id,
    VehicleType Type,
    int Capacity,
    bool HasAC,
    string SeatConfiguration,
    VehicleMaintenanceStatus MaintenanceStatus,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static VehicleDto FromEntity(Vehicle vehicle) => new(
        vehicle.Id,
        vehicle.Type,
        vehicle.Capacity,
        vehicle.HasAC,
        vehicle.SeatConfiguration,
        vehicle.MaintenanceStatus,
        vehicle.CreatedAt,
        vehicle.UpdatedAt);
}
