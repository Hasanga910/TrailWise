using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;

namespace TrailWise.Infrastructure.Services;

public class SupportTicketResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public SupportTicket? Ticket { get; init; }

    public static SupportTicketResult Success(SupportTicket ticket, int statusCode = 200) => new()
    {
        Succeeded = true,
        Ticket = ticket,
        StatusCode = statusCode
    };

    public static SupportTicketResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class SupportMessageResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public SupportMessage? Message { get; init; }

    public static SupportMessageResult Success(SupportMessage message, int statusCode = 200) => new()
    {
        Succeeded = true,
        Message = message,
        StatusCode = statusCode
    };

    public static SupportMessageResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class PagedTicketsResult
{
    public IReadOnlyList<SupportTicket> Items { get; init; } = Array.Empty<SupportTicket>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }

    public PagedTicketsResult(IReadOnlyList<SupportTicket> items, int totalCount, int page, int pageSize)
    {
        Items = items;
        TotalCount = totalCount;
        Page = page;
        PageSize = pageSize;
    }
}

public interface ISupportService
{
    Task<SupportTicketResult> CreateTicketAsync(
        Guid travelerId,
        Guid? bookingId,
        TicketCategory category,
        string subject,
        string description,
        TicketPriority? priority = null,
        CancellationToken ct = default);

    Task<PagedTicketsResult> GetMyTicketsAsync(
        Guid travelerId,
        TicketStatus? status = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<SupportTicketResult> GetTicketByIdAsync(
        Guid ticketId,
        Guid userId,
        bool isStaff,
        CancellationToken ct = default);

    Task<SupportMessageResult> AddTravelerMessageAsync(
        Guid ticketId,
        Guid travelerId,
        string message,
        CancellationToken ct = default);

    Task<PagedTicketsResult> GetStaffTicketsAsync(
        TicketStatus? status = null,
        TicketCategory? category = null,
        TicketPriority? priority = null,
        Guid? assignedToId = null,
        string? search = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<SupportMessageResult> AddStaffMessageAsync(
        Guid ticketId,
        Guid staffId,
        string message,
        CancellationToken ct = default);

    Task<SupportTicketResult> UpdateStatusAsync(
        Guid ticketId,
        Guid staffId,
        TicketStatus newStatus,
        CancellationToken ct = default);

    Task<SupportTicketResult> AssignTicketAsync(
        Guid ticketId,
        Guid staffId,
        Guid? assignedToId,
        CancellationToken ct = default);

    Task<SupportTicketResult> UpdatePriorityAsync(
        Guid ticketId,
        Guid staffId,
        TicketPriority newPriority,
        CancellationToken ct = default);
}
