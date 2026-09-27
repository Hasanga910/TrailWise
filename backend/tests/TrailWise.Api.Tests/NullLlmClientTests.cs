using TrailWise.Infrastructure.Agents;
using Xunit;

namespace TrailWise.Api.Tests;

public class NullLlmClientTests
{
    [Fact]
    public async Task CallStructuredAsync_ThrowsLlmCallFailedException_WithoutAnyHttpCall()
    {
        var sut = new NullLlmClient();

        await Assert.ThrowsAsync<LlmCallFailedException>(() =>
            sut.CallStructuredAsync<string>("system prompt", "user content", "some-model", 100));
    }
}
