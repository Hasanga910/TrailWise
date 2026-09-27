using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Itineraries;

public class SetItineraryRequest
{
    [Required]
    public List<ItineraryStepRequest> Steps { get; set; } = new();
}

public class ItineraryStepRequest
{
    [Range(1, int.MaxValue, ErrorMessage = "Day number must be greater than 0.")]
    public int DayNumber { get; set; }

    [Required]
    [MaxLength(300)]
    public string Activity { get; set; } = string.Empty;

    [Required]
    [MaxLength(300)]
    public string Location { get; set; } = string.Empty;

    public TimeOnly StartTime { get; set; }
}
