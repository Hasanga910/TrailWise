using System.Collections.Concurrent;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Tests;

/// <summary>Deterministic stand-in for Nominatim so tests never touch the network.</summary>
public class FakeLocationSearchService : ILocationSearchService
{
    private static readonly Dictionary<string, (double Lat, double Lon)> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Kandy"] = (7.2906, 80.6337),
        ["Ella"] = (6.8667, 81.0466),
        ["Galle"] = (6.0535, 80.2210),
        ["Mirissa"] = (5.9483, 80.4716),
        ["Sigiriya"] = (7.9570, 80.7603),
        ["Yala"] = (6.3725, 81.5185),
        ["Colombo"] = (6.9271, 79.8612),
        ["Nuwara Eliya"] = (6.9497, 80.7891)
    };

    private readonly ConcurrentQueue<string> _queries = new();

    /// <summary>When true every search returns nothing, like a Nominatim outage.</summary>
    public volatile bool Offline;

    public IReadOnlyCollection<string> Queries => _queries.ToArray();
    public int Calls => _queries.Count;

    public void Reset()
    {
        Offline = false;
        while (_queries.TryDequeue(out _)) { }
    }

    public Task<IReadOnlyList<LocationSuggestion>> SearchAsync(string query, CancellationToken ct = default)
    {
        _queries.Enqueue(query);
        if (Offline) return Task.FromResult<IReadOnlyList<LocationSuggestion>>(Array.Empty<LocationSuggestion>());

        var q = query.Trim();
        IReadOnlyList<LocationSuggestion> result = q.Equals("Wellawatte", StringComparison.OrdinalIgnoreCase)
            ? new[] { new LocationSuggestion("Totally Different Place, Sri Lanka", 1.0, 1.0) }
            : Known.TryGetValue(q, out var p)
                ? new[] { new LocationSuggestion($"{q}, Central Province, Sri Lanka", p.Lat, p.Lon) }
                : Array.Empty<LocationSuggestion>();
        return Task.FromResult(result);
    }
}
