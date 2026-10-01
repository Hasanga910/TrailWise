namespace TrailWise.Api.Contracts.Reviews;

public record PackageReviewsDto(
    Guid TourPackageId,
    double AverageRating,
    int TotalReviews,
    IReadOnlyList<PublicReviewDto> Reviews);
