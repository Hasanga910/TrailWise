namespace TrailWise.Infrastructure.Agents;

public record ProposalSummaryInput(
    Guid BookingId,
    int GroupSize,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal BudgetPerPerson,
    string PackageTierClassType,
    bool PackageTierRequiresAc,
    GuideMatchResult GuideResult,
    VehicleMatchResult VehicleResult,
    PricingResult PricingResult,
    BookingApprovalEvaluator.Decision Decision,
    IReadOnlyList<string> DecisionReasons,
    TravelerPreferences Preferences);

public record ProposalSummary(string SummaryText, List<string> AdvisoryFlags);

public interface IProposalSummaryAgent
{
    Task<ProposalSummary> SummarizeAsync(ProposalSummaryInput input, CancellationToken ct = default);
}
