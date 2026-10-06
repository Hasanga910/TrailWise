using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Bookings;

public class ReassignResourcesRequest
{
    public Guid? VehicleId { get; set; }

    public Guid? DriverId { get; set; }

    public Guid? GuideId { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }
}
