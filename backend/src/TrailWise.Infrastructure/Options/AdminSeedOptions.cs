namespace TrailWise.Infrastructure.Options;

public class AdminSeedOptions
{
    public const string SectionName = "AdminSeed";

    public string Name { get; set; } = "System Admin";
    public string Email { get; set; } = "admin@trailwise.local";
    public string ContactNumber { get; set; } = "+94000000000";
    public string Password { get; set; } = "ChangeMe123!";
}
