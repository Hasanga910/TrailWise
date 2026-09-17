using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Contracts.Locations;

public record LocationSuggestionDto(string Name, double? Latitude, double? Longitude)
{
    public static LocationSuggestionDto FromSuggestion(LocationSuggestion suggestion) =>
        new(suggestion.Name, suggestion.Latitude, suggestion.Longitude);
}
