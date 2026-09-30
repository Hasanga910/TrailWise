using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Fleet;

public class UpdateDriverRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string LicenseNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContactInfo { get; set; } = string.Empty;

    [EmailAddress, MaxLength(256)]
    public string? Email { get; set; }

    [MinLength(6)]
    public string? Password { get; set; }
}
