using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Guides;

public class CreateGuideRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string[] Languages { get; set; } = Array.Empty<string>();

    public string[] Specializations { get; set; } = Array.Empty<string>();

    [MaxLength(200)]
    public string ContactInfo { get; set; } = string.Empty;

    public Guid? UserId { get; set; }
}
