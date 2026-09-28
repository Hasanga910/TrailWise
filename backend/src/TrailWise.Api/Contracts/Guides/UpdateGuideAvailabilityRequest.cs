using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Guides;

public class UpdateGuideAvailabilityRequest
{
    [Required]
    public List<GuideAvailabilityItemRequest> Dates { get; set; } = new();
}

public class GuideAvailabilityItemRequest
{
    [Required]
    public DateOnly Date { get; set; }

    public bool IsAvailable { get; set; }
}
