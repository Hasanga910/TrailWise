namespace TrailWise.Infrastructure.Services;

public record PricingResult(decimal TotalCost, string Breakdown, string ValidationResult);

public interface IPricingValidationAgent
{
    Task<PricingResult> CalculateAsync(
        Guid bookingId,
        GuideMatchResult guideResult,
        VehicleMatchResult vehicleResult,
        CancellationToken ct = default);
}
