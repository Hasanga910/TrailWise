using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public class ReservationResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public VehicleAssignment? Assignment { get; init; }

    public static ReservationResult Success(VehicleAssignment assignment) => new()
    {
        Succeeded = true,
        Assignment = assignment
    };

    public static ReservationResult Failure(string error) => new()
    {
        Succeeded = false,
        Error = error
    };
}

public interface IFleetReservationService
{
    Task<bool> IsVehicleAvailableAsync(Guid vehicleId, DateOnly startDate, DateOnly endDate, CancellationToken ct = default);

    Task<ReservationResult> ReserveVehicleAsync(
        Guid vehicleId,
        Guid driverId,
        Guid bookingId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken ct = default);
}
