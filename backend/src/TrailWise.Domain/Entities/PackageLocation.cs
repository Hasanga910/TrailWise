namespace TrailWise.Domain.Entities;

public class PackageLocation : BaseEntity
{
    public Guid TourPackageId { get; set; }
    public TourPackage TourPackage { get; set; } = null!;

    public string Name { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
}
