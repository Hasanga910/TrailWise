namespace TrailWise.Infrastructure.Services;

public record LocationSuggestion(string Name, double? Latitude, double? Longitude);

public interface ILocationSearchService
{
    Task<IReadOnlyList<LocationSuggestion>> SearchAsync(string query, CancellationToken ct = default);
}
