using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using Xunit;

namespace TrailWise.Api.Tests;

public class PreferenceExtractionAgentTests
{
    private static PreferenceExtractionAgent CreateSut(FakeLlmClient client) =>
        new(client, Options.Create(new LlmOptions()), NullLogger<PreferenceExtractionAgent>.Instance);

    [Fact]
    public async Task ExtractAsync_WithSpecialRequests_ReturnsWhatClientReturns()
    {
        var expected = new TravelerPreferences(["vegetarian"], ["wheelchair accessible"], [], false);
        var client = new FakeLlmClient { ResultToReturn = expected };
        var sut = CreateSut(client);

        var result = await sut.ExtractAsync("vegetarian please, and my mother uses a wheelchair");

        Assert.Equal(expected, result);
        Assert.True(client.WasCalled);
        Assert.Contains("<untrusted_traveler_note>", client.LastUserContent);
        Assert.Contains("vegetarian please", client.LastUserContent);
        Assert.Equal(new LlmOptions().ExtractionModel, client.LastModel);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task ExtractAsync_WithNullOrEmptySpecialRequests_ReturnsEmpty_AndNeverCallsClient(string? specialRequests)
    {
        var client = new FakeLlmClient();
        var sut = CreateSut(client);

        var result = await sut.ExtractAsync(specialRequests);

        Assert.Equal(TravelerPreferences.Empty, result);
        Assert.False(client.WasCalled);
    }

    [Fact]
    public async Task ExtractAsync_WhenClientThrows_ReturnsEmpty()
    {
        var client = new FakeLlmClient { ExceptionToThrow = new LlmCallFailedException("simulated failure") };
        var sut = CreateSut(client);

        var result = await sut.ExtractAsync("some special request");

        Assert.Equal(TravelerPreferences.Empty, result);
    }

    [Fact]
    public async Task ExtractAsync_WithNullLlmClient_ReturnsEmpty()
    {
        // Exercises the real production kill-switch class (registered when Llm:Enabled=false),
        // not just an arbitrary FakeLlmClient throw — with non-empty input so the
        // empty-input early-return can't mask whether the kill switch itself works.
        var sut = new PreferenceExtractionAgent(new NullLlmClient(), Options.Create(new LlmOptions()), NullLogger<PreferenceExtractionAgent>.Instance);

        var result = await sut.ExtractAsync("vegetarian please, and my mother uses a wheelchair");

        Assert.Equal(TravelerPreferences.Empty, result);
    }

    [Fact]
    public async Task ExtractAsync_WithNullListsInResult_NormalizesToEmptyLists()
    {
        var malformed = new TravelerPreferences(null!, null!, null!, false);
        var client = new FakeLlmClient { ResultToReturn = malformed };
        var sut = CreateSut(client);

        var result = await sut.ExtractAsync("some special request");

        Assert.NotNull(result.DietaryNotes);
        Assert.NotNull(result.AccessibilityNeeds);
        Assert.NotNull(result.OtherNotes);
        Assert.Empty(result.DietaryNotes);
        Assert.Empty(result.AccessibilityNeeds);
        Assert.Empty(result.OtherNotes);
    }
}
