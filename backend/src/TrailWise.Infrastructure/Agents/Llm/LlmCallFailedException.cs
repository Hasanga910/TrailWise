namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// The single failure signal thrown by every <see cref="ILlmClient"/> implementation —
/// whether the cause is a disabled kill switch, a connection/timeout error, or a schema
/// mismatch that survived retries. Callers (agents) catch this one type to fall back safely;
/// no other exception type should ever escape an <see cref="ILlmClient"/> call.
/// </summary>
public class LlmCallFailedException : Exception
{
    public LlmCallFailedException(string message) : base(message)
    {
    }

    public LlmCallFailedException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
