using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TrailWise.Infrastructure.Options;

namespace TrailWise.Infrastructure.Services;

public class NotifyLkSmsService : ISmsService
{
    public const string HttpClientName = "NotifyLk";

    private readonly HttpClient _httpClient;
    private readonly NotifyLkOptions _options;
    private readonly ILogger<NotifyLkSmsService> _logger;

    public NotifyLkSmsService(
        HttpClient httpClient,
        IOptions<NotifyLkOptions> options,
        ILogger<NotifyLkSmsService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendSmsAsync(string recipientPhone, string message)
    {
        if (string.IsNullOrWhiteSpace(recipientPhone))
        {
            _logger.LogWarning("SendSmsAsync invoked with empty recipient phone number. SMS not sent.");
            return;
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            _logger.LogWarning("SendSmsAsync invoked with empty message content. SMS not sent.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.UserId))
        {
            _logger.LogInformation("Notify.lk credentials not configured (NOTIFY_LK_API_KEY / NOTIFY_LK_USER_ID is blank). Skipping SMS dispatch to {RecipientPhone}.", recipientPhone);
            return;
        }

        var formattedPhone = FormatSriLankanPhoneNumber(recipientPhone);
        if (string.IsNullOrWhiteSpace(formattedPhone))
        {
            _logger.LogWarning("Recipient phone number '{RecipientPhone}' could not be normalized into a valid Sri Lankan phone number format.", recipientPhone);
            return;
        }

        var endpoint = !string.IsNullOrWhiteSpace(_options.ApiEndpoint)
            ? _options.ApiEndpoint
            : "https://app.notify.lk/api/v1/send";

        var parameters = new Dictionary<string, string>
        {
            ["user_id"] = _options.UserId,
            ["api_key"] = _options.ApiKey,
            ["sender_id"] = !string.IsNullOrWhiteSpace(_options.SenderId) ? _options.SenderId : "NotifyDEMO",
            ["to"] = formattedPhone,
            ["message"] = message
        };

        try
        {
            using var content = new FormUrlEncodedContent(parameters);
            var response = await _httpClient.PostAsync(endpoint, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("SMS dispatch to {RecipientPhone} via Notify.lk failed with HTTP status {StatusCode}. Response: {Response}",
                    formattedPhone, response.StatusCode, responseBody);
            }
            else
            {
                _logger.LogInformation("SMS dispatch to {RecipientPhone} via Notify.lk succeeded. Response: {Response}",
                    formattedPhone, responseBody);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while dispatching SMS via Notify.lk to {RecipientPhone}", formattedPhone);
        }
    }

    /// <summary>
    /// Formats local phone numbers (e.g. 0771234567, +94771234567, 94771234567, 0094771234567)
    /// into the 94XXXXXXXXX format expected by Sri Lankan SMS gateways.
    /// </summary>
    public static string FormatSriLankanPhoneNumber(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return string.Empty;
        }

        var cleaned = Regex.Replace(phoneNumber.Trim(), @"[^\d]", "");

        if (cleaned.StartsWith("0094") && cleaned.Length == 13)
        {
            cleaned = cleaned.Substring(2);
        }
        else if (cleaned.StartsWith("0") && cleaned.Length == 10)
        {
            cleaned = "94" + cleaned.Substring(1);
        }
        else if (cleaned.Length == 9 && !cleaned.StartsWith("94"))
        {
            cleaned = "94" + cleaned;
        }

        return cleaned;
    }
}
