using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace TrailWise.Infrastructure.Services;

public class NominatimLocationSearchService : ILocationSearchService
{
    public const string HttpClientName = "Nominatim";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<NominatimLocationSearchService> _logger;

    public NominatimLocationSearchService(IHttpClientFactory httpClientFactory, ILogger<NominatimLocationSearchService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<IReadOnlyList<LocationSuggestion>> SearchAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<LocationSuggestion>();
        }

        var client = _httpClientFactory.CreateClient(HttpClientName);
        var requestUri = $"search?format=json&q={Uri.EscapeDataString(query.Trim())}&countrycodes=lk&limit=8&addressdetails=0";

        try
        {
            var results = await client.GetFromJsonAsync<List<NominatimResult>>(requestUri, ct);
            if (results is null)
            {
                return Array.Empty<LocationSuggestion>();
            }

            return results
                .Where(r => !string.IsNullOrWhiteSpace(r.DisplayName))
                .Select(r => new LocationSuggestion(
                    r.DisplayName!,
                    double.TryParse(r.Lat, out var lat) ? lat : null,
                    double.TryParse(r.Lon, out var lon) ? lon : null))
                .ToList();
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            _logger.LogWarning(ex, "Location search against Nominatim failed for query '{Query}'.", query);
            return Array.Empty<LocationSuggestion>();
        }
    }

    private class NominatimResult
    {
        [JsonPropertyName("display_name")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("lat")]
        public string? Lat { get; set; }

        [JsonPropertyName("lon")]
        public string? Lon { get; set; }
    }
}
