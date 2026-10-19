using System.Text.Json;
using System.Text.Json.Serialization;

namespace TrailWise.Infrastructure.Agents;

public static class AgentJsonOptions
{
    public static readonly JsonSerializerOptions Default = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };
}