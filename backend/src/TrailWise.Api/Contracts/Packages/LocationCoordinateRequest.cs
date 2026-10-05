using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Packages;

/// <summary>
/// Manually set (or correct) the coordinates of one of the package's locations, matched to
/// <c>LocationNames</c> by trimmed, case-insensitive name. Manually set coordinates are never
/// overwritten by geocoding.
/// </summary>
public class LocationCoordinateRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, Range(-90, 90)]
    public double? Latitude { get; set; }

    [Required, Range(-180, 180)]
    public double? Longitude { get; set; }
}

public record GeocodeBackfillResultDto(
    int Processed,
    int Updated,
    IReadOnlyList<string> NotFound,
    int Remaining,
    int NextSkip);
