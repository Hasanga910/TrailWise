using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class GuideAvailabilityService : IGuideAvailabilityService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<GuideAvailabilityService> _logger;

    public GuideAvailabilityService(TrailWiseDbContext db, ILogger<GuideAvailabilityService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> IsGuideAvailableAsync(
        Guid guideId,
        DateOnly startDate,
        DateOnly endDate,
        CancellationToken ct = default)
    {
        if (startDate > endDate)
        {
            return false;
        }

        var guideExists = await _db.Guides
            .AsNoTracking()
            .AnyAsync(g => g.Id == guideId, ct);

        if (!guideExists)
        {
            _logger.LogWarning("IsGuideAvailableAsync called for nonexistent guide {GuideId}", guideId);
            return false;
        }

        // A guide is NOT available if ANY GuideAvailability row in [startDate, endDate] has
        // IsAvailable == false OR AssignedBookingId != null.
        // A date with NO GuideAvailability row is treated as available by default.
        var hasConflict = await _db.GuideAvailabilities
            .AsNoTracking()
            .AnyAsync(a =>
                a.GuideId == guideId
                && a.Date >= startDate
                && a.Date <= endDate
                && (!a.IsAvailable || a.AssignedBookingId != null),
                ct);

        return !hasConflict;
    }
}
