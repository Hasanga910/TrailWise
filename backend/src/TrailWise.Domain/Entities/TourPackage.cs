namespace TrailWise.Domain.Entities;

public class TourPackage : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Theme { get; set; } = string.Empty;
    public int DurationDays { get; set; }
    public decimal BasePricePerPerson { get; set; }
    public int MaxGroupSize { get; set; }
    public string? PhotoUrl { get; set; }

    public ICollection<PackageTier> PackageTiers { get; set; } = new List<PackageTier>();
    public ICollection<PackageLocation> Locations { get; set; } = new List<PackageLocation>();
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
