using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class SupportService : ISupportService
{
    private const int MinSubjectLength = 5;
    private const int MaxSubjectLength = 200;
    private const int MinMessageLength = 1;
    private const int MaxMessageLength = 4000;
    private const int MaxPageSize = 50;

    private readonly TrailWiseDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<SupportService> _logger;

    public SupportService(
        TrailWiseDbContext db,
        IAuditLogService auditLogService,
        ILogger<SupportService> logger)
    {
        _db = db;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<SupportTicketResult> CreateTicketAsync(
        Guid travelerId,
        Guid? bookingId,
        TicketCategory category,
        string subject,
        string description,
        TicketPriority? priority = null,
        CancellationToken ct = default)
    {
        var trimmedSubject = subject?.Trim() ?? string.Empty;
        if (trimmedSubject.Length < MinSubjectLength || trimmedSubject.Length > MaxSubjectLength)
        {
            return SupportTicketResult.Failure(
                $"Subject must be between {MinSubjectLength} and {MaxSubjectLength} characters.", 400);
        }

        var trimmedDescription = description?.Trim() ?? string.Empty;
        if (trimmedDescription.Length < MinMessageLength || trimmedDescription.Length > MaxMessageLength)
        {
            return SupportTicketResult.Failure(
                $"Description must be between {MinMessageLength} and {MaxMessageLength} characters.", 400);
        }

        if (priority == TicketPriority.Urgent)
        {
            return SupportTicketResult.Failure(
                "Travelers cannot set priority to Urgent.", 400);
        }

        var resolvedPriority = priority ?? TicketPriority.Normal;

        if (bookingId.HasValue)
        {
            var booking = await _db.Bookings
                .AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == bookingId.Value, ct);

            if (booking is null)
            {
                return SupportTicketResult.Failure("Booking not found.", 404);
            }

            if (booking.TravelerId != travelerId)
            {
                return SupportTicketResult.Failure(
                    "Forbidden. You can only link support tickets to your own bookings.", 403);
            }
        }

        var ticket = new SupportTicket
        {
            TravelerId = travelerId,
            BookingId = bookingId,
            Category = category,
            Subject = trimmedSubject,
            Description = trimmedDescription,
            Priority = resolvedPriority,
            Status = TicketStatus.Open,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.SupportTickets.Add(ticket);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportTicket",
                entityId: ticket.Id,
                action: "SupportTicketCreated",
                performedBy: travelerId,
                details: new
                {
                    ticket.Category,
                    ticket.BookingId,
                    ticket.Subject,
                    ticket.Priority
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        _logger.LogInformation("Support ticket {TicketId} created by traveler {TravelerId}", ticket.Id, travelerId);

        var createdTicket = await LoadTicketDetailAsync(ticket.Id, ct);
        return SupportTicketResult.Success(createdTicket!, 201);
    }

    public async Task<PagedTicketsResult> GetMyTicketsAsync(
        Guid travelerId,
        TicketStatus? status = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = _db.SupportTickets
            .AsNoTracking()
            .Include(t => t.Booking)
                .ThenInclude(b => b!.TourPackage)
            .Include(t => t.AssignedTo)
            .Where(t => t.TravelerId == travelerId);

        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(t => t.UpdatedAt)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedTicketsResult(items, totalCount, page, pageSize);
    }

    public async Task<SupportTicketResult> GetTicketByIdAsync(
        Guid ticketId,
        Guid userId,
        bool isStaff,
        CancellationToken ct = default)
    {
        var ticket = await LoadTicketDetailAsync(ticketId, ct);

        if (ticket is null)
        {
            return SupportTicketResult.Failure("Support ticket not found.", 404);
        }

        if (!isStaff && ticket.TravelerId != userId)
        {
            return SupportTicketResult.Failure(
                "Forbidden. You can only view your own support tickets.", 403);
        }

        return SupportTicketResult.Success(ticket);
    }

    public async Task<SupportMessageResult> AddTravelerMessageAsync(
        Guid ticketId,
        Guid travelerId,
        string message,
        CancellationToken ct = default)
    {
        var trimmedMessage = message?.Trim() ?? string.Empty;
        if (trimmedMessage.Length < MinMessageLength || trimmedMessage.Length > MaxMessageLength)
        {
            return SupportMessageResult.Failure(
                $"Message must be between {MinMessageLength} and {MaxMessageLength} characters.", 400);
        }

        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket is null)
        {
            return SupportMessageResult.Failure("Support ticket not found.", 404);
        }

        if (ticket.TravelerId != travelerId)
        {
            return SupportMessageResult.Failure(
                "Forbidden. You can only reply to your own support tickets.", 403);
        }

        if (ticket.Status == TicketStatus.Closed)
        {
            return SupportMessageResult.Failure(
                "Cannot reply to a closed support ticket.", 400);
        }

        var oldStatus = ticket.Status;
        var statusChanged = false;

        if (ticket.Status is TicketStatus.WaitingForCustomer or TicketStatus.Resolved)
        {
            ticket.Status = TicketStatus.Open;
            ticket.ResolvedAt = null;
            statusChanged = true;
        }

        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        var supportMessage = new SupportMessage
        {
            SupportTicketId = ticketId,
            SenderId = travelerId,
            Message = trimmedMessage,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.SupportMessages.Add(supportMessage);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportMessage",
                entityId: supportMessage.Id,
                action: "SupportMessageAdded",
                performedBy: travelerId,
                details: new
                {
                    ticketId,
                    messageId = supportMessage.Id,
                    senderId = travelerId,
                    isStaffReply = false
                },
                ct: ct);

            if (statusChanged)
            {
                await _auditLogService.LogAsync(
                    entityType: "SupportTicket",
                    entityId: ticket.Id,
                    action: "SupportTicketStatusChanged",
                    performedBy: travelerId,
                    details: new
                    {
                        ticketId = ticket.Id,
                        oldStatus = oldStatus.ToString(),
                        newStatus = ticket.Status.ToString(),
                        changedBy = travelerId
                    },
                    ct: ct);
            }

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var sender = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == travelerId, ct);
        supportMessage.Sender = sender!;

        return SupportMessageResult.Success(supportMessage, 201);
    }

    public async Task<PagedTicketsResult> GetStaffTicketsAsync(
        TicketStatus? status = null,
        TicketCategory? category = null,
        TicketPriority? priority = null,
        Guid? assignedToId = null,
        string? search = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = _db.SupportTickets
            .AsNoTracking()
            .Include(t => t.Traveler)
            .Include(t => t.Booking)
                .ThenInclude(b => b!.TourPackage)
            .Include(t => t.AssignedTo)
            .AsQueryable();

        if (status.HasValue)
        {
            query = query.Where(t => t.Status == status.Value);
        }

        if (category.HasValue)
        {
            query = query.Where(t => t.Category == category.Value);
        }

        if (priority.HasValue)
        {
            query = query.Where(t => t.Priority == priority.Value);
        }

        if (assignedToId.HasValue)
        {
            query = query.Where(t => t.AssignedToId == assignedToId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(t =>
                t.Subject.ToLower().Contains(term) ||
                t.Traveler.Email.ToLower().Contains(term) ||
                t.Traveler.Name.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(t => t.UpdatedAt)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedTicketsResult(items, totalCount, page, pageSize);
    }

    public async Task<SupportMessageResult> AddStaffMessageAsync(
        Guid ticketId,
        Guid staffId,
        string message,
        CancellationToken ct = default)
    {
        var trimmedMessage = message?.Trim() ?? string.Empty;
        if (trimmedMessage.Length < MinMessageLength || trimmedMessage.Length > MaxMessageLength)
        {
            return SupportMessageResult.Failure(
                $"Message must be between {MinMessageLength} and {MaxMessageLength} characters.", 400);
        }

        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket is null)
        {
            return SupportMessageResult.Failure("Support ticket not found.", 404);
        }

        if (ticket.Status == TicketStatus.Closed)
        {
            return SupportMessageResult.Failure(
                "Cannot reply to a closed support ticket. Reopen the ticket first.", 400);
        }

        var oldStatus = ticket.Status;
        var statusChanged = false;

        if (ticket.Status is TicketStatus.Open or TicketStatus.InProgress or TicketStatus.Resolved)
        {
            ticket.Status = TicketStatus.WaitingForCustomer;
            ticket.ResolvedAt = null;
            statusChanged = true;
        }

        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        var supportMessage = new SupportMessage
        {
            SupportTicketId = ticketId,
            SenderId = staffId,
            Message = trimmedMessage,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.SupportMessages.Add(supportMessage);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportMessage",
                entityId: supportMessage.Id,
                action: "SupportMessageAdded",
                performedBy: staffId,
                details: new
                {
                    ticketId,
                    messageId = supportMessage.Id,
                    senderId = staffId,
                    isStaffReply = true
                },
                ct: ct);

            if (statusChanged)
            {
                await _auditLogService.LogAsync(
                    entityType: "SupportTicket",
                    entityId: ticket.Id,
                    action: "SupportTicketStatusChanged",
                    performedBy: staffId,
                    details: new
                    {
                        ticketId = ticket.Id,
                        oldStatus = oldStatus.ToString(),
                        newStatus = ticket.Status.ToString(),
                        changedBy = staffId
                    },
                    ct: ct);
            }

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var staffUser = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == staffId, ct);
        supportMessage.Sender = staffUser!;

        return SupportMessageResult.Success(supportMessage, 201);
    }

    public async Task<SupportTicketResult> UpdateStatusAsync(
        Guid ticketId,
        Guid staffId,
        TicketStatus newStatus,
        CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket is null)
        {
            return SupportTicketResult.Failure("Support ticket not found.", 404);
        }

        var oldStatus = ticket.Status;
        if (oldStatus == newStatus)
        {
            var currentTicket = await LoadTicketDetailAsync(ticketId, ct);
            return SupportTicketResult.Success(currentTicket!);
        }

        ticket.Status = newStatus;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        if (newStatus == TicketStatus.Resolved)
        {
            ticket.ResolvedAt = DateTimeOffset.UtcNow;
        }
        else if (oldStatus == TicketStatus.Resolved && newStatus != TicketStatus.Resolved)
        {
            ticket.ResolvedAt = null;
        }

        if (newStatus == TicketStatus.Closed)
        {
            ticket.ClosedAt = DateTimeOffset.UtcNow;
        }
        else if (oldStatus == TicketStatus.Closed && newStatus != TicketStatus.Closed)
        {
            ticket.ClosedAt = null;
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportTicket",
                entityId: ticket.Id,
                action: "SupportTicketStatusChanged",
                performedBy: staffId,
                details: new
                {
                    ticketId = ticket.Id,
                    oldStatus = oldStatus.ToString(),
                    newStatus = newStatus.ToString(),
                    changedBy = staffId
                },
                ct: ct);

            if (newStatus == TicketStatus.Resolved)
            {
                await _auditLogService.LogAsync(
                    entityType: "SupportTicket",
                    entityId: ticket.Id,
                    action: "SupportTicketResolved",
                    performedBy: staffId,
                    details: new { ticketId = ticket.Id, resolvedBy = staffId },
                    ct: ct);
            }
            else if (newStatus == TicketStatus.Closed)
            {
                await _auditLogService.LogAsync(
                    entityType: "SupportTicket",
                    entityId: ticket.Id,
                    action: "SupportTicketClosed",
                    performedBy: staffId,
                    details: new { ticketId = ticket.Id, closedBy = staffId },
                    ct: ct);
            }

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var updatedTicket = await LoadTicketDetailAsync(ticketId, ct);
        return SupportTicketResult.Success(updatedTicket!);
    }

    public async Task<SupportTicketResult> AssignTicketAsync(
        Guid ticketId,
        Guid staffId,
        Guid? assignedToId,
        CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket is null)
        {
            return SupportTicketResult.Failure("Support ticket not found.", 404);
        }

        if (assignedToId.HasValue)
        {
            var targetUser = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == assignedToId.Value, ct);

            if (targetUser is null)
            {
                return SupportTicketResult.Failure("Assigned staff user not found.", 404);
            }

            if (targetUser.Role is not (UserRole.Admin or UserRole.OperationsManager))
            {
                return SupportTicketResult.Failure(
                    "Support tickets can only be assigned to Admin or OperationsManager staff.", 400);
            }
        }

        var previousAssignedToId = ticket.AssignedToId;
        ticket.AssignedToId = assignedToId;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportTicket",
                entityId: ticket.Id,
                action: "SupportTicketAssigned",
                performedBy: staffId,
                details: new
                {
                    ticketId = ticket.Id,
                    previousAssignedToId,
                    assignedToId,
                    assignedBy = staffId
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var updatedTicket = await LoadTicketDetailAsync(ticketId, ct);
        return SupportTicketResult.Success(updatedTicket!);
    }

    public async Task<SupportTicketResult> UpdatePriorityAsync(
        Guid ticketId,
        Guid staffId,
        TicketPriority newPriority,
        CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket is null)
        {
            return SupportTicketResult.Failure("Support ticket not found.", 404);
        }

        var oldPriority = ticket.Priority;
        if (oldPriority == newPriority)
        {
            var currentTicket = await LoadTicketDetailAsync(ticketId, ct);
            return SupportTicketResult.Success(currentTicket!);
        }

        ticket.Priority = newPriority;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "SupportTicket",
                entityId: ticket.Id,
                action: "SupportTicketPriorityChanged",
                performedBy: staffId,
                details: new
                {
                    ticketId = ticket.Id,
                    oldPriority = oldPriority.ToString(),
                    newPriority = newPriority.ToString(),
                    changedBy = staffId
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }

        var updatedTicket = await LoadTicketDetailAsync(ticketId, ct);
        return SupportTicketResult.Success(updatedTicket!);
    }

    private async Task<SupportTicket?> LoadTicketDetailAsync(Guid ticketId, CancellationToken ct)
    {
        return await _db.SupportTickets
            .AsNoTracking()
            .Include(t => t.Traveler)
            .Include(t => t.Booking)
                .ThenInclude(b => b!.TourPackage)
            .Include(t => t.AssignedTo)
            .Include(t => t.Messages)
                .ThenInclude(m => m.Sender)
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);
    }
}
