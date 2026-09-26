using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Infrastructure.Agents;

/// <summary>
/// Real implementation of Person 2's Guide Matching Agent (Phase E1).
/// Evaluates candidate guides deterministically based on specialization (TourPackage.Theme)
/// and calendar availability via IGuideAvailabilityService.
/// Does NOT perform guide assignment or database writes.
/// </summary>
public class GuideMatchingAgent : IGuideMatchingAgent
{
    private readonly TrailWiseDbContext _db;
    private readonly IGuideAvailabilityService _availabilityService;
    private readonly ILogger<GuideMatchingAgent> _logger;

    public GuideMatchingAgent(
        TrailWiseDbContext db,
        IGuideAvailabilityService availabilityService,
        ILogger<GuideMatchingAgent> logger)
    {
        _db = db;
        _availabilityService = availabilityService;
        _logger = logger;
    }

    public async Task<GuideMatchResult> MatchAsync(Guid bookingId, CancellationToken ct = default)
    {
        try
        {
            // TASK 1: Load Booking Data using AsNoTracking and Include TourPackage
            var booking = await _db.Bookings
                .AsNoTracking()
                .Include(b => b.TourPackage)
                .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

            if (booking is null)
            {
                _logger.LogWarning("Booking {BookingId} not found during guide matching.", bookingId);
                return new GuideMatchResult(
                    Guid.Empty,
                    0,
                    "Booking not found.");
            }

            if (booking.TourPackage is null)
            {
                _logger.LogWarning("Booking {BookingId} has no associated TourPackage.", bookingId);
                return new GuideMatchResult(
                    Guid.Empty,
                    0,
                    "Booking does not have an associated tour package.");
            }

            var theme = booking.TourPackage.Theme?.Trim();
            if (string.IsNullOrWhiteSpace(theme))
            {
                _logger.LogWarning("TourPackage {PackageId} for booking {BookingId} has no theme specified.", booking.TourPackage.Id, bookingId);
                return new GuideMatchResult(
                    Guid.Empty,
                    0,
                    "Tour package does not specify a theme for guide specialization matching.");
            }

            // TASK 2: Candidate Guide Filtering
            // Query guides from database
            var guides = await _db.Guides
                .AsNoTracking()
                .ToListAsync(ct);

            // Filter guides whose specializations match TourPackage.Theme (case-insensitive, trimmed)
            var specializationCandidates = guides
                .Where(g => g.Specializations != null && g.Specializations.Any(s =>
                    !string.IsNullOrWhiteSpace(s) &&
                    string.Equals(s.Trim(), theme, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            if (specializationCandidates.Count == 0)
            {
                _logger.LogInformation("No guide with {Theme} specialization found for booking {BookingId}.", theme, bookingId);
                return new GuideMatchResult(
                    Guid.Empty,
                    0,
                    $"No guide with {theme} specialization is available for the requested dates.");
            }

            // Evaluate availability and deterministic score for each candidate
            var qualifiedCandidates = new List<(Domain.Entities.Guide Guide, double Score, bool HasBufferBonus)>();

            foreach (var guide in specializationCandidates)
            {
                // Must be available for the complete booking date range
                var isAvailable = await _availabilityService.IsGuideAvailableAsync(
                    guide.Id,
                    booking.StartDate,
                    booking.EndDate,
                    ct);

                if (!isAvailable)
                {
                    continue;
                }

                // TASK 4: Buffer-Day Check
                // Inspect day immediately before (StartDate - 1) and immediately after (EndDate + 1)
                var beforeBufferFree = false;
                try
                {
                    var beforeDate = booking.StartDate.AddDays(-1);
                    beforeBufferFree = await _availabilityService.IsGuideAvailableAsync(
                        guide.Id,
                        beforeDate,
                        beforeDate,
                        ct);
                }
                catch (ArgumentOutOfRangeException)
                {
                    beforeBufferFree = false;
                }

                var afterBufferFree = false;
                try
                {
                    var afterDate = booking.EndDate.AddDays(1);
                    afterBufferFree = await _availabilityService.IsGuideAvailableAsync(
                        guide.Id,
                        afterDate,
                        afterDate,
                        ct);
                }
                catch (ArgumentOutOfRangeException)
                {
                    afterBufferFree = false;
                }

                var hasBufferBonus = beforeBufferFree && afterBufferFree;

                // TASK 3: Deterministic Scoring
                // Base specialization match = 0.7; Buffer-day bonus = 0.3 if both buffer days are free.
                var score = hasBufferBonus ? 1.0 : 0.7;

                qualifiedCandidates.Add((guide, score, hasBufferBonus));
            }

            if (qualifiedCandidates.Count == 0)
            {
                _logger.LogInformation(
                    "No guide with {Theme} specialization is available for booking {BookingId} between {StartDate} and {EndDate}.",
                    theme, bookingId, booking.StartDate, booking.EndDate);
                return new GuideMatchResult(
                    Guid.Empty,
                    0,
                    $"No guide with {theme} specialization is available for the requested dates.");
            }

            // TASK 5: Choose Candidate
            // Sort by MatchScore descending, then tie-breakers: Name ascending, then Id ascending
            var bestCandidate = qualifiedCandidates
                .OrderByDescending(c => c.Score)
                .ThenBy(c => c.Guide.Name, StringComparer.Ordinal)
                .ThenBy(c => c.Guide.Id)
                .First();

            var bufferText = bestCandidate.HasBufferBonus
                ? "with free buffer days"
                : "without free buffer days";

            // LANGUAGE NOTE:
            // Language matching was omitted from candidate filtering and scoring because the
            // current Booking model has no LanguagePreference field.
            var reasoning = $"Guide {bestCandidate.Guide.Name} matched the {theme} specialization and is available for the full booking period {bufferText}. Language matching was not evaluated because the current Booking model does not store LanguagePreference.";

            _logger.LogInformation(
                "Matched guide {GuideId} ({GuideName}) for booking {BookingId} with score {Score}. {Reasoning}",
                bestCandidate.Guide.Id, bestCandidate.Guide.Name, bookingId, bestCandidate.Score, reasoning);

            return new GuideMatchResult(
                bestCandidate.Guide.Id,
                bestCandidate.Score,
                reasoning);
        }
        catch (Exception ex)
        {
            // TASK 6: Error Handling
            _logger.LogError(ex, "Error executing GuideMatchingAgent for booking {BookingId}", bookingId);
            return new GuideMatchResult(
                Guid.Empty,
                0,
                "Guide matching could not be completed.");
        }
    }
}
