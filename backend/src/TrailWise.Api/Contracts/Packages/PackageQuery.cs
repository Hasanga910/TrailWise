using Microsoft.AspNetCore.Mvc;
using TrailWise.Domain.Enums;

namespace TrailWise.Api.Contracts.Packages;

public enum PackageSort
{
    Name,
    Price,
    Duration,
    Rating
}

public enum SortDirection
{
    Asc,
    Desc
}

/// <summary>
/// Optional filters for <c>GET /api/packages</c>. Every property is optional so existing callers
/// that send no query string keep getting the full list. Enum values bind case-insensitively and
/// invalid values produce a 400 automatically.
/// </summary>
public class PackageQuery
{
    /// <summary>Case-insensitive text match on package name, theme or location name.</summary>
    [FromQuery(Name = "q")] public string? Q { get; set; }
    public string? Theme { get; set; }
    public int? MinDays { get; set; }
    public int? MaxDays { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public ClassType? ClassType { get; set; }
    public bool? IncludesFood { get; set; }
    public bool? RequiresAC { get; set; }
    /// <summary>Only packages whose maximum group size can fit this many guests.</summary>
    public int? Guests { get; set; }
    public double? MinRating { get; set; }
    /// <summary>When omitted the natural (database) order is kept, so existing callers see no change.</summary>
    public PackageSort? Sort { get; set; }
    /// <summary>Defaults to ascending, except rating which defaults to descending.</summary>
    public SortDirection? Dir { get; set; }

    public bool HasTierFilters =>
        ClassType.HasValue || IncludesFood.HasValue || RequiresAC.HasValue || MinPrice.HasValue || MaxPrice.HasValue;
}
