using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingApprovalEvaluatorTests
{
    private static BookingApprovalEvaluator.Input GoodInput() => new(
        GroupSize: 2,
        BudgetPerPerson: 500m,
        TotalCost: 500m,
        TierRequiresAc: false,
        VehicleAcMatch: true,
        VehicleConflictCheck: false,
        GuideMatchScore: 0.9);

    [Fact]
    public void Evaluate_WithAllGoodValues_ReturnsApproved()
    {
        var result = BookingApprovalEvaluator.Evaluate(GoodInput());

        Assert.Equal(BookingApprovalEvaluator.Decision.Approved, result.Decision);
    }

    [Fact]
    public void Evaluate_WithAcMismatch_ReturnsValidationFailed()
    {
        var input = GoodInput() with { TierRequiresAc = true, VehicleAcMatch = false };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.ValidationFailed, result.Decision);
    }

    [Fact]
    public void Evaluate_WithVehicleConflict_ReturnsValidationFailed()
    {
        var input = GoodInput() with { VehicleConflictCheck = true };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.ValidationFailed, result.Decision);
    }

    [Fact]
    public void Evaluate_WithLowGuideMatchScore_ReturnsValidationFailed()
    {
        var input = GoodInput() with { GuideMatchScore = 0.4 };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.ValidationFailed, result.Decision);
    }

    [Fact]
    public void Evaluate_WithLargeGroup_ReturnsNeedsApproval()
    {
        var input = GoodInput() with { GroupSize = 11, TotalCost = 500m, BudgetPerPerson = 500m };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.NeedsApproval, result.Decision);
    }

    [Fact]
    public void Evaluate_WithCostExceedingBudgetMargin_ReturnsNeedsApproval()
    {
        // ceiling = 500 * 2 * 1.15 = 1150
        var input = GoodInput() with { GroupSize = 2, BudgetPerPerson = 500m, TotalCost = 1151m };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.NeedsApproval, result.Decision);
    }

    [Fact]
    public void Evaluate_WithCostExactlyAtBudgetCeiling_ReturnsApproved()
    {
        // ceiling = 500 * 2 * 1.15 = 1150, exactly at (not over) the ceiling
        var input = GoodInput() with { GroupSize = 2, BudgetPerPerson = 500m, TotalCost = 1150m };

        var result = BookingApprovalEvaluator.Evaluate(input);

        Assert.Equal(BookingApprovalEvaluator.Decision.Approved, result.Decision);
    }
}
