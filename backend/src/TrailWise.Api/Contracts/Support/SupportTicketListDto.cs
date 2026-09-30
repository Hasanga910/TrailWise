using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Support;

public record SupportTicketListDto(
    Guid Id,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    string Subject,
    Guid? BookingId,
    string? PackageName,
    Guid? AssignedToId,
    string? AssignedToName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static SupportTicketListDto FromEntity(SupportTicket ticket) => new(
        ticket.Id,
        ticket.Category,
        ticket.Priority,
        ticket.Status,
        ticket.Subject,
        ticket.BookingId,
        ticket.Booking?.TourPackage?.Name,
        ticket.AssignedToId,
        ticket.AssignedTo?.Name,
        ticket.CreatedAt,
        ticket.UpdatedAt);
}
