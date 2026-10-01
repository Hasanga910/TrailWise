namespace TrailWise.Domain.Entities;

public class Driver : BaseEntity
{
    public Guid? UserId { get; set; }
    public User? User { get; set; }

    public string Name { get; set; } = string.Empty;
    public string LicenseNumber { get; set; } = string.Empty;
    public string ContactInfo { get; set; } = string.Empty;

    public ICollection<VehicleAssignment> Assignments { get; set; } = new List<VehicleAssignment>();
}
