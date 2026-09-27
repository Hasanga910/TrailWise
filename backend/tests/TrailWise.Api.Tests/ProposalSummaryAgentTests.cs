using Microsoft.Extensions.Options;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using Xunit;

namespace TrailWise.Api.Tests;

public class ProposalSummaryAgentTests
{
    private static ProposalSummaryInput SampleInput() => new(
        BookingId: Guid.NewGuid(),
        GroupSize: 2,
        StartDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
        EndDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
        BudgetPerPerson: 500m,
        PackageTierClassType: "Normal",
        PackageTierRequiresAc: false,
        GuideResult: new GuideMatchResult(Guid.NewGuid(), 0.9, "Best available guide."),
        VehicleResult: new VehicleMatchResult(Guid.NewGuid(), Guid.NewGuid(), true, true, false),
        PricingResult: new PricingResult(1000m, "breakdown", "Calculated"),
        Decision: BookingApprovalEvaluator.Decision.Approved,
        DecisionReasons: [],
        Preferences: TravelerPreferences.Empty);

    [Fact]
    public async Task SummarizeAsync_ReturnsWhatClientReturns_UsingSummaryModel()
    {
        var expected = new ProposalSummary("This booking looks good.", ["Nothing unusual."]);
        var client = new FakeLlmClient { ResultToReturn = expected };
        var options = new LlmOptions();
        var sut = new ProposalSummaryAgent(client, Options.Create(options));

        var result = await sut.SummarizeAsync(SampleInput());

        Assert.Equal(expected, result);
        Assert.True(client.WasCalled);
        Assert.Equal(options.SummaryModel, client.LastModel);
        Assert.Contains("<booking_data>", client.LastUserContent);
    }

    [Fact]
    public async Task SummarizeAsync_WhenClientThrows_PropagatesException()
    {
        var client = new FakeLlmClient { ExceptionToThrow = new LlmCallFailedException("simulated failure") };
        var sut = new ProposalSummaryAgent(client, Options.Create(new LlmOptions()));

        await Assert.ThrowsAsync<LlmCallFailedException>(() => sut.SummarizeAsync(SampleInput()));
    }

    [Fact]
    public async Task SummarizeAsync_WithNullLlmClient_PropagatesException()
    {
        // Exercises the real production kill-switch class (registered when Llm:Enabled=false),
        // not just an arbitrary FakeLlmClient throw.
        var sut = new ProposalSummaryAgent(new NullLlmClient(), Options.Create(new LlmOptions()));

        await Assert.ThrowsAsync<LlmCallFailedException>(() => sut.SummarizeAsync(SampleInput()));
    }

    [Fact]
    public void ProposalSummaryInput_NeverExposesRawBookingOrSpecialRequests()
    {
        var propertyNames = typeof(ProposalSummaryInput).GetProperties().Select(p => p.Name);

        Assert.DoesNotContain("SpecialRequests", propertyNames);
        Assert.DoesNotContain("Booking", propertyNames);
    }
}
