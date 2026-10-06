using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class NotifyLkSmsServiceTests
{
    private class MockHttpMessageHandler : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastRequestBody { get; private set; }
        public HttpStatusCode StatusCodeToReturn { get; set; } = HttpStatusCode.OK;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            if (request.Content != null)
            {
                LastRequestBody = await request.Content.ReadAsStringAsync(cancellationToken);
            }
            return new HttpResponseMessage(StatusCodeToReturn)
            {
                Content = new StringContent("{\"status\":\"success\",\"data\":{\"message_id\":\"123\"}}")
            };
        }
    }

    [Fact]
    public async Task SendSmsAsync_SendsFormUrlEncodedPostWithRequiredParameters()
    {
        var handler = new MockHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var options = Microsoft.Extensions.Options.Options.Create(new NotifyLkOptions
        {
            UserId = "33172",
            ApiKey = "test_notify_key",
            SenderId = "NotifyDEMO",
            ApiEndpoint = "https://app.notify.lk/api/v1/send"
        });

        var service = new NotifyLkSmsService(httpClient, options, NullLogger<NotifyLkSmsService>.Instance);

        await service.SendSmsAsync("0771234567", "Hello from TrailWise!");

        Assert.NotNull(handler.LastRequest);
        Assert.Equal(HttpMethod.Post, handler.LastRequest!.Method);
        Assert.Equal("https://app.notify.lk/api/v1/send", handler.LastRequest.RequestUri!.ToString());

        Assert.NotNull(handler.LastRequestBody);
        Assert.Contains("user_id=33172", handler.LastRequestBody);
        Assert.Contains("api_key=test_notify_key", handler.LastRequestBody);
        Assert.Contains("sender_id=NotifyDEMO", handler.LastRequestBody);
        Assert.Contains("to=94771234567", handler.LastRequestBody);
        Assert.Contains("message=Hello+from+TrailWise%21", handler.LastRequestBody);
    }
}
