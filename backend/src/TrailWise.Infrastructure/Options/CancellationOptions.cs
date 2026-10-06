namespace TrailWise.Infrastructure.Options;

public class CancellationOptions
{
    public const string SectionName = "Cancellation";

    /// <summary>
    /// A traveler who cancels fewer than this many days before the start date, with an approved
    /// payment on the booking, needs the Operations Manager's approval (design doc 8.3
    /// "Cancellation / Refund Exception"). Cancelling earlier is a standard cancellation.
    /// </summary>
    public int RefundWindowDays { get; set; } = 7;
}
