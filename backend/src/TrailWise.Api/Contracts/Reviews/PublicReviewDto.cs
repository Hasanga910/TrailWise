using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Reviews;

public record PublicReviewDto(
    Guid Id,
    int Rating,
    string? Comment,
    DateTimeOffset SubmittedAt,
    string ReviewerDisplayName,
    bool IsVerifiedTrip)
{
    public const string DefaultReviewerDisplayName = "Verified Traveler";

    public static PublicReviewDto FromEntity(Review review) => new(
        review.Id,
        review.Rating,
        review.Comment,
        review.SubmittedAt,
        DefaultReviewerDisplayName,
        true);
}
