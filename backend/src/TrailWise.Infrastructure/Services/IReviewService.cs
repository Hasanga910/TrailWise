using TrailWise.Domain.Entities;

namespace TrailWise.Infrastructure.Services;

public class SubmitReviewResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Review? Review { get; init; }

    public static SubmitReviewResult Success(Review review) => new()
    {
        Succeeded = true,
        Review = review,
        StatusCode = 201
    };

    public static SubmitReviewResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public class PackageReviewsResult
{
    public bool Succeeded { get; init; }
    public string? Error { get; init; }
    public int StatusCode { get; init; }
    public Guid TourPackageId { get; init; }
    public double AverageRating { get; init; }
    public int TotalReviews { get; init; }
    public IReadOnlyList<Review> Reviews { get; init; } = Array.Empty<Review>();

    public static PackageReviewsResult Success(Guid tourPackageId, double averageRating, int totalReviews, IReadOnlyList<Review> reviews) => new()
    {
        Succeeded = true,
        TourPackageId = tourPackageId,
        AverageRating = averageRating,
        TotalReviews = totalReviews,
        Reviews = reviews,
        StatusCode = 200
    };

    public static PackageReviewsResult Failure(string error, int statusCode = 400) => new()
    {
        Succeeded = false,
        Error = error,
        StatusCode = statusCode
    };
}

public interface IReviewService
{
    Task<SubmitReviewResult> SubmitReviewAsync(
        Guid bookingId,
        int rating,
        string? comment,
        Guid travelerId,
        CancellationToken ct = default);

    Task<PackageReviewsResult> GetPackageReviewsAsync(
        Guid packageId,
        CancellationToken ct = default);
}
