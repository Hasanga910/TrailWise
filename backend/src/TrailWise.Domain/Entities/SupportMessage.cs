namespace TrailWise.Domain.Entities;

public class SupportMessage : BaseEntity
{
    public Guid SupportTicketId { get; set; }
    public SupportTicket SupportTicket { get; set; } = null!;

    public Guid SenderId { get; set; }
    public User Sender { get; set; } = null!;

    public string Message { get; set; } = string.Empty;
}
