using System.ComponentModel.DataAnnotations;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Fleet;

public class UpdateMaintenanceStatusRequest
{
    [Required]
    public VehicleMaintenanceStatus Status { get; set; }
}
