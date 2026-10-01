namespace TrailWise.Infrastructure.Services;

public interface ISmsService
{
    Task SendSmsAsync(string recipientPhone, string message);
}
