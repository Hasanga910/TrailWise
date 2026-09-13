namespace TrailWise.Infrastructure.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "TrailWise";
    public string Audience { get; set; } = "TrailWiseClients";
    public int ExpiryMinutes { get; set; } = 60;
}
