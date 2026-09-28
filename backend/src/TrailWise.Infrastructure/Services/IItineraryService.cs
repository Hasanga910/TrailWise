using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public interface IItineraryService
{
    Task<IReadOnlyList<ItineraryStep>> GetItineraryAsync(Guid bookingId, CancellationToken ct = default);
    Task<IReadOnlyList<ItineraryStep>> SetItineraryAsync(Guid bookingId, IEnumerable<ItineraryStep> newSteps, CancellationToken ct = default);
}
