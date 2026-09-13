using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class Vehicle : BaseEntity
{
    public VehicleType Type { get; set; }
    public int Capacity { get; set; }
    public bool HasAC { get; set; }
    public string SeatConfiguration { get; set; } = string.Empty;
    public VehicleMaintenanceStatus MaintenanceStatus { get; set; } = VehicleMaintenanceStatus.Available;

    public ICollection<VehicleAssignment> Assignments { get; set; } = new List<VehicleAssignment>();
}
