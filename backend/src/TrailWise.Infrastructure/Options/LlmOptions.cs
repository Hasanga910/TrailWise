namespace TrailWise.Infrastructure.Options;

public class LlmOptions
{
    public const string SectionName = "Llm";

    public bool Enabled { get; set; }
    public string BaseUrl { get; set; } = "https://api.groq.com/openai/v1/";
    public string ApiKey { get; set; } = string.Empty;
    public string ExtractionModel { get; set; } = "llama-3.1-8b-instant";
    public string SummaryModel { get; set; } = "llama-3.3-70b-versatile";
    public int TimeoutSeconds { get; set; } = 20;
    public int MaxRetries { get; set; } = 2;
    public int MaxOutputTokens { get; set; } = 512;
}
