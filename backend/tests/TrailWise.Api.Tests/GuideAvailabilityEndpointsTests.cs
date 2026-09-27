using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Guides;
using Xunit;

namespace TrailWise.Api.Tests;

public class GuideAvailabilityEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public GuideAvailabilityEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task UpdateAvailability_TourGuideUpdatesOwnAvailability_Succeeds()
    {
        var admin = await AdminClientAsync();
        var (tourGuideClient, tourGuideUserId) = await TourGuideClientAsync(admin);

        // Admin creates Guide profile linked to this TourGuide user
        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Active Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Cultural" },
            UserId = tourGuideUserId
        });
        Assert.Equal(HttpStatusCode.Created, createGuideResponse.StatusCode);
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // TourGuide updates their own availability
        var putResponse = await tourGuideClient.PutAsJsonAsync($"/api/guides/{guide!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = new DateOnly(2026, 11, 1), IsAvailable = true },
                new() { Date = new DateOnly(2026, 11, 2), IsAvailable = false }
            }
        });

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        var updated = await putResponse.Content.ReadFromJsonAsync<List<GuideAvailabilityDto>>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(2, updated.Count);
        Assert.Contains(updated, a => a.Date == new DateOnly(2026, 11, 1) && a.IsAvailable);
        Assert.Contains(updated, a => a.Date == new DateOnly(2026, 11, 2) && !a.IsAvailable);
    }

    [Fact]
    public async Task UpdateAvailability_TourGuideAttemptsToUpdateAnotherGuide_ReturnsForbidden()
    {
        var admin = await AdminClientAsync();
        var (guideClient1, guideUser1) = await TourGuideClientAsync(admin);
        var (_, guideUser2) = await TourGuideClientAsync(admin);

        // Create guide 2 linked to guideUser2
        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Second Guide",
            UserId = guideUser2
        });
        var guide2 = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // guideUser1 tries to update guide2's availability
        var putResponse = await guideClient1.PutAsJsonAsync($"/api/guides/{guide2!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = new DateOnly(2026, 11, 5), IsAvailable = false }
            }
        });

        Assert.Equal(HttpStatusCode.Forbidden, putResponse.StatusCode);
    }

    [Fact]
    public async Task UpdateAvailability_NonTourGuideRoles_ReturnsForbidden()
    {
        var admin = await AdminClientAsync();
        var (_, tourGuideUserId) = await TourGuideClientAsync(admin);

        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Guide Profile",
            UserId = tourGuideUserId
        });
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // 1. Admin cannot use TourGuide-only PUT availability endpoint
        var adminPut = await admin.PutAsJsonAsync($"/api/guides/{guide!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = new DateOnly(2026, 11, 5), IsAvailable = true }
            }
        });
        Assert.Equal(HttpStatusCode.Forbidden, adminPut.StatusCode);

        // 2. Traveler cannot use TourGuide PUT availability endpoint
        var traveler = await TravelerClientAsync();
        var travelerPut = await traveler.PutAsJsonAsync($"/api/guides/{guide.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = new DateOnly(2026, 11, 5), IsAvailable = true }
            }
        });
        Assert.Equal(HttpStatusCode.Forbidden, travelerPut.StatusCode);
    }

    [Fact]
    public async Task GetAvailability_ReturnsRecordsWithinRequestedRange_OrderedByDate()
    {
        var admin = await AdminClientAsync();
        var (tourGuideClient, tourGuideUserId) = await TourGuideClientAsync(admin);

        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Range Test Guide",
            UserId = tourGuideUserId
        });
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // Seed availability: Nov 10, Nov 15, Nov 20, Nov 25
        await tourGuideClient.PutAsJsonAsync($"/api/guides/{guide!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = new DateOnly(2026, 11, 20), IsAvailable = true },
                new() { Date = new DateOnly(2026, 11, 10), IsAvailable = false },
                new() { Date = new DateOnly(2026, 11, 25), IsAvailable = true },
                new() { Date = new DateOnly(2026, 11, 15), IsAvailable = true }
            }
        });

        // Query only from Nov 12 to Nov 22 -> should return Nov 15 and Nov 20, ordered by date
        var getResponse = await admin.GetAsync($"/api/guides/{guide.Id}/availability?from=2026-11-12&to=2026-11-22");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var results = await getResponse.Content.ReadFromJsonAsync<List<GuideAvailabilityDto>>(JsonOptions);

        Assert.NotNull(results);
        Assert.Equal(2, results.Count);
        Assert.Equal(new DateOnly(2026, 11, 15), results[0].Date);
        Assert.Equal(new DateOnly(2026, 11, 20), results[1].Date);
    }

    [Fact]
    public async Task GetAvailability_InvalidDateRange_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();
        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Date Validation Guide"
        });
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // from > to
        var response = await admin.GetAsync($"/api/guides/{guide!.Id}/availability?from=2026-11-20&to=2026-11-10");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateAvailability_ExistingDate_UpdatesRowWithoutCreatingDuplicate()
    {
        var admin = await AdminClientAsync();
        var (tourGuideClient, tourGuideUserId) = await TourGuideClientAsync(admin);

        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Deduplication Test Guide",
            UserId = tourGuideUserId
        });
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var targetDate = new DateOnly(2026, 12, 1);

        // Initial update: mark false
        var res1 = await tourGuideClient.PutAsJsonAsync($"/api/guides/{guide!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = targetDate, IsAvailable = false }
            }
        });
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        // Second update on the same date: mark true
        var res2 = await tourGuideClient.PutAsJsonAsync($"/api/guides/{guide.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = targetDate, IsAvailable = true }
            }
        });
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);

        // GET availability for this date: exactly 1 record should exist, and IsAvailable should be true
        var getResponse = await admin.GetAsync($"/api/guides/{guide.Id}/availability?from=2026-12-01&to=2026-12-01");
        var records = await getResponse.Content.ReadFromJsonAsync<List<GuideAvailabilityDto>>(JsonOptions);

        Assert.NotNull(records);
        Assert.Single(records);
        Assert.True(records[0].IsAvailable);
    }

    [Fact]
    public async Task UpdateAvailability_GuideCannotOverrideBookedDate_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();
        var (tourGuideClient, tourGuideUserId) = await TourGuideClientAsync(admin);

        var createGuideResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Booking Conflict Guide",
            UserId = tourGuideUserId
        });
        var guide = await createGuideResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var bookedDate = new DateOnly(2026, 12, 15);
        var bookingId = Guid.NewGuid();

        // Seed a row that has AssignedBookingId using the direct DbContext via WebApplicationFactory
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Infrastructure.Persistence.TrailWiseDbContext>();
            db.GuideAvailabilities.Add(new Domain.Entities.GuideAvailability
            {
                GuideId = guide!.Id,
                Date = bookedDate,
                IsAvailable = false,
                AssignedBookingId = bookingId
            });
            await db.SaveChangesAsync();
        }

        // TourGuide tries to mark that booked date as available
        var putResponse = await tourGuideClient.PutAsJsonAsync($"/api/guides/{guide!.Id}/availability", new UpdateGuideAvailabilityRequest
        {
            Dates = new List<GuideAvailabilityItemRequest>
            {
                new() { Date = bookedDate, IsAvailable = true }
            }
        });

        Assert.Equal(HttpStatusCode.BadRequest, putResponse.StatusCode);
    }

    private async Task<HttpClient> AdminClientAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = "admin@test.local",
            Password = "TestAdminPass123!"
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<(HttpClient Client, Guid UserId)> TourGuideClientAsync(HttpClient adminClient)
    {
        var client = _factory.CreateClient();
        var email = $"guide-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Test Tour Guide",
            Email = email,
            Password = password,
            ContactNumber = "+14155550222",
            Role = "TourGuide"
        });
        createResponse.EnsureSuccessStatusCode();
        var user = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = password
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        return (client, user!.Id);
    }

    private async Task<HttpClient> TravelerClientAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        var regResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Traveler Test",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550188"
        });
        regResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = "P@ssword123"
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
