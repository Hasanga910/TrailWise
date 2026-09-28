using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingLifecycleEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BookingLifecycleEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Decide_Approve_FromPendingApproval_SetsConfirmedAndCompletesWorkflowRun()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            db.AgentWorkflowRuns.Add(new AgentWorkflowRun
            {
                BookingId = bookingId,
                Objective = "Test objective.",
                PlanJson = "{}",
                Status = "AwaitingApproval",
                StartedAt = DateTimeOffset.UtcNow.AddMinutes(-1)
            });
            await db.SaveChangesAsync();
        }

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve",
            Notes = "Looks good."
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Confirmed", updated!.Status.ToString());

        using var verifyScope = _factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var run = await verifyDb.AgentWorkflowRuns
            .Include(r => r.StepLogs)
            .FirstAsync(r => r.BookingId == bookingId);
        Assert.Equal("Completed", run.Status);
        Assert.NotNull(run.CompletedAt);
        Assert.Contains(run.StepLogs, s => s.AgentName == "manager_decision");
    }

    [Fact]
    public async Task Decide_Reject_FromNeedsManualReview_SetsCancelled()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.NeedsManualReview);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Reject",
            Notes = "Budget too low."
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Decide_WithoutExistingWorkflowRun_StillSucceeds()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Decide_OnConfirmedBooking_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Decide_WithTravelerToken_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.PendingApproval);

        var travelerClient = await AuthenticatedTravelerAsync();
        var response = await travelerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Decide_WithNonexistentBooking_ReturnsNotFound()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{Guid.NewGuid()}/decision", new
        {
            Decision = "Approve"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Complete_FromConfirmed_SetsCompleted()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Completed", updated!.Status.ToString());
    }

    [Fact]
    public async Task Complete_FromNonConfirmedStatus_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Requested);

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Complete_WithTravelerToken_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var travelerClient = await AuthenticatedTravelerAsync();
        var response = await travelerClient.PatchAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsOwner_UpcomingBooking_SetsCancelled()
    {
        var (client, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Requested,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)));

        var response = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { Reason = "Change of plans" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Cancel_AsOwner_PastBooking_ReturnsConflict()
    {
        var (client, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Confirmed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5)));

        var response = await client.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsNonOwnerTraveler_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Requested,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)));

        var otherTravelerClient = await AuthenticatedTravelerAsync();
        var response = await otherTravelerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_AsManager_PastBooking_StillSucceeds()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Confirmed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)));

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { Reason = "Operational issue" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.Equal("Cancelled", updated!.Status.ToString());
    }

    [Fact]
    public async Task Cancel_OnCompletedBooking_ReturnsConflict()
    {
        var (_, bookingId, _) = await SetupBookingAsync(
            BookingStatus.Completed,
            startDate: DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)));

        var managerClient = await AuthenticatedOperationsManagerAsync();
        var response = await managerClient.PatchAsJsonAsync($"/api/bookings/{bookingId}/cancel", new { });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupBookingAsync(
        BookingStatus status,
        DateOnly? startDate = null)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = $"Lifecycle Test Tour {Guid.NewGuid():N}",
            Theme = "LifecycleTheme",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 200m,
            RequiresAC = false
        };
        var effectiveStartDate = startDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = effectiveStartDate,
            EndDate = effectiveStartDate.AddDays(3),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler L", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
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
