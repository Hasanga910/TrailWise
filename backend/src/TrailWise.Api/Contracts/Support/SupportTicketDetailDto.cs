using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Support;

public record SupportTicketDetailDto(
    Guid Id,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    string Subject,
    string Description,
    Guid TravelerId,
    string TravelerDisplayName,
    Guid? BookingId,
    string? PackageName,
    Guid? AssignedToId,
    string? AssignedToName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ResolvedAt,
    DateTimeOffset? ClosedAt,
    IReadOnlyList<SupportMessageDto> Messages)
{
    public static SupportTicketDetailDto FromEntity(SupportTicket ticket) => new(
        ticket.Id,
        ticket.Category,
        ticket.Priority,
        ticket.Status,
        ticket.Subject,
        ticket.Description,
        ticket.TravelerId,
        ticket.Traveler?.Name ?? "Traveler",
        ticket.BookingId,
        ticket.Booking?.TourPackage?.Name,
        ticket.AssignedToId,
        ticket.AssignedTo?.Name,
        ticket.CreatedAt,
        ticket.UpdatedAt,
        ticket.ResolvedAt,
        ticket.ClosedAt,
        ticket.Messages.OrderBy(m => m.CreatedAt).Select(SupportMessageDto.FromEntity).ToList());
}
