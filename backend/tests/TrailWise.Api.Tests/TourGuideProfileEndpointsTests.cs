using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class TourGuideProfileEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public TourGuideProfileEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetMyProfile_TourGuide_ReturnsOwnProfile()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, email) = await TourGuideClientAsync(admin, "Alice Guide");

        var response = await guideClient.GetAsync("/api/guides/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var profile = await response.Content.ReadFromJsonAsync<GuideProfileDto>(JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal(guideUserId, profile.UserId);
        Assert.Equal("Alice Guide", profile.Name);
        Assert.Equal(email, profile.Email);
    }

    [Fact]
    public async Task UpdateMyProfile_TourGuide_UpdatesGuideAndUserFields()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, _) = await TourGuideClientAsync(admin, "Bob Guide");

        var newEmail = $"bob-updated-{Guid.NewGuid():N}@example.com";
        var updateRequest = new UpdateGuideProfileRequest(
            Name: "Bob The Best Guide",
            Email: newEmail,
            ContactInfo: "+94771234567",
            Languages: new[] { "English", "French", "english" },
            Specializations: new[] { "Wildlife", "Hiking" });

        var response = await guideClient.PutAsJsonAsync("/api/guides/me/profile", updateRequest);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var updated = await response.Content.ReadFromJsonAsync<GuideProfileDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Bob The Best Guide", updated.Name);
        Assert.Equal(newEmail, updated.Email);
        Assert.Equal("+94771234567", updated.ContactInfo);
        Assert.Equal(2, updated.Languages.Length); // duplicates/casing normalized
        Assert.Equal(2, updated.Specializations.Length);

        // Verify GET /api/guides/me reflects the update
        var getResponse = await guideClient.GetAsync("/api/guides/me");
        var fetched = await getResponse.Content.ReadFromJsonAsync<GuideProfileDto>(JsonOptions);
        Assert.Equal("Bob The Best Guide", fetched!.Name);
        Assert.Equal(newEmail, fetched.Email);

        // Verify linked User entity in DB reflects update
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var user = await db.Users.FindAsync(guideUserId);
        Assert.NotNull(user);
        Assert.Equal("Bob The Best Guide", user.Name);
        Assert.Equal(newEmail, user.Email);
        Assert.Equal("+94771234567", user.ContactNumber);
    }

    [Fact]
    public async Task UpdateMyProfile_AnotherTourGuideCannotEditSomeoneElsesProfile()
    {
        var admin = await AdminClientAsync();
        var (guide1Client, guide1UserId, _) = await TourGuideClientAsync(admin, "Guide One");
        var (guide2Client, _, _) = await TourGuideClientAsync(admin, "Guide Two");

        // Guide 2 updates their own profile
        var updateRequest = new UpdateGuideProfileRequest(
            Name: "Guide Two Modified",
            Email: $"two-mod-{Guid.NewGuid():N}@example.com",
            ContactInfo: "+94772222222",
            Languages: new[] { "Spanish" },
            Specializations: new[] { "Culture" });

        var res = await guide2Client.PutAsJsonAsync("/api/guides/me/profile", updateRequest);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Verify Guide 1's profile is completely unchanged
        var guide1ProfileRes = await guide1Client.GetAsync("/api/guides/me");
        var guide1Profile = await guide1ProfileRes.Content.ReadFromJsonAsync<GuideProfileDto>(JsonOptions);
        Assert.Equal(guide1UserId, guide1Profile!.UserId);
        Assert.Equal("Guide One", guide1Profile.Name);
    }

    [Fact]
    public async Task Traveler_CannotAccess_TourGuideProfileEndpoints()
    {
        var travelerClient = await TravelerClientAsync();

        var getRes = await travelerClient.GetAsync("/api/guides/me");
        Assert.Equal(HttpStatusCode.Forbidden, getRes.StatusCode);

        var putRes = await travelerClient.PutAsJsonAsync("/api/guides/me/profile", new UpdateGuideProfileRequest(
            "Traveler Name", "t@example.com", "+123", null, null));
        Assert.Equal(HttpStatusCode.Forbidden, putRes.StatusCode);

        var deleteRes = await travelerClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.Forbidden, deleteRes.StatusCode);
    }

    [Fact]
    public async Task UpdateMyProfile_DuplicateEmail_Returns409Conflict()
    {
        var admin = await AdminClientAsync();
        var (_, _, existingEmail) = await TourGuideClientAsync(admin, "First Guide");
        var (secondClient, _, _) = await TourGuideClientAsync(admin, "Second Guide");

        var response = await secondClient.PutAsJsonAsync("/api/guides/me/profile", new UpdateGuideProfileRequest(
            Name: "Second Guide",
            Email: existingEmail,
            ContactInfo: "+94770000000",
            Languages: null,
            Specializations: null));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteMyProfile_ZeroAssignedTours_SucceedsAndRemovesAccount()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, email) = await TourGuideClientAsync(admin, "Guide NoTours");

        // Add some unassigned availability records for this guide
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = await db.Guides.FirstAsync(g => g.UserId == guideUserId);
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guide.Id,
                Date = new DateOnly(2026, 12, 1),
                IsAvailable = true
            });
            await db.SaveChangesAsync();
        }

        var response = await guideClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Verify Guide and User records are deleted
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var userExists = await db.Users.AnyAsync(u => u.Id == guideUserId);
            var guideExists = await db.Guides.AnyAsync(g => g.UserId == guideUserId);
            var availExists = await db.GuideAvailabilities.AnyAsync(a => a.Guide.UserId == guideUserId);

            Assert.False(userExists);
            Assert.False(guideExists);
            Assert.False(availExists);
        }

        // Login should now fail with 401
        var loginResponse = await _factory.CreateClient().PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = "P@ssword123"
        });
        Assert.Equal(HttpStatusCode.Unauthorized, loginResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteMyProfile_WithAssignedTour_Returns409Conflict()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, _) = await TourGuideClientAsync(admin, "Guide WithActiveTour");

        Guid guideId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = await db.Guides.FirstAsync(g => g.UserId == guideUserId);
            guideId = guide.Id;
        }

        // Seed an assigned booking
        await SeedAssignedBookingAsync(guideId, "Active Ceylon Tour", new DateOnly(2026, 10, 15), isCompleted: false);

        var response = await guideClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Guide profile cannot be deleted while assigned tours exist.", content);

        // Verify guide and user still exist
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            Assert.True(await db.Guides.AnyAsync(g => g.Id == guideId));
            Assert.True(await db.Users.AnyAsync(u => u.Id == guideUserId));
        }
    }

    [Fact]
    public async Task DeleteMyProfile_WithCompletedAssignedTour_BlocksDeletion()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, _) = await TourGuideClientAsync(admin, "Guide WithCompletedTour");

        Guid guideId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = await db.Guides.FirstAsync(g => g.UserId == guideUserId);
            guideId = guide.Id;
        }

        // Seed a completed tour assignment
        await SeedAssignedBookingAsync(guideId, "Completed Heritage Tour", new DateOnly(2026, 8, 10), isCompleted: true);

        var response = await guideClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Guide profile cannot be deleted while assigned tours exist.", content);
    }

    [Fact]
    public async Task DeleteMyProfile_DeletionIsTransactional_NoPartialDeletionOnConflict()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, _) = await TourGuideClientAsync(admin, "Guide Transactional");

        Guid guideId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var guide = await db.Guides.FirstAsync(g => g.UserId == guideUserId);
            guideId = guide.Id;

            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guideId,
                Date = new DateOnly(2026, 12, 10),
                IsAvailable = true
            });
            await db.SaveChangesAsync();
        }

        // Assigned booking prevents deletion
        await SeedAssignedBookingAsync(guideId, "Assigned Tour", new DateOnly(2026, 10, 20), isCompleted: false);

        var response = await guideClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        // Verify unassigned availability, guide, and user are all still present (no partial deletion)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            Assert.True(await db.Guides.AnyAsync(g => g.Id == guideId));
            Assert.True(await db.Users.AnyAsync(u => u.Id == guideUserId));
            Assert.True(await db.GuideAvailabilities.AnyAsync(a => a.GuideId == guideId && a.Date == new DateOnly(2026, 12, 10)));
        }
    }

    [Fact]
    public async Task DeleteMyProfile_LinkedRecordsRemainConsistent_BookingRecordsNotDeleted()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId, _) = await TourGuideClientAsync(admin, "Guide ForConsistency");

        // Free guide has 0 bookings
        var response = await guideClient.DeleteAsync("/api/guides/me/profile");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Ensure unrelated bookings and users in the system remain untouched
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var adminUser = await db.Users.FirstOrDefaultAsync(u => u.Email == "admin@test.local");
            Assert.NotNull(adminUser);
        }
    }

    #region Helpers

    private async Task<Booking> SeedAssignedBookingAsync(Guid guideId, string packageName, DateOnly startDate, bool isCompleted)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var traveler = new User
        {
            Name = "Sample Traveler",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550999",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var tourPackage = new TourPackage
        {
            Name = packageName,
            Theme = "Cultural",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = 15,
            Locations = new List<PackageLocation>
            {
                new() { Name = "Kandy" }
            }
        };
        var tier = new PackageTier
        {
            TourPackage = tourPackage,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 100m,
            RequiresAC = false
        };
        tourPackage.PackageTiers.Add(tier);
        db.TourPackages.Add(tourPackage);

        var booking = new Booking
        {
            TravelerId = traveler.Id,
            TourPackage = tourPackage,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = startDate,
            EndDate = startDate.AddDays(2),
            BudgetPerPerson = 250m,
            Status = isCompleted ? BookingStatus.Confirmed : BookingStatus.Confirmed,
            Completed = isCompleted
        };
        db.Bookings.Add(booking);

        db.GuideAvailabilities.Add(new GuideAvailability
        {
            GuideId = guideId,
            Date = startDate,
            IsAvailable = false,
            AssignedBookingId = booking.Id
        });

        await db.SaveChangesAsync();
        return booking;
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

    private async Task<HttpClient> TravelerClientAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        var registerRes = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Traveler Test",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550888"
        });
        registerRes.EnsureSuccessStatusCode();
        var auth = await registerRes.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<(HttpClient Client, Guid UserId, string Email)> TourGuideClientAsync(HttpClient adminClient, string guideName)
    {
        var client = _factory.CreateClient();
        var email = $"guide-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = guideName,
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

        return (client, user!.Id, email);
    }

    #endregion
}
