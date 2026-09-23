using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Guides;

public class UpdateGuideTourRequest
{
    public bool Attended { get; set; }
    public bool Completed { get; set; }

    [MaxLength(2000)]
    public string? Notes { get; set; }
}
