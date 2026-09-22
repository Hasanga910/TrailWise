using System.Text.Json;

namespace TrailWise.Infrastructure.Agents;

internal static class AgentJsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web);
}
