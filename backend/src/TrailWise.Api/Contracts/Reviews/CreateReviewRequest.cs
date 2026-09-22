using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Reviews;

public class CreateReviewRequest
{
    [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5.")]
    public int Rating { get; set; }

    [MaxLength(2000, ErrorMessage = "Comment cannot exceed 2000 characters.")]
    public string? Comment { get; set; }
}
