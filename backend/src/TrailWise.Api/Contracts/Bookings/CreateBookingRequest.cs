using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Bookings;

public class CreateBookingRequest
{
    [Required]
    public Guid PackageTierId { get; set; }

    public int GroupSize { get; set; }

    public DateOnly StartDate { get; set; }

    public DateOnly EndDate { get; set; }

    public decimal BudgetPerPerson { get; set; }

    public string? SpecialRequests { get; set; }
}
