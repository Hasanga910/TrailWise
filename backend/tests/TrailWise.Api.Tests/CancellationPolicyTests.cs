using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class CancellationPolicyTests
{
    private static readonly DateOnly Today = new(2026, 10, 5);

    [Theory]
    [InlineData(0, true)]
    [InlineData(1, true)]
    [InlineData(6, true)]
    [InlineData(7, false)] // exactly the window: still a standard cancellation
    [InlineData(8, false)]
    [InlineData(60, false)]
    public void RequiresApproval_OnlyFewerThanWindowDaysBeforeStart_WithAnApprovedPayment(int daysAhead, bool expected) =>
        Assert.Equal(expected, CancellationPolicy.RequiresApproval(Today, Today.AddDays(daysAhead), 7, hasApprovedPayment: true));

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(30)]
    public void RequiresApproval_IsNeverRequiredWithoutAnApprovedPayment(int daysAhead) =>
        Assert.False(CancellationPolicy.RequiresApproval(Today, Today.AddDays(daysAhead), 7, hasApprovedPayment: false));

    [Theory]
    [InlineData(10, 14, true)]
    [InlineData(14, 14, false)]
    [InlineData(2, 3, true)]
    [InlineData(3, 3, false)]
    public void RequiresApproval_UsesTheConfiguredWindow(int daysAhead, int windowDays, bool expected) =>
        Assert.Equal(expected, CancellationPolicy.RequiresApproval(Today, Today.AddDays(daysAhead), windowDays, true));

    [Theory]
    [InlineData(-5, true)]
    [InlineData(0, true)]
    [InlineData(2, true)]
    [InlineData(3, false)]
    [InlineData(30, false)]
    public void IsUrgent_MeansTheTourStartsWithinTwoDaysOrHasStarted(int daysUntilStart, bool expected)
    {
        Assert.Equal(2, CancellationPolicy.UrgentRefundExceptionDays);
        Assert.Equal(expected, CancellationPolicy.IsUrgent(daysUntilStart));
    }

    [Fact]
    public void DaysUntilStart_CountsWholeDays_AndIsNegativeOnceStarted()
    {
        Assert.Equal(5, CancellationPolicy.DaysUntilStart(Today, Today.AddDays(5)));
        Assert.Equal(-2, CancellationPolicy.DaysUntilStart(Today, Today.AddDays(-2)));
    }

    [Fact]
    public void Options_DefaultToSevenDays_AndBindFromConfiguration()
    {
        Assert.Equal(7, new CancellationOptions().RefundWindowDays);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Cancellation:RefundWindowDays"] = "10" })
            .Build();
        var provider = new ServiceCollection()
            .Configure<CancellationOptions>(config.GetSection(CancellationOptions.SectionName))
            .BuildServiceProvider();

        Assert.Equal(10, provider.GetRequiredService<Microsoft.Extensions.Options.IOptions<CancellationOptions>>().Value.RefundWindowDays);
    }
}
