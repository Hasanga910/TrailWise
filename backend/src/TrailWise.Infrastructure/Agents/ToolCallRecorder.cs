using System.Diagnostics;
using System.Text.Json;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// The tool names from the design document's allow-list (section 8.4: guide-availability read tool,
/// vehicle-availability read/write tool, pricing calculator, structured-output formatter). Only these
/// are recorded as tools; checks done in plain code are recorded as
/// <see cref="DeterministicRuleCheck"/>, which is deliberately not an allow-listed tool.
/// </summary>
public static class AgentTools
{
    public const string GuideAvailabilityRead = "guide_availability_read";
    public const string VehicleAvailabilityRead = "vehicle_availability_read";
    public const string VehicleAvailabilityWrite = "vehicle_availability_write";
    public const string PricingCalculator = "pricing_calculator";
    public const string StructuredOutputFormatter = "structured_output_formatter";
    public const string DeterministicRuleCheck = "deterministic_rule_check";
}

/// <summary>One tool call: what was called, a short non-sensitive summary of input and result, and timing.</summary>
public sealed record ToolCall(string Tool, string Input, string Result, string Status, long DurationMs);

/// <summary>
/// Collects the tool calls made while a workflow runs (scoped: one workflow, one scope). The
/// coordinator drains it after each step into AgentStepLog.ToolCallsJson. Summaries must contain ids
/// and counts only, never names, contact details, free text or secrets; the JSON is also passed
/// through <see cref="JsonRedactor"/> (design doc 8.4).
/// </summary>
public interface IToolCallRecorder
{
    void Record(ToolCall call);

    /// <summary>Returns the calls recorded since the last drain as redacted JSON (null when none).</summary>
    string? DrainJson();
}

public sealed class ToolCallRecorder : IToolCallRecorder
{
    private readonly List<ToolCall> _calls = new();
    private readonly object _gate = new();

    public void Record(ToolCall call)
    {
        lock (_gate)
        {
            _calls.Add(call);
        }
    }

    public string? DrainJson()
    {
        List<ToolCall> calls;
        lock (_gate)
        {
            if (_calls.Count == 0)
            {
                return null;
            }

            calls = _calls.ToList();
            _calls.Clear();
        }

        return JsonRedactor.RedactToString(JsonSerializer.Serialize(calls, AgentJsonOptions.Default));
    }
}

public static class ToolCallRecorderExtensions
{
    private const int MaxSummaryLength = 200;

    /// <summary>
    /// Runs <paramref name="call"/>, timing it, and records it. A null recorder just runs the call, so
    /// agents built without one (unit tests, mocks) behave exactly as before. A failure is recorded and rethrown.
    /// </summary>
    public static async Task<T> TrackAsync<T>(
        this IToolCallRecorder? recorder, string tool, string input, Func<Task<T>> call, Func<T, string> summarize)
    {
        if (recorder is null)
        {
            return await call();
        }

        var sw = Stopwatch.StartNew();
        try
        {
            var result = await call();
            sw.Stop();
            recorder.Record(new ToolCall(tool, Trim(input), Trim(summarize(result)), "ok", sw.ElapsedMilliseconds));
            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            recorder.Record(new ToolCall(tool, Trim(input), Trim($"failed: {ex.GetType().Name}"), "error", sw.ElapsedMilliseconds));
            throw;
        }
    }

    /// <summary>Records a call whose work was done inline (timed by the caller).</summary>
    public static void RecordCall(this IToolCallRecorder? recorder, string tool, string input, string result, long durationMs, bool ok = true) =>
        recorder?.Record(new ToolCall(tool, Trim(input), Trim(result), ok ? "ok" : "error", durationMs));

    private static string Trim(string value) =>
        value.Length <= MaxSummaryLength ? value : value[..MaxSummaryLength] + "…";
}
