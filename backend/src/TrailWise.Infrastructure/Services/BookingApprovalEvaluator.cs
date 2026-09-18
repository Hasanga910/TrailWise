namespace TrailWise.Infrastructure.Services;

/// <summary>
/// Deterministic business-rule gate for a booking proposal. Runs in plain code, never
/// left to an LLM's judgement, per the design doc's Section 8.4 requirement.
/// </summary>
public static class BookingApprovalEvaluator
{
    // Duplicated by value from TrailWise.Api.Contracts.Bookings.BookingDto.LargeGroupThreshold
    // since Infrastructure cannot reference the Api project. Keep both in sync if this ever changes.
    public const int LargeGroupThreshold = 10;
    public const decimal BudgetMarginMultiplier = 1.15m;
    public const double MinAcceptableGuideMatchScore = 0.5;

    public enum Decision
    {
        Approved,
        NeedsApproval,
        ValidationFailed
    }

    public readonly record struct Input(
        int GroupSize,
        decimal BudgetPerPerson,
        decimal TotalCost,
        bool TierRequiresAc,
        bool VehicleAcMatch,
        bool VehicleConflictCheck,
        double GuideMatchScore);

    public readonly record struct Result(Decision Decision, IReadOnlyList<string> Reasons);

    public static Result Evaluate(Input input)
    {
        var reasons = new List<string>();

        var acMismatch = input.TierRequiresAc && !input.VehicleAcMatch;
        var guideOrVehicleProblem =
            input.VehicleConflictCheck || input.GuideMatchScore < MinAcceptableGuideMatchScore;

        // Hard failures take precedence over "needs approval" — these can never be waved through.
        if (acMismatch || guideOrVehicleProblem)
        {
            if (acMismatch)
            {
                reasons.Add("Tier requires AC but the matched vehicle does not have AC.");
            }
            if (guideOrVehicleProblem)
            {
                reasons.Add("Vehicle scheduling conflict detected, or guide match score is below the acceptable threshold.");
            }
            return new Result(Decision.ValidationFailed, reasons);
        }

        var needsApproval = false;
        if (input.GroupSize > LargeGroupThreshold)
        {
            needsApproval = true;
            reasons.Add($"Group size {input.GroupSize} exceeds the large-group threshold of {LargeGroupThreshold}.");
        }

        var budgetCeiling = input.BudgetPerPerson * input.GroupSize * BudgetMarginMultiplier;
        if (input.TotalCost > budgetCeiling)
        {
            needsApproval = true;
            reasons.Add($"Total cost {input.TotalCost} exceeds the budget ceiling {budgetCeiling}.");
        }

        return new Result(needsApproval ? Decision.NeedsApproval : Decision.Approved, reasons);
    }
}
