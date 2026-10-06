using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

/// <summary>Seam for waiting between geocoding requests, so tests can observe delays without sleeping.</summary>
public interface IGeocodingDelay
{
    Task DelayAsync(TimeSpan delay, CancellationToken ct);
}

public class TaskGeocodingDelay : IGeocodingDelay
{
    public Task DelayAsync(TimeSpan delay, CancellationToken ct) => Task.Delay(delay, ct);
}

/// <summary>
/// App-wide limiter: keeps successive Nominatim requests at least <see cref="GeocodingOptions.DelayBetweenRequestsMs"/>
/// apart, across all concurrent requests (registered as a singleton).
/// </summary>
public class GeocodingThrottle
{
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly IGeocodingDelay _delayer;
    private readonly TimeSpan _minGap;
    private long? _lastStart;

    public GeocodingThrottle(IOptions<GeocodingOptions> options, IGeocodingDelay delayer)
    {
        _delayer = delayer;
        _minGap = TimeSpan.FromMilliseconds(Math.Max(0, options.Value.DelayBetweenRequestsMs));
    }

    public async Task WaitTurnAsync(CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_lastStart is { } last && _minGap > TimeSpan.Zero)
            {
                var wait = _minGap - Stopwatch.GetElapsedTime(last);
                if (wait > TimeSpan.Zero) await _delayer.DelayAsync(wait, ct);
            }
            _lastStart = Stopwatch.GetTimestamp();
        }
        finally
        {
            _gate.Release();
        }
    }
}

public record GeocodedPoint(double Latitude, double Longitude);

public interface IPackageLocationGeocoder
{
    /// <summary>
    /// Looks a place name up in Sri Lanka. Returns null when nothing trustworthy is found: coordinates are
    /// accepted only if the top suggestion has them and its name contains the first word of the query.
    /// Never throws except for cancellation.
    /// </summary>
    Task<GeocodedPoint?> LookupAsync(string name, CancellationToken ct);
}

public class PackageLocationGeocoder : IPackageLocationGeocoder
{
    private readonly ILocationSearchService _search;
    private readonly GeocodingThrottle _throttle;
    private readonly ILogger<PackageLocationGeocoder> _logger;

    public PackageLocationGeocoder(ILocationSearchService search, GeocodingThrottle throttle, ILogger<PackageLocationGeocoder> logger)
    {
        _search = search;
        _throttle = throttle;
        _logger = logger;
    }

    public async Task<GeocodedPoint?> LookupAsync(string name, CancellationToken ct)
    {
        var query = name.Trim();
        if (query.Length == 0) return null;

        try
        {
            await _throttle.WaitTurnAsync(ct);
            var suggestions = await _search.SearchAsync(query, ct);
            var top = suggestions.FirstOrDefault();
            if (top?.Latitude is not { } lat || top.Longitude is not { } lon) return null;

            var firstWord = query.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)[0].Trim(',', '.');
            if (!top.Name.Contains(firstWord, StringComparison.OrdinalIgnoreCase)) return null;

            return new GeocodedPoint(lat, lon);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Geocoding '{Name}' failed; leaving it without coordinates.", name);
            return null;
        }
    }
}

public record LocationResolution(int Updated, IReadOnlyList<string> NotFound, int SkippedForBudget);

public interface IPackageLocationResolver
{
    /// <summary>
    /// Fills coordinates for locations that have none (both null). Coordinates that are already set, whether
    /// entered manually or found earlier, are never touched. Reuses coordinates of a same-named location
    /// before calling the geocoder, and makes at most <paramref name="maxLookups"/> lookups.
    /// </summary>
    Task<LocationResolution> ResolveAsync(IReadOnlyCollection<PackageLocation> locations, int maxLookups, CancellationToken ct);
}

public class PackageLocationResolver : IPackageLocationResolver
{
    private readonly TrailWiseDbContext _db;
    private readonly IPackageLocationGeocoder _geocoder;

    public PackageLocationResolver(TrailWiseDbContext db, IPackageLocationGeocoder geocoder)
    {
        _db = db;
        _geocoder = geocoder;
    }

    public async Task<LocationResolution> ResolveAsync(IReadOnlyCollection<PackageLocation> locations, int maxLookups, CancellationToken ct)
    {
        var groups = locations
            .Where(l => l.Latitude is null && l.Longitude is null && !string.IsNullOrWhiteSpace(l.Name))
            .GroupBy(l => l.Name.Trim().ToLowerInvariant())
            .ToList();

        var updated = 0;
        var notFound = new List<string>();
        var skipped = 0;
        var lookups = 0;

        foreach (var group in groups)
        {
            var key = group.Key;
            var known = await _db.PackageLocations
                .AsNoTracking()
                .Where(l => l.Latitude != null && l.Longitude != null && l.Name.ToLower() == key)
                .Select(l => new GeocodedPoint(l.Latitude!.Value, l.Longitude!.Value))
                .FirstOrDefaultAsync(ct);

            if (known is null)
            {
                if (lookups >= maxLookups)
                {
                    skipped += group.Count();
                    continue;
                }

                lookups++;
                known = await _geocoder.LookupAsync(group.First().Name, ct);
            }

            if (known is null)
            {
                notFound.Add(group.First().Name.Trim());
                continue;
            }

            foreach (var location in group)
            {
                location.Latitude = known.Latitude;
                location.Longitude = known.Longitude;
                updated++;
            }
        }

        return new LocationResolution(updated, notFound, skipped);
    }
}
