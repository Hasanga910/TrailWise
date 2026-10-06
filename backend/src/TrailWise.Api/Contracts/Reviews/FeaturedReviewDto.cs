using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Contracts.Reviews;

/// <summary>Public testimonial. Same privacy rules as <see cref="PublicReviewDto"/>: no traveler or booking identifiers.</summary>
public record FeaturedReviewDto(
    Guid Id,
    int Rating,
    string Comment,
    DateTimeOffset SubmittedAt,
    Guid PackageId,
    string PackageName,
    string ReviewerDisplayName)
{
    public static FeaturedReviewDto FromModel(FeaturedReview review) => new(
        review.Id,
        review.Rating,
        review.Comment,
        review.SubmittedAt,
        review.PackageId,
        review.PackageName,
        PublicReviewDto.DefaultReviewerDisplayName);
}
