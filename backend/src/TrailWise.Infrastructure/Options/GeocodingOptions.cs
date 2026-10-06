namespace TrailWise.Infrastructure.Options;

public class GeocodingOptions
{
    public const string SectionName = "Geocoding";

    /// <summary>Minimum gap between Nominatim requests. Their usage policy allows at most 1 request per second.</summary>
    public int DelayBetweenRequestsMs { get; set; } = 1100;

    /// <summary>Upper bound on lookups made while saving a single package, so saving stays responsive.</summary>
    public int MaxLookupsPerSave { get; set; } = 6;

    /// <summary>Total time a save may spend geocoding before it gives up and leaves the rest for the backfill.</summary>
    public int SaveTimeBudgetSeconds { get; set; } = 8;

    /// <summary>Location rows processed per call of the admin backfill endpoint.</summary>
    public int BackfillBatchSize { get; set; } = 25;
}
