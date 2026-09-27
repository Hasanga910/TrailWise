using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Fleet;

public record VehicleAssignmentDto(
    Guid Id,
    Guid VehicleId,
    Guid BookingId,
    Guid DriverId,
    DateOnly StartDate,
    DateOnly EndDate,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static VehicleAssignmentDto FromEntity(VehicleAssignment assignment) => new(
        assignment.Id,
        assignment.VehicleId,
        assignment.BookingId,
        assignment.DriverId,
        assignment.StartDate,
        assignment.EndDate,
        assignment.CreatedAt,
        assignment.UpdatedAt);
}
