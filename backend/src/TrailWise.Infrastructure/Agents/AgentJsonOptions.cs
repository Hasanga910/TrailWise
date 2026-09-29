using System.Text.Json;

namespace TrailWise.Infrastructure.Agents;

public static class AgentJsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web);
}
