namespace TrailWise.Api.Contracts.Packages;

/// <summary>Bounds and options for the public explorer's filter bar.</summary>
public record PackageFacetsDto(
    IReadOnlyList<string> Themes,
    decimal MinPrice,
    decimal MaxPrice,
    int MinDays,
    int MaxDays,
    int MaxGroupSize);
