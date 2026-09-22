using TrailWise.Domain.Entities;

namespace TrailWise.Api.Contracts.Reviews;

public record ReviewDto(
    Guid Id,
    Guid BookingId,
    int Rating,
    string? Comment,
    DateTimeOffset SubmittedAt)
{
    public static ReviewDto FromEntity(Review review) => new(
        review.Id,
        review.BookingId,
        review.Rating,
        review.Comment,
        review.SubmittedAt);
}
