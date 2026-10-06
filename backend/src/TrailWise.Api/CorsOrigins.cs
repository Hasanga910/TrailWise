namespace TrailWise.Api;

/// <summary>Reads the allowed CORS origins from configuration.</summary>
public static class CorsOrigins
{
    private static readonly string[] Default = { "http://localhost:5173" };

    /// <summary>
    /// <c>Cors:AllowedOrigins</c> may be one comma-separated value (env var <c>Cors__AllowedOrigins=https://a.app,https://b.app</c>),
    /// which replaces the defaults, or the usual indexed array (<c>Cors:AllowedOrigins:0</c>, <c>:1</c>, ...).
    /// Trailing slashes are trimmed because a browser's Origin header never has one.
    /// </summary>
    public static string[] Read(IConfiguration configuration)
    {
        var section = configuration.GetSection("Cors:AllowedOrigins");
        IEnumerable<string> candidates = !string.IsNullOrWhiteSpace(section.Value)
            ? section.Value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            : section.Get<string[]>() ?? Default;

        var origins = candidates
            .Select(o => o.Trim().TrimEnd('/'))
            .Where(o => o.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return origins.Length > 0 ? origins : Default;
    }
}
