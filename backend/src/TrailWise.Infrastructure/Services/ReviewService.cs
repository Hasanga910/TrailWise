using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Infrastructure.Services;

public class ReviewService : IReviewService
{
    private readonly TrailWiseDbContext _db;
    private readonly ILogger<ReviewService> _logger;

    public ReviewService(TrailWiseDbContext db, ILogger<ReviewService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<SubmitReviewResult> SubmitReviewAsync(
        Guid bookingId,
        int rating,
        string? comment,
        Guid travelerId,
        CancellationToken ct = default)
    {
        if (rating < 1 || rating > 5)
        {
            return SubmitReviewResult.Failure("Rating must be between 1 and 5.", 400);
        }

        var trimmedComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (trimmedComment != null && trimmedComment.Length > 2000)
        {
            return SubmitReviewResult.Failure("Comment cannot exceed 2000 characters.", 400);
        }

        var booking = await _db.Bookings
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null)
        {
            return SubmitReviewResult.Failure("Booking not found.", 404);
        }

        if (booking.TravelerId != travelerId)
        {
            return SubmitReviewResult.Failure("Forbidden. You may only review your own booking.", 403);
        }

        if (booking.Status != BookingStatus.Completed)
        {
            return SubmitReviewResult.Failure("Reviews can only be submitted for completed bookings.", 400);
        }

        var reviewExists = await _db.Reviews.AnyAsync(r => r.BookingId == bookingId, ct);
        if (reviewExists)
        {
            return SubmitReviewResult.Failure("Review already submitted for this booking.", 409);
        }

        var review = new Review
        {
            BookingId = bookingId,
            Rating = rating,
            Comment = trimmedComment,
            SubmittedAt = DateTimeOffset.UtcNow
        };

        _db.Reviews.Add(review);
        await _db.SaveChangesAsync(ct);

        _logger.LogInformation("Review {ReviewId} with rating {Rating} submitted for booking {BookingId}",
            review.Id, rating, bookingId);

        return SubmitReviewResult.Success(review);
    }

    public async Task<PackageReviewsResult> GetPackageReviewsAsync(
        Guid packageId,
        CancellationToken ct = default)
    {
        var packageExists = await _db.TourPackages.AnyAsync(p => p.Id == packageId, ct);
        if (!packageExists)
        {
            return PackageReviewsResult.Failure("Tour package not found.", 404);
        }

        var reviews = await _db.Reviews
            .AsNoTracking()
            .Where(r => r.Booking.TourPackageId == packageId)
            .OrderByDescending(r => r.SubmittedAt)
            .ToListAsync(ct);

        var totalReviews = reviews.Count;
        var averageRating = totalReviews > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : 0.0;

        return PackageReviewsResult.Success(packageId, averageRating, totalReviews, reviews);
    }
}
