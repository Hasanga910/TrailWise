using TrailWise.Domain.Enums;

namespace TrailWise.Domain.Entities;

public class SupportTicket : BaseEntity
{
    public Guid TravelerId { get; set; }
    public User Traveler { get; set; } = null!;

    public Guid? BookingId { get; set; }
    public Booking? Booking { get; set; }

    public TicketCategory Category { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public TicketPriority Priority { get; set; } = TicketPriority.Normal;
    public TicketStatus Status { get; set; } = TicketStatus.Open;

    public Guid? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }

    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }

    public ICollection<SupportMessage> Messages { get; set; } = new List<SupportMessage>();
}
