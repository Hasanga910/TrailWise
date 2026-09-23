using Microsoft.EntityFrameworkCore;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class ItineraryService : IItineraryService
{
    private readonly TrailWiseDbContext _db;

    public ItineraryService(TrailWiseDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<ItineraryStep>> GetItineraryAsync(Guid bookingId, CancellationToken ct = default)
    {
        return await _db.ItinerarySteps
            .AsNoTracking()
            .Where(s => s.BookingId == bookingId)
            .OrderBy(s => s.DayNumber)
            .ThenBy(s => s.StartTime)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<ItineraryStep>> SetItineraryAsync(Guid bookingId, IEnumerable<ItineraryStep> newSteps, CancellationToken ct = default)
    {
        if (_db.Database.IsRelational())
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var existingSteps = await _db.ItinerarySteps
                .Where(s => s.BookingId == bookingId)
                .ToListAsync(ct);

            _db.ItinerarySteps.RemoveRange(existingSteps);

            var stepsToAdd = newSteps.ToList();
            foreach (var step in stepsToAdd)
            {
                step.BookingId = bookingId;
                if (step.Id == Guid.Empty)
                {
                    step.Id = Guid.NewGuid();
                }
                step.CreatedAt = DateTime.UtcNow;
                step.UpdatedAt = DateTime.UtcNow;
            }

            _db.ItinerarySteps.AddRange(stepsToAdd);
            await _db.SaveChangesAsync(ct);

            await tx.CommitAsync(ct);
        }
        else
        {
            var existingSteps = await _db.ItinerarySteps
                .Where(s => s.BookingId == bookingId)
                .ToListAsync(ct);

            _db.ItinerarySteps.RemoveRange(existingSteps);

            var stepsToAdd = newSteps.ToList();
            foreach (var step in stepsToAdd)
            {
                step.BookingId = bookingId;
                if (step.Id == Guid.Empty)
                {
                    step.Id = Guid.NewGuid();
                }
                step.CreatedAt = DateTime.UtcNow;
                step.UpdatedAt = DateTime.UtcNow;
            }

            _db.ItinerarySteps.AddRange(stepsToAdd);
            await _db.SaveChangesAsync(ct);
        }

        return await _db.ItinerarySteps
            .AsNoTracking()
            .Where(s => s.BookingId == bookingId)
            .OrderBy(s => s.DayNumber)
            .ThenBy(s => s.StartTime)
            .ToListAsync(ct);
    }
}
