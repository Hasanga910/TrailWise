using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Reviews;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingCompletionEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BookingCompletionEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Test01_OperationsManager_CanCompleteConfirmedBooking_ReturnsOkWithCompletedStatus()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.Equal(bookingId, dto.Id);
        Assert.Equal(BookingStatus.Completed, dto.Status);
    }

    [Fact]
    public async Task Test02_Admin_CanCompleteConfirmedBooking_ReturnsOk()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed);
        var (adminClient, _) = await AuthenticatedAdminWithIdAsync();

        var response = await adminClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.Equal(bookingId, dto.Id);
        Assert.Equal(BookingStatus.Completed, dto.Status);
    }

    [Fact]
    public async Task Test03_Traveler_CannotCompleteTheirOwnBooking_ReturnsForbidden()
    {
        var (travelerClient, travelerId) = await AuthenticatedTravelerWithIdAsync();
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed, travelerId);

        var response = await travelerClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test04_TourGuide_CannotCompleteBooking_ReturnsForbidden()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed);
        var guideClient = await AuthenticatedTourGuideAsync();

        var response = await guideClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test05_UnauthenticatedRequest_ReturnsUnauthorized()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed);
        var client = _factory.CreateClient();

        var response = await client.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Test06_RequestedBooking_CannotBeCompleted_ReturnsBadRequest()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Requested);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test07_PlanProposedBooking_CannotBeCompleted_ReturnsBadRequest()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.PlanProposed);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test08_PendingApprovalBooking_CannotBeCompleted_ReturnsBadRequest()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.PendingApproval);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test09_CancelledBooking_CannotBeCompleted_ReturnsBadRequest()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Cancelled);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test10_NeedsManualReviewBooking_CannotBeCompleted_ReturnsBadRequest()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.NeedsManualReview);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test11_AlreadyCompletedBooking_ReturnsConflict()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Completed);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Test12_MissingBooking_ReturnsNotFound()
    {
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();
        var missingId = Guid.NewGuid();

        var response = await opsClient.PostAsync($"/api/bookings/{missingId}/complete", null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Test13_AuditLog_IsCreatedOnCompletion()
    {
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed);
        var (opsClient, opsManagerId) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLog = await db.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityType == "Booking" && a.EntityId == bookingId && a.Action == "BookingCompleted");

        Assert.NotNull(auditLog);
        Assert.Equal(opsManagerId, auditLog.PerformedBy);
        Assert.NotNull(auditLog.Details);
        Assert.Contains("Confirmed", auditLog.Details);
        Assert.Contains("Completed", auditLog.Details);
    }

    [Fact]
    public async Task Test14_UpdatedAt_ChangesAfterCompletion()
    {
        var (bookingId, _, _, originalUpdatedAt) = await SeedBookingAsync(BookingStatus.Confirmed);
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();

        var response = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var booking = await db.Bookings.FindAsync(bookingId);
        Assert.NotNull(booking);
        Assert.True(booking.UpdatedAt > originalUpdatedAt);
    }

    [Fact]
    public async Task Test15_CompletionEnablesReviewFlow_EndToEnd()
    {
        // 1. Authenticate a traveler and seed a confirmed booking owned by that traveler
        var (travelerClient, travelerId) = await AuthenticatedTravelerWithIdAsync();
        var (bookingId, _, _, _) = await SeedBookingAsync(BookingStatus.Confirmed, travelerId);

        // Verify that review submission is initially rejected because booking is not yet Completed
        var prematureReviewResponse = await travelerClient.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Premature review"
        });
        Assert.Equal(HttpStatusCode.BadRequest, prematureReviewResponse.StatusCode);

        // 2. OperationsManager completes the confirmed booking
        var (opsClient, _) = await AuthenticatedOperationsManagerWithIdAsync();
        var completeResponse = await opsClient.PostAsync($"/api/bookings/{bookingId}/complete", null);
        Assert.Equal(HttpStatusCode.OK, completeResponse.StatusCode);
        var completedDto = await completeResponse.Content.ReadFromJsonAsync<BookingDto>(JsonOptions);
        Assert.NotNull(completedDto);
        Assert.Equal(BookingStatus.Completed, completedDto.Status);

        // 3. Traveler submits a review for the newly completed booking -> must succeed with 201 Created
        var reviewResponse = await travelerClient.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Superb tour experience! Everything was seamless."
        });

        Assert.Equal(HttpStatusCode.Created, reviewResponse.StatusCode);
        var reviewDto = await reviewResponse.Content.ReadFromJsonAsync<ReviewDto>(JsonOptions);
        Assert.NotNull(reviewDto);
        Assert.Equal(bookingId, reviewDto.BookingId);
        Assert.Equal(5, reviewDto.Rating);
        Assert.Equal("Superb tour experience! Everything was seamless.", reviewDto.Comment);
    }

    private async Task<(Guid BookingId, Guid PackageId, Guid TravelerId, DateTimeOffset OriginalUpdatedAt)> SeedBookingAsync(
        BookingStatus status,
        Guid? travelerId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var tId = travelerId ?? Guid.NewGuid();
        if (!travelerId.HasValue)
        {
            var traveler = new User
            {
                Id = tId,
                Name = "Test Traveler",
                Email = $"traveler-{Guid.NewGuid():N}@example.com",
                ContactNumber = "+14155550100",
                PasswordHash = "irrelevant",
                Role = UserRole.Traveler
            };
            db.Users.Add(traveler);
        }

        var package = new TourPackage
        {
            Name = $"Completion Tour {Guid.NewGuid():N}",
            Theme = "Adventure",
            DurationDays = 3,
            BasePricePerPerson = 150m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 150m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = tId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            BudgetPerPerson = 500m,
            Status = status,
            CreatedAt = DateTimeOffset.UtcNow.AddHours(-3),
            UpdatedAt = DateTimeOffset.UtcNow.AddHours(-3)
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (booking.Id, package.Id, tId, booking.UpdatedAt);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedOperationsManagerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var adminLogin = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLogin.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        var email = $"ops-{Guid.NewGuid():N}@example.com";
        using var adminReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Ops Manager",
                Email = email,
                Password = "P@ssword123",
                ContactNumber = "+14155550101",
                Role = "OperationsManager"
            })
        };
        var createResp = await client.SendAsync(adminReq);
        createResp.EnsureSuccessStatusCode();

        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedAdminWithIdAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTourGuideAsync()
    {
        var client = _factory.CreateClient();
        var adminLogin = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLogin.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        var email = $"guide-{Guid.NewGuid():N}@example.com";
        using var adminReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Tour Guide",
                Email = email,
                Password = "P@ssword123",
                ContactNumber = "+14155550102",
                Role = "TourGuide"
            })
        };
        var createResp = await client.SendAsync(adminReq);
        createResp.EnsureSuccessStatusCode();

        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
