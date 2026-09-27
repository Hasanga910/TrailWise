using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Talks to Groq's OpenAI-compatible <c>/chat/completions</c> endpoint. Requests JSON-formatted
/// output, validates it deserializes into the caller's <c>TResult</c> shape, and retries (bounded
/// by <see cref="LlmOptions.MaxRetries"/>) on transient HTTP errors (including a 429 rate limit or
/// 5xx, both surfaced as a non-2xx by <c>EnsureSuccessStatusCode</c>), timeouts, or a malformed/
/// schema-mismatched response — appending a corrective follow-up message for the latter. Every
/// failure mode, after retries are exhausted, surfaces as <see cref="LlmCallFailedException"/>;
/// no other exception type escapes this class.
/// </summary>
public class GroqAgentClient : ILlmClient
{
    private readonly HttpClient _httpClient;
    private readonly LlmOptions _options;
    private readonly ILogger<GroqAgentClient> _logger;

    public GroqAgentClient(HttpClient httpClient, LlmOptions options, ILogger<GroqAgentClient> logger)
    {
        _httpClient = httpClient;
        _options = options;
        _logger = logger;
    }

    public async Task<TResult> CallStructuredAsync<TResult>(
        string systemPrompt,
        string userContent,
        string model,
        int maxOutputTokens,
        CancellationToken ct = default)
    {
        var messages = new List<GroqMessage>
        {
            new("system", systemPrompt),
            new("user", userContent),
        };

        Exception? lastError = null;

        for (var attempt = 0; attempt <= _options.MaxRetries; attempt++)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(_options.TimeoutSeconds));

            try
            {
                var request = new GroqChatRequest(model, messages, new GroqResponseFormat("json_object"), maxOutputTokens);
                using var response = await _httpClient.PostAsJsonAsync("chat/completions", request, RequestJsonOptions, cts.Token);
                response.EnsureSuccessStatusCode();

                var envelope = await response.Content.ReadFromJsonAsync<GroqChatResponse>(RequestJsonOptions, cts.Token);
                var content = envelope?.Choices?.FirstOrDefault()?.Message?.Content;
                if (string.IsNullOrWhiteSpace(content))
                {
                    throw new JsonException("Groq response contained no message content.");
                }

                var result = JsonSerializer.Deserialize<TResult>(content, AgentJsonOptions.Default);
                if (result is null)
                {
                    throw new JsonException("Groq response content deserialized to null.");
                }

                return result;
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException)
            {
                lastError = ex;
                _logger.LogWarning(ex, "Groq call failed on attempt {Attempt}/{MaxAttempts}.", attempt + 1, _options.MaxRetries + 1);

                if (attempt < _options.MaxRetries && ex is JsonException)
                {
                    messages.Add(new GroqMessage(
                        "user",
                        "Your last response didn't match the required shape. Respond with ONLY the JSON object, no other text."));
                }
            }
        }

        throw new LlmCallFailedException(
            $"Groq call failed after {_options.MaxRetries + 1} attempt(s).",
            lastError ?? new InvalidOperationException("Unknown failure."));
    }

    private static readonly JsonSerializerOptions RequestJsonOptions = new()
    {
        PropertyNamingPolicy = null,
    };

    private record GroqMessage(
        [property: JsonPropertyName("role")] string Role,
        [property: JsonPropertyName("content")] string Content);

    private record GroqResponseFormat(
        [property: JsonPropertyName("type")] string Type);

    private record GroqChatRequest(
        [property: JsonPropertyName("model")] string Model,
        [property: JsonPropertyName("messages")] List<GroqMessage> Messages,
        [property: JsonPropertyName("response_format")] GroqResponseFormat ResponseFormat,
        [property: JsonPropertyName("max_tokens")] int MaxTokens);

    private record GroqChoice(
        [property: JsonPropertyName("message")] GroqMessage? Message);

    private record GroqChatResponse(
        [property: JsonPropertyName("choices")] List<GroqChoice>? Choices);
}
