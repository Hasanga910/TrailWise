using System.ComponentModel.DataAnnotations;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Fleet;

public class CreateVehicleRequest
{
    [Required]
    public VehicleType Type { get; set; }

    [Range(1, 100)]
    public int Capacity { get; set; }

    public bool HasAC { get; set; }

    [MaxLength(50)]
    public string SeatConfiguration { get; set; } = string.Empty;

    public VehicleMaintenanceStatus MaintenanceStatus { get; set; } = VehicleMaintenanceStatus.Available;
}
