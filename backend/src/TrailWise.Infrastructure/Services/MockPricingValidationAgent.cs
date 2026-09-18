using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Stand-in for Person 4's real Pricing &amp; Validation Agent. Unlike the guide/fleet mocks,
/// this one computes a real price from this component's own PackageTier/Booking data, since
/// that makes the coordinator's budget-override business rule meaningfully testable rather
/// than comparing against an arbitrary constant. Swap the DI registration in
/// DependencyInjection.cs for the real implementation once it exists — no change needed in
/// CoordinatorAgentService itself.
/// </summary>
public class MockPricingValidationAgent : IPricingValidationAgent
{
    private const decimal CateringSurchargePerPerson = 15m;

    private readonly TrailWiseDbContext _db;

    public MockPricingValidationAgent(TrailWiseDbContext db)
    {
        _db = db;
    }

    public async Task<PricingResult> CalculateAsync(
        Guid bookingId,
        GuideMatchResult guideResult,
        VehicleMatchResult vehicleResult,
        CancellationToken ct = default)
    {
        var booking = await _db.Bookings
            .Include(b => b.PackageTier)
            .FirstAsync(b => b.Id == bookingId, ct);

        var catering = booking.PackageTier.IncludesFood ? CateringSurchargePerPerson * booking.GroupSize : 0m;
        var totalCost = booking.PackageTier.BasePricePerPerson * booking.GroupSize + catering;

        var breakdown = JsonSerializer.Serialize(
            new
            {
                basePricePerPerson = booking.PackageTier.BasePricePerPerson,
                groupSize = booking.GroupSize,
                cateringSurchargeTotal = catering,
                totalCost
            },
            AgentJsonOptions.Default);

        // This ValidationResult is this agent's own informational note only. The Coordinator
        // never branches control flow on this string — the deterministic gating decision comes
        // exclusively from BookingApprovalEvaluator.
        return new PricingResult(totalCost, breakdown, "Calculated");
    }
}
