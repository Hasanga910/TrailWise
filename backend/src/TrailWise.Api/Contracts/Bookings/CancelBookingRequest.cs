using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Bookings;

public class CancelBookingRequest
{
    [MaxLength(500)]
    public string? Reason { get; set; }
}
