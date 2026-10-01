namespace TrailWise.Infrastructure.Options;

public class NotifyLkOptions
{
    public const string SectionName = "NotifyLk";

    public string UserId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string SenderId { get; set; } = "NotifyDEMO";
    public string ApiEndpoint { get; set; } = "https://app.notify.lk/api/v1/send";
}
