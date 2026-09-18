using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class Booking : BaseEntity
{
    public Guid TravelerId { get; set; }
    public User Traveler { get; set; } = null!;

    public Guid TourPackageId { get; set; }
    public TourPackage TourPackage { get; set; } = null!;

    public Guid PackageTierId { get; set; }
    public PackageTier PackageTier { get; set; } = null!;

    public int GroupSize { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal BudgetPerPerson { get; set; }
    public string? SpecialRequests { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Requested;

    public ICollection<BookingAddOn> BookingAddOns { get; set; } = new List<BookingAddOn>();
    public ICollection<GuideAvailability> GuideAvailabilities { get; set; } = new List<GuideAvailability>();
    public ICollection<VehicleAssignment> VehicleAssignments { get; set; } = new List<VehicleAssignment>();
    public ICollection<ItineraryStep> ItinerarySteps { get; set; } = new List<ItineraryStep>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Review> Reviews { get; set; } = new List<Review>();
    public ICollection<AgentWorkflowRun> AgentWorkflowRuns { get; set; } = new List<AgentWorkflowRun>();
}
