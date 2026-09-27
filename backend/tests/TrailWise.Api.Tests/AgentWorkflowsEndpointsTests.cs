using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Domain.Entities;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class AgentWorkflowsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public AgentWorkflowsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetByBookingId_WithTravelerToken_ReturnsForbidden()
    {
        var client = await AuthenticatedTravelerAsync();

        var response = await client.GetAsync($"/api/agent-workflows/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetByBookingId_WithNonexistentBookingId_ReturnsNotFound()
    {
        var client = await AuthenticatedOperationsManagerAsync();

        var response = await client.GetAsync($"/api/agent-workflows/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetByBookingId_AsOperationsManager_ReturnsWorkflowWithStepsInOrderAndAdvisoryFlags()
    {
        var bookingId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

            var run = new AgentWorkflowRun
            {
                BookingId = bookingId,
                Objective = "Test objective.",
                PlanJson = "{}",
                Status = "Completed",
                StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
                CompletedAt = DateTimeOffset.UtcNow,
                SummaryText = "This booking looks good.",
            };
            db.AgentWorkflowRuns.Add(run);
            await db.SaveChangesAsync();

            // TrailWiseDbContext.SaveChanges stamps CreatedAt = UtcNow on every Added entity,
            // overriding any value set here — so chronological order is established by saving
            // each step log in its own SaveChangesAsync call (matching how the real coordinator
            // persists one step at a time), not by the order fields are assigned in this test.
            db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRunId = run.Id,
                AgentName = "PreferenceExtractionAgent",
                OutputJson = JsonSerializer.Serialize(TravelerPreferences.Empty, AgentJsonOptions.Default),
                DurationMs = 640,
            });
            await db.SaveChangesAsync();

            await Task.Delay(10);

            db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRunId = run.Id,
                AgentName = "ProposalSummaryAgent",
                OutputJson = JsonSerializer.Serialize(
                    new ProposalSummary("This booking looks good.", ["Traveler noted a wheelchair need."]),
                    AgentJsonOptions.Default),
                DurationMs = 2100,
            });
            await db.SaveChangesAsync();
        }

        var client = await AuthenticatedOperationsManagerAsync();
        var response = await client.GetAsync($"/api/agent-workflows/{bookingId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<AgentWorkflowDto>(JsonOptions);

        Assert.Equal(bookingId, dto!.BookingId);
        Assert.Equal("Completed", dto.Status);
        Assert.Equal("This booking looks good.", dto.SummaryText);
        Assert.Contains("Traveler noted a wheelchair need.", dto.AdvisoryFlags);

        Assert.Equal(2, dto.Steps.Count);
        Assert.Equal("PreferenceExtractionAgent", dto.Steps[0].AgentName);
        Assert.Equal("ProposalSummaryAgent", dto.Steps[1].AgentName);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> AuthenticatedOperationsManagerAsync()
    {
        var client = _factory.CreateClient();
        var adminLoginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLoginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        using var adminRequest = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Ops Manager",
                Email = $"ops-{Guid.NewGuid():N}@example.com",
                Password = "P@ssword123",
                ContactNumber = "+14155550101",
                Role = "OperationsManager"
            })
        };
        var createResponse = await client.SendAsync(adminRequest);
        createResponse.EnsureSuccessStatusCode();
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = createdUser!.Email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
