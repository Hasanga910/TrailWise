using System.Text.Json;
using Microsoft.Extensions.Options;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Writes a plain-English explanation of a finalized booking proposal for Operations Manager
/// review, via an LLM call. Unlike <see cref="PreferenceExtractionAgent"/>, this agent does
/// NOT swallow failures itself — <see cref="LlmCallFailedException"/> is left to propagate, since
/// this always runs after the booking's real outcome is already committed; it's the coordinator's
/// job (running strictly post-commit) to catch it and leave <c>SummaryText</c> null rather than
/// fail an already-successful workflow run.
/// </summary>
public class ProposalSummaryAgent : IProposalSummaryAgent
{
    private const string SystemPrompt = """
        You write short, clear, factual summaries of tour booking proposals for an Operations Manager
        who needs to quickly understand a system-generated decision. You are given already-finalized,
        trustworthy structured data (never traveler free text directly) — summarize what happened and
        why. Do not invent facts not present in the input. Keep the summary under 150 words, plain
        English, no markdown headers. Separately list 0-5 short advisory flags if anything in the data
        looks worth a human's extra attention — these flags are informational only and do not change
        any decision.

        Respond with ONLY a single JSON object matching this exact shape, no other text:
        {
          "summaryText": string,
          "advisoryFlags": string[]
        }
        """;

    private readonly ILlmClient _llmClient;
    private readonly LlmOptions _options;

    public ProposalSummaryAgent(ILlmClient llmClient, IOptions<LlmOptions> options)
    {
        _llmClient = llmClient;
        _options = options.Value;
    }

    public Task<ProposalSummary> SummarizeAsync(ProposalSummaryInput input, CancellationToken ct = default)
    {
        var userContent = $"<booking_data>\n{JsonSerializer.Serialize(input, AgentJsonOptions.Default)}\n</booking_data>";

        return _llmClient.CallStructuredAsync<ProposalSummary>(
            SystemPrompt, userContent, _options.SummaryModel, _options.MaxOutputTokens, ct);
    }
}
