namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Registered instead of <see cref="GroqAgentClient"/> when <c>Llm:Enabled</c> is false — the
/// hard kill switch. Fails fast with zero HTTP calls and no attempt to fabricate a default
/// <c>TResult</c> (most result records have no parameterless constructor); it is each calling
/// agent's job to catch <see cref="LlmCallFailedException"/> and build its own safe default,
/// exactly as it must already do for a real, reachable-but-failing Groq call.
/// </summary>
public class NullLlmClient : ILlmClient
{
    public Task<TResult> CallStructuredAsync<TResult>(
        string systemPrompt,
        string userContent,
        string model,
        int maxOutputTokens,
        CancellationToken ct = default)
    {
        throw new LlmCallFailedException("LLM disabled via Llm:Enabled=false.");
    }
}
