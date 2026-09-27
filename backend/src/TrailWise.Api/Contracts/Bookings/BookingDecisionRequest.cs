using System.ComponentModel.DataAnnotations;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Bookings;

public class BookingDecisionRequest
{
    [Required]
    public BookingDecision Decision { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}
