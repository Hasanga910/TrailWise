using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Discounts;

public record ActiveDiscountDto(
    Guid Id,
    string Description,
    decimal PercentageOff,
    int MinGroupSize,
    DateTimeOffset? ValidFrom,
    DateTimeOffset? ValidUntil)
{
    public static ActiveDiscountDto FromEntity(Discount discount) => new(
        discount.Id,
        discount.Description,
        discount.PercentageOff,
        discount.MinGroupSize,
        discount.ValidFrom,
        discount.ValidUntil);
}
