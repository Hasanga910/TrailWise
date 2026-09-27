using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Discounts;

public record DiscountDto(
    Guid Id,
    string Description,
    decimal PercentageOff,
    int MinGroupSize,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt)
{
    public static DiscountDto FromEntity(Discount discount) => new(
        discount.Id,
        discount.Description,
        discount.PercentageOff,
        discount.MinGroupSize,
        discount.CreatedAt,
        discount.UpdatedAt);
}
