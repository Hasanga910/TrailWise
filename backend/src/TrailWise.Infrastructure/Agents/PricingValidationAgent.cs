using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Production implementation of Person 4's Pricing &amp; Validation Agent.
/// Calculates tier-based tour pricing, multi-day catering, and booking add-ons,
/// and performs deterministic validation checks against vehicle, budget, and group constraints.
/// </summary>
public class PricingValidationAgent : IPricingValidationAgent
{
    // Documented temporary catering rate: 15.00 per person per tour day.
    // This is a documented project assumption because the current system design
    // does not define dynamic catering rate schedules.
    private const decimal DailyCateringRatePerPerson = 15m;

    private readonly TrailWiseDbContext _db;

    public PricingValidationAgent(TrailWiseDbContext db)
    {
        _db = db;
    }

    public async Task<PricingResult> CalculateAsync(
        Guid bookingId,
        GuideMatchResult guideResult,
        VehicleMatchResult vehicleResult,
        CancellationToken ct = default)
    {
        // 1. Safely load the Booking from DbContext using AsNoTracking for read-only calculation.
        // Include PackageTier, TourPackage (to access DurationDays), and BookingAddOns.
        var booking = await _db.Bookings
            .AsNoTracking()
            .Include(b => b.PackageTier)
            .Include(b => b.TourPackage)
            .Include(b => b.BookingAddOns)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            throw new InvalidOperationException($"Booking with ID '{bookingId}' was not found.");
        }

        if (booking.PackageTier is null)
        {
            throw new InvalidOperationException($"Package tier for booking '{bookingId}' was not found.");
        }

        // SECURITY NOTE:
        // Traveler-controlled free text (Booking.SpecialRequests) is intentionally NEVER read,
        // referenced, or incorporated into pricing or validation calculations, nor passed into
        // any LLM prompt context. This guarantees that unvetted free text cannot alter deterministic
        // pricing, bypass budget thresholds, or execute prompt-injection attacks.
        // No LLM is invoked; all calculation and validation is strictly deterministic C# code.

        // 2. Pricing Calculations:
        // TierBasePrice = BasePricePerPerson * GroupSize
        var tierBasePrice = booking.PackageTier.BasePricePerPerson * booking.GroupSize;

        // Duration in days from TourPackage navigation property (fallback to 1 if not set)
        var durationDays = booking.TourPackage != null && booking.TourPackage.DurationDays > 0
            ? booking.TourPackage.DurationDays
            : 1;

        // CateringCost = 15m * GroupSize * DurationDays if IncludesFood == true; otherwise 0
        var cateringCost = booking.PackageTier.IncludesFood
            ? DailyCateringRatePerPerson * booking.GroupSize * durationDays
            : 0m;

        // AddOnsCost = Sum of BookingAddOns.Cost
        var addOnsCost = booking.BookingAddOns.Sum(a => a.Cost);

        // Group discount is not yet implemented in this task; fixed to 0
        var groupDiscount = 0m;

        // FinalTotal = TierBasePrice + CateringCost + AddOnsCost
        var finalTotal = tierBasePrice + cateringCost + addOnsCost - groupDiscount;

        // 3. Serialize structured breakdown to JSON preserving the existing string contract
        var breakdown = JsonSerializer.Serialize(
            new
            {
                tierBasePrice,
                cateringCost,
                addOnsCost,
                groupDiscount,
                finalTotal
            },
            AgentJsonOptions.Default);

        // 4. Deterministic Validation Checks:
        // GUIDE RESULT OBSERVATION:
        // GuideMatchResult.GuideId is a non-nullable Guid. Guid.Empty is the project's representation
        // of an unassigned/invalid guide. Downstream, BookingApprovalEvaluator also inspects
        // GuideMatchScore (< 0.5) during coordinator workflow approval gating.

        // Check 1: Vehicle conflict or missing guide
        if (vehicleResult.ConflictCheck || guideResult.GuideId == Guid.Empty)
        {
            return new PricingResult(finalTotal, breakdown, "Failed");
        }

        // Check 2: AC mismatch (PackageTier requires AC but vehicle does not have AC)
        if (booking.PackageTier.RequiresAC && !vehicleResult.AcMatch)
        {
            return new PricingResult(finalTotal, breakdown, "Failed");
        }

        // Check 3: Budget threshold (allowed budget = BudgetPerPerson * GroupSize * 1.15m)
        var allowedBudget = booking.BudgetPerPerson * booking.GroupSize * 1.15m;
        if (finalTotal > allowedBudget)
        {
            return new PricingResult(finalTotal, breakdown, "NeedsApproval");
        }

        // Check 4: Large group (existing project behavior uses GroupSize > 10)
        if (booking.GroupSize > 10)
        {
            return new PricingResult(finalTotal, breakdown, "NeedsApproval");
        }

        // Check 5: Otherwise, all constraints satisfied
        return new PricingResult(finalTotal, breakdown, "Valid");
    }
}
