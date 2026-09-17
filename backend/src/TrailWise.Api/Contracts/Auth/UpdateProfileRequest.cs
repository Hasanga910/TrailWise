using System.ComponentModel.DataAnnotations;

namespace TrailWise.Api.Contracts.Auth;

public class UpdateProfileRequest
{
    [Required, MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required, EmailAddress, MaxLength(320)]
    public string Email { get; set; } = string.Empty;
}
