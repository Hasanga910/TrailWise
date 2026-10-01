using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public record PagedDiscountsResult(
    IReadOnlyList<Discount> Items,
    int TotalCount,
    int Page,
    int PageSize);

public interface IDiscountService
{
    Task<Discount> CreateAsync(
        string description,
        decimal percentageOff,
        int minGroupSize,
        bool isActive = true,
        DateTimeOffset? validFrom = null,
        DateTimeOffset? validUntil = null,
        Guid? performedBy = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<Discount>> GetAllListAsync(
        CancellationToken ct = default);

    Task<PagedDiscountsResult> GetAllAsync(
        string? search = null,
        string? sortBy = "createdAt",
        string? sortDirection = "desc",
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<Discount?> GetByIdAsync(
        Guid id,
        CancellationToken ct = default);

    Task<Discount?> UpdateAsync(
        Guid id,
        string description,
        decimal percentageOff,
        int minGroupSize,
        bool isActive = true,
        DateTimeOffset? validFrom = null,
        DateTimeOffset? validUntil = null,
        Guid? performedBy = null,
        CancellationToken ct = default);

    Task<Discount?> ToggleActiveAsync(
        Guid id,
        bool isActive,
        Guid? performedBy = null,
        CancellationToken ct = default);

    Task<IReadOnlyList<Discount>> GetActiveDiscountsAsync(
        DateTimeOffset? now = null,
        CancellationToken ct = default);

    Task<bool> DeleteAsync(
        Guid id,
        Guid? performedBy = null,
        CancellationToken ct = default);
}
