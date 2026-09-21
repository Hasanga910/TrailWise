using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Fleet;

public class CreateDriverRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string LicenseNumber { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string ContactInfo { get; set; } = string.Empty;
}
