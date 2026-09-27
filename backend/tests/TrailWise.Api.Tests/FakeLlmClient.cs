using TrailWise.Infrastructure.Agents;

namespace TrailWise.Api.Tests;

/// <summary>
/// Hand-written test double for <see cref="ILlmClient"/> (this project has no mocking
/// library — see the existing Mock*Agent classes for the same convention). Configure
/// <see cref="ResultToReturn"/> to succeed or <see cref="ExceptionToThrow"/> to simulate a
/// failed/disabled LLM call; every invocation is recorded for assertions.
/// </summary>
public class FakeLlmClient : ILlmClient
{
    public bool WasCalled { get; private set; }
    public string? LastSystemPrompt { get; private set; }
    public string? LastUserContent { get; private set; }
    public string? LastModel { get; private set; }

    public object? ResultToReturn { get; set; }
    public Exception? ExceptionToThrow { get; set; }

    public Task<TResult> CallStructuredAsync<TResult>(
        string systemPrompt,
        string userContent,
        string model,
        int maxOutputTokens,
        CancellationToken ct = default)
    {
        WasCalled = true;
        LastSystemPrompt = systemPrompt;
        LastUserContent = userContent;
        LastModel = model;

        if (ExceptionToThrow is not null)
        {
            throw ExceptionToThrow;
        }

        return Task.FromResult((TResult)ResultToReturn!);
    }
}
