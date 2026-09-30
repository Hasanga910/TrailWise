using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class DiscountService : IDiscountService
{
    private readonly TrailWiseDbContext _db;
    private readonly IAuditLogService _auditLogService;
    private readonly ILogger<DiscountService> _logger;

    public DiscountService(
        TrailWiseDbContext db,
        IAuditLogService auditLogService,
        ILogger<DiscountService> logger)
    {
        _db = db;
        _auditLogService = auditLogService;
        _logger = logger;
    }

    public async Task<Discount> CreateAsync(
        string description,
        decimal percentageOff,
        int minGroupSize,
        Guid? performedBy = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));
        if (description.Length > 200)
            throw new ArgumentException("Description cannot exceed 200 characters.", nameof(description));
        if (percentageOff <= 0 || percentageOff > 100)
            throw new ArgumentOutOfRangeException(nameof(percentageOff), "PercentageOff must be greater than 0 and at most 100.");
        if (minGroupSize < 1)
            throw new ArgumentOutOfRangeException(nameof(minGroupSize), "MinGroupSize must be at least 1.");

        var discount = new Discount
        {
            Description = description.Trim(),
            PercentageOff = percentageOff,
            MinGroupSize = minGroupSize,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.Discounts.Add(discount);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Discount",
                entityId: discount.Id,
                action: "DiscountCreated",
                performedBy: performedBy,
                details: new
                {
                    description = discount.Description,
                    percentageOff = discount.PercentageOff,
                    minGroupSize = discount.MinGroupSize
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Discount created: {DiscountId}, {Description}", discount.Id, discount.Description);
            return discount;
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }
    }

    public async Task<PagedDiscountsResult> GetAllAsync(
        string? search = null,
        string? sortBy = "createdAt",
        string? sortDirection = "desc",
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        page = page < 1 ? 1 : page;
        pageSize = pageSize < 1 ? 10 : pageSize;

        var query = _db.Discounts.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var trimmed = search.Trim().ToLower();
            query = query.Where(d => d.Description.ToLower().Contains(trimmed));
        }

        var isAsc = string.Equals(sortDirection, "asc", StringComparison.OrdinalIgnoreCase);
        var normalizedSortBy = sortBy?.Trim().ToLowerInvariant();

        query = normalizedSortBy switch
        {
            "description" => isAsc ? query.OrderBy(d => d.Description).ThenBy(d => d.Id)
                                   : query.OrderByDescending(d => d.Description).ThenBy(d => d.Id),
            "percentageoff" or "percentage_off" => isAsc ? query.OrderBy(d => d.PercentageOff).ThenBy(d => d.Id)
                                                        : query.OrderByDescending(d => d.PercentageOff).ThenBy(d => d.Id),
            "mingroupsize" or "min_group_size" => isAsc ? query.OrderBy(d => d.MinGroupSize).ThenBy(d => d.Id)
                                                       : query.OrderByDescending(d => d.MinGroupSize).ThenBy(d => d.Id),
            _ => isAsc ? query.OrderBy(d => d.CreatedAt).ThenBy(d => d.Id)
                       : query.OrderByDescending(d => d.CreatedAt).ThenBy(d => d.Id)
        };

        var totalCount = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PagedDiscountsResult(items, totalCount, page, pageSize);
    }

    public async Task<Discount?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _db.Discounts
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, ct);
    }

    public async Task<Discount?> UpdateAsync(
        Guid id,
        string description,
        decimal percentageOff,
        int minGroupSize,
        Guid? performedBy = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));
        if (description.Length > 200)
            throw new ArgumentException("Description cannot exceed 200 characters.", nameof(description));
        if (percentageOff <= 0 || percentageOff > 100)
            throw new ArgumentOutOfRangeException(nameof(percentageOff), "PercentageOff must be greater than 0 and at most 100.");
        if (minGroupSize < 1)
            throw new ArgumentOutOfRangeException(nameof(minGroupSize), "MinGroupSize must be at least 1.");

        var discount = await _db.Discounts.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (discount is null)
        {
            return null;
        }

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            discount.Description = description.Trim();
            discount.PercentageOff = percentageOff;
            discount.MinGroupSize = minGroupSize;
            discount.UpdatedAt = DateTimeOffset.UtcNow;

            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Discount",
                entityId: discount.Id,
                action: "DiscountUpdated",
                performedBy: performedBy,
                details: new
                {
                    description = discount.Description,
                    percentageOff = discount.PercentageOff,
                    minGroupSize = discount.MinGroupSize
                },
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Discount updated: {DiscountId}, {Description}", discount.Id, discount.Description);
            return discount;
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }
    }

    public async Task<bool> DeleteAsync(
        Guid id,
        Guid? performedBy = null,
        CancellationToken ct = default)
    {
        var discount = await _db.Discounts.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (discount is null)
        {
            return false;
        }

        var details = new
        {
            description = discount.Description,
            percentageOff = discount.PercentageOff,
            minGroupSize = discount.MinGroupSize
        };

        await using var transaction = _db.Database.IsRelational()
            ? await _db.Database.BeginTransactionAsync(ct)
            : null;

        try
        {
            _db.Discounts.Remove(discount);
            await _db.SaveChangesAsync(ct);

            await _auditLogService.LogAsync(
                entityType: "Discount",
                entityId: id,
                action: "DiscountDeleted",
                performedBy: performedBy,
                details: details,
                ct: ct);

            if (transaction != null)
            {
                await transaction.CommitAsync(ct);
            }

            _logger.LogInformation("Discount deleted: {DiscountId}", id);
            return true;
        }
        catch
        {
            if (transaction != null)
            {
                await transaction.RollbackAsync(ct);
            }
            throw;
        }
    }
}
