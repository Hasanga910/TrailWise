using System.Text.Json;

namespace TrailWise.Infrastructure.Services;

internal static class AgentJsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web);
}
