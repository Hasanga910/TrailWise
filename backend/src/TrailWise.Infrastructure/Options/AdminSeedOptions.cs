namespace TrailWise.Infrastructure.Options;

public class AdminSeedOptions
{
    public const string SectionName = "AdminSeed";

    public string Name { get; set; } = "System Admin";
    public string Email { get; set; } = "admin@trailwise.local";
    public string Password { get; set; } = "ChangeMe123!";
}
