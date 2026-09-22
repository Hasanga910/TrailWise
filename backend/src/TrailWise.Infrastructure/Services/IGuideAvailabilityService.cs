namespace TrailWise.Infrastructure.Services;

public interface IGuideAvailabilityService
{
    Task<bool> IsGuideAvailableAsync(
        Guid guideId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken ct = default);
}
