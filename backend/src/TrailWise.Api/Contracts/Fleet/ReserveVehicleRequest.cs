using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Fleet;

public class ReserveVehicleRequest
{
    [Required]
    public Guid BookingId { get; set; }

    [Required]
    public Guid DriverId { get; set; }

    [Required]
    public DateOnly StartDate { get; set; }

    [Required]
    public DateOnly EndDate { get; set; }
}
