namespace TrailWise.Api.Contracts.Payments;

public record PricingBreakdownDto(
    decimal BaseCost,
    decimal CateringCost,
    decimal AddOnCost,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal FinalTotal,
    string? DiscountDescription = null,
    decimal? DiscountPercentage = null);
