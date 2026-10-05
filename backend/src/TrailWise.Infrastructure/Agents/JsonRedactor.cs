using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Parses stored agent JSON for the workflow monitor and blanks out anything that looks like a
/// secret. Design doc 8.4 says no secrets, tokens or card details are persisted in step logs; this is
/// defence in depth so that a mistake in the future can never be shown in the UI.
/// </summary>
public static partial class JsonRedactor
{
    public const string Placeholder = "[redacted]";

    [GeneratedRegex("(password|passwd|secret|token|api[-_]?key|authorization|card[-_]?number|cvv|cvc|credential)", RegexOptions.IgnoreCase)]
    private static partial Regex SensitiveKey();

    /// <summary>Redacts a JSON string; returns null for empty or malformed JSON.</summary>
    public static string? RedactToString(string? json) => ParseAndRedact(json)?.GetRawText();

    /// <summary>Returns null for empty or malformed JSON.</summary>
    public static JsonElement? ParseAndRedact(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return null;
        }

        try
        {
            var node = JsonNode.Parse(json);
            if (node is null)
            {
                return null;
            }

            Redact(node);
            return JsonSerializer.SerializeToElement(node);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static void Redact(JsonNode node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var key in obj.Select(p => p.Key).ToList())
                {
                    if (SensitiveKey().IsMatch(key))
                    {
                        obj[key] = Placeholder;
                    }
                    else if (obj[key] is JsonNode child)
                    {
                        Redact(child);
                    }
                }
                break;
            case JsonArray array:
                foreach (var item in array)
                {
                    if (item is not null)
                    {
                        Redact(item);
                    }
                }
                break;
        }
    }
}
