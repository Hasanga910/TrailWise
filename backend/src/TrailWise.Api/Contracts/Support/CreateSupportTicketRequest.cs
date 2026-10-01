using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Support;

public record CreateSupportTicketRequest(
    Guid? BookingId,
    TicketCategory Category,
    string Subject,
    string Description,
    TicketPriority? Priority = null);
