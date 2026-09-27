namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Shared abstraction over a cloud LLM (Groq) for structured, JSON-schema-validated calls.
/// Agents never talk to the Groq HTTP API directly — this is the one place that enforces
/// timeouts, retries, and the kill switch. Every failure mode surfaces as
/// <see cref="LlmCallFailedException"/>; callers are expected to catch it and substitute their
/// own safe default rather than let it fail the booking workflow.
/// </summary>
public interface ILlmClient
{
    Task<TResult> CallStructuredAsync<TResult>(
        string systemPrompt,
        string userContent,
        string model,
        int maxOutputTokens,
        CancellationToken ct = default);
}
