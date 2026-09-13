using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class PackageTier : BaseEntity
{
    public Guid TourPackageId { get; set; }
    public TourPackage TourPackage { get; set; } = null!;

    public ClassType ClassType { get; set; }
    public bool IncludesFood { get; set; }
    public decimal BasePricePerPerson { get; set; }
    public bool RequiresAC { get; set; }

    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
