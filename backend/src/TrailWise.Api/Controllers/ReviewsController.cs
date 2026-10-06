using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Reviews;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Api.Controllers;

[ApiController]
public class ReviewsController : ControllerBase
{
    private readonly IReviewService _reviewService;

    public ReviewsController(IReviewService reviewService)
    {
        _reviewService = reviewService;
    }

    [HttpPost("api/bookings/{id:guid}/reviews")]
    [Authorize]
    public async Task<ActionResult<ReviewDto>> SubmitReview(Guid id, [FromBody] CreateReviewRequest request, CancellationToken ct)
    {
        var travelerId = GetUserId();
        if (travelerId is null)
        {
            return Unauthorized();
        }

        if (request.Rating < 1 || request.Rating > 5)
        {
            return BadRequest(new
            {
                errors = new[] { new FieldValidationError("rating", "Rating must be between 1 and 5.") }
            });
        }

        var result = await _reviewService.SubmitReviewAsync(id, request.Rating, request.Comment, travelerId.Value, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                StatusCodes.Status403Forbidden => Forbid(),
                StatusCodes.Status409Conflict => Problem(statusCode: StatusCodes.Status409Conflict, title: result.Error),
                _ => BadRequest(new { message = result.Error })
            };
        }

        var dto = ReviewDto.FromEntity(result.Review!);
        return StatusCode(StatusCodes.Status201Created, dto);
    }

    /// <summary>Newest well-rated reviews across packages, for the public home page.</summary>
    [HttpGet("api/reviews/featured")]
    [AllowAnonymous]
    [EnableRateLimiting("PublicReadLimiter")]
    public async Task<ActionResult<IReadOnlyList<FeaturedReviewDto>>> GetFeatured([FromQuery] int limit = 6, CancellationToken ct = default)
    {
        var clamped = Math.Clamp(limit, 1, 12);
        var reviews = await _reviewService.GetFeaturedReviewsAsync(clamped, ct: ct);
        return Ok(reviews.Select(FeaturedReviewDto.FromModel).ToList());
    }

    [HttpGet("api/packages/{id:guid}/reviews")]
    [AllowAnonymous]
    [EnableRateLimiting("PublicReadLimiter")]
    public async Task<ActionResult<PackageReviewsDto>> GetPackageReviews(Guid id, CancellationToken ct)
    {
        var result = await _reviewService.GetPackageReviewsAsync(id, ct);

        if (!result.Succeeded)
        {
            return result.StatusCode switch
            {
                StatusCodes.Status404NotFound => Problem(statusCode: StatusCodes.Status404NotFound, title: result.Error),
                _ => BadRequest(new { message = result.Error })
            };
        }

        var reviewDtos = result.Reviews.Select(PublicReviewDto.FromEntity).ToList();

        return Ok(new PackageReviewsDto(
            result.TourPackageId,
            result.AverageRating,
            result.TotalReviews,
            reviewDtos));
    }

    private Guid? GetUserId()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(userId, out var id) ? id : null;
    }
}
