namespace TrailWise.Infrastructure.Services;

/// <summary>
/// The cancellation-window rule, in plain code rather than left to an agent or an LLM (design doc 8.4).
/// </summary>
public static class CancellationPolicy
{
    /// <summary>
    /// A pending refund exception whose tour starts within this many days (or has already started)
    /// is flagged urgent on the Ops dashboard.
    /// </summary>
    public const int UrgentRefundExceptionDays = 2;

    public static bool IsUrgent(int daysUntilStart) => daysUntilStart <= UrgentRefundExceptionDays;

    /// <summary>Whole days from <paramref name="today"/> until the tour starts (negative once it has started).</summary>
    public static int DaysUntilStart(DateOnly today, DateOnly startDate) => startDate.DayNumber - today.DayNumber;

    /// <summary>
    /// True when a traveler's cancellation is a refund exception: it falls fewer than
    /// <paramref name="windowDays"/> days before the start date and an approved payment exists.
    /// Exactly <paramref name="windowDays"/> days before the start is still a standard cancellation.
    /// </summary>
    public static bool RequiresApproval(DateOnly today, DateOnly startDate, int windowDays, bool hasApprovedPayment) =>
        hasApprovedPayment && DaysUntilStart(today, startDate) < windowDays;
}
