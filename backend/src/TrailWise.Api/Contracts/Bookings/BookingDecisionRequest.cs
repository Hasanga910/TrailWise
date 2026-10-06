using System.ComponentModel.DataAnnotations;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Bookings;

public class BookingDecisionRequest
{
    [Required]
    public BookingDecision Decision { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public Guid? VehicleId { get; set; }

    public Guid? DriverId { get; set; }

    public Guid? GuideId { get; set; }
}
