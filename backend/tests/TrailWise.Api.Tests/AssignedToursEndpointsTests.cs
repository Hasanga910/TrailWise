using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class AssignedToursEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public AssignedToursEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task TourGuideWithAssignedBooking_ReceivesBooking_WithPackageDetails()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);

        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Alpha");

        Booking booking;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            booking = await SeedBookingWithPackageAsync(
                db,
                "Cultural Heritage Tour",
                "Cultural",
                new[] { "Kandy", "Sigiriya" },
                new DateOnly(2026, 10, 10),
                new DateOnly(2026, 10, 12),
                groupSize: 4,
                specialRequests: "Vegetarian meals");

            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guide.Id,
                Date = new DateOnly(2026, 10, 10),
                IsAvailable = false,
                AssignedBookingId = booking.Id
            });
            await db.SaveChangesAsync();
        }

        var response = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tours = await response.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);
        var tour = Assert.Single(tours);

        Assert.Equal(booking.Id, tour.BookingId);
        Assert.Equal(booking.TourPackageId, tour.TourPackageId);
        Assert.Equal("Cultural Heritage Tour", tour.TourPackageName);
        Assert.Equal("Cultural", tour.Theme);
        Assert.Equal(2, tour.Locations.Count);
        Assert.Contains("Kandy", tour.Locations);
        Assert.Contains("Sigiriya", tour.Locations);
        Assert.Equal(new DateOnly(2026, 10, 10), tour.StartDate);
        Assert.Equal(new DateOnly(2026, 10, 12), tour.EndDate);
        Assert.Equal(4, tour.GroupSize);
        Assert.Equal(BookingStatus.Confirmed, tour.Status);
        Assert.Equal("Vegetarian meals", tour.SpecialRequests);
        Assert.Equal(guide.Id, tour.GuideId);
        Assert.Equal("Guide Alpha", tour.GuideName);
    }

    [Fact]
    public async Task TourGuideWithMultipleAvailabilityRowsForSameBooking_ReceivesBookingOnlyOnce()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);

        var guide = await CreateGuideAsync(admin, guideUserId, "Deduplication Guide");

        Booking booking;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            booking = await SeedBookingWithPackageAsync(
                db,
                "Multi-Day Wildlife Safari",
                "Wildlife",
                new[] { "Yala" },
                new DateOnly(2026, 11, 1),
                new DateOnly(2026, 11, 3),
                groupSize: 2);

            // Add 3 availability rows for the 3 dates of the tour
            db.GuideAvailabilities.AddRange(
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 11, 1),
                    IsAvailable = false,
                    AssignedBookingId = booking.Id
                },
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 11, 2),
                    IsAvailable = false,
                    AssignedBookingId = booking.Id
                },
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 11, 3),
                    IsAvailable = false,
                    AssignedBookingId = booking.Id
                });
            await db.SaveChangesAsync();
        }

        var response = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tours = await response.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);
        // Even with 3 availability rows, booking must appear exactly ONCE
        Assert.Single(tours);
        Assert.Equal(booking.Id, tours[0].BookingId);
    }

    [Fact]
    public async Task TourGuide_DoesNotReceiveAnotherGuidesAssignedBooking()
    {
        var admin = await AdminClientAsync();
        var (guideClient1, guideUserId1) = await TourGuideClientAsync(admin);
        var (guideClient2, guideUserId2) = await TourGuideClientAsync(admin);

        var guide1 = await CreateGuideAsync(admin, guideUserId1, "Guide 1");
        var guide2 = await CreateGuideAsync(admin, guideUserId2, "Guide 2");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var bookingGuide2 = await SeedBookingWithPackageAsync(
                db,
                "Guide 2 Private Tour",
                "Adventure",
                new[] { "Ella" },
                new DateOnly(2026, 12, 5),
                new DateOnly(2026, 12, 6),
                groupSize: 3);

            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guide2.Id,
                Date = new DateOnly(2026, 12, 5),
                IsAvailable = false,
                AssignedBookingId = bookingGuide2.Id
            });
            await db.SaveChangesAsync();
        }

        // Guide 1 requests their assigned tours -> should be empty
        var response1 = await guideClient1.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response1.StatusCode);
        var tours1 = await response1.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours1);
        Assert.Empty(tours1);

        // Guide 2 requests their assigned tours -> receives their booking
        var response2 = await guideClient2.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response2.StatusCode);
        var tours2 = await response2.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours2);
        Assert.Single(tours2);
        Assert.Equal("Guide 2 Private Tour", tours2[0].TourPackageName);
    }

    [Fact]
    public async Task TourGuideWithNoAssignments_ReceivesEmptyArray()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);

        await CreateGuideAsync(admin, guideUserId, "Idle Guide");

        var response = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tours = await response.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);
        Assert.Empty(tours);
    }

    [Fact]
    public async Task TourGuideWithNoLinkedGuideProfile_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var (guideClient, _) = await TourGuideClientAsync(admin);

        // TourGuide user exists, but no Guide profile is created with UserId = guideUserId
        var response = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("OperationsManager")]
    [InlineData("FleetCoordinator")]
    public async Task NonTourGuideStaffRoles_ReturnForbidden(string role)
    {
        var admin = await AdminClientAsync();
        var client = _factory.CreateClient();
        var email = $"staff-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await admin.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = $"Test {role}",
            Email = email,
            Password = password,
            ContactNumber = "+14155550222",
            Role = role
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = password
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var response = await client.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task TravelerRole_ReturnsForbidden()
    {
        var travelerClient = await TravelerClientAsync();

        var response = await travelerClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UnauthenticatedUser_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AssignedTours_AreOrderedByStartDateAscending()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);

        var guide = await CreateGuideAsync(admin, guideUserId, "Chronological Guide");

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

            var bookingLater = await SeedBookingWithPackageAsync(
                db,
                "December Tour",
                "Beach",
                new[] { "Mirissa" },
                new DateOnly(2026, 12, 10),
                new DateOnly(2026, 12, 12),
                groupSize: 2);

            var bookingEarlier = await SeedBookingWithPackageAsync(
                db,
                "October Tour",
                "Nature",
                new[] { "Sinharaja" },
                new DateOnly(2026, 10, 5),
                new DateOnly(2026, 10, 7),
                groupSize: 2);

            var bookingMiddle = await SeedBookingWithPackageAsync(
                db,
                "November Tour",
                "Cultural",
                new[] { "Anuradhapura" },
                new DateOnly(2026, 11, 15),
                new DateOnly(2026, 11, 18),
                groupSize: 2);

            db.GuideAvailabilities.AddRange(
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 12, 10),
                    IsAvailable = false,
                    AssignedBookingId = bookingLater.Id
                },
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 10, 5),
                    IsAvailable = false,
                    AssignedBookingId = bookingEarlier.Id
                },
                new GuideAvailability
                {
                    GuideId = guide.Id,
                    Date = new DateOnly(2026, 11, 15),
                    IsAvailable = false,
                    AssignedBookingId = bookingMiddle.Id
                });

            await db.SaveChangesAsync();
        }

        var response = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var tours = await response.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);
        Assert.Equal(3, tours.Count);

        // Must be sorted by StartDate ascending
        Assert.Equal("October Tour", tours[0].TourPackageName);
        Assert.Equal(new DateOnly(2026, 10, 5), tours[0].StartDate);

        Assert.Equal("November Tour", tours[1].TourPackageName);
        Assert.Equal(new DateOnly(2026, 11, 15), tours[1].StartDate);

        Assert.Equal("December Tour", tours[2].TourPackageName);
        Assert.Equal(new DateOnly(2026, 12, 10), tours[2].StartDate);
    }

    #region Helpers

    private async Task<GuideDto> CreateGuideAsync(HttpClient adminClient, Guid userId, string name)
    {
        var createResponse = await adminClient.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = name,
            Languages = new[] { "English" },
            Specializations = new[] { "Wildlife" },
            ContactInfo = "+94770000000",
            UserId = userId
        });
        createResponse.EnsureSuccessStatusCode();
        var guide = await createResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);
        return guide!;
    }

    private static async Task<Booking> SeedBookingWithPackageAsync(
        TrailWiseDbContext db,
        string packageName,
        string theme,
        string[] locations,
        DateOnly startDate,
        DateOnly endDate,
        int groupSize = 2,
        string? specialRequests = null)
    {
        var traveler = new User
        {
            Name = "Sample Traveler",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            PasswordHash = "hash",
            ContactNumber = "+14155550100",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var tourPackage = new TourPackage
        {
            Name = packageName,
            Theme = theme,
            DurationDays = endDate.DayNumber - startDate.DayNumber + 1,
            BasePricePerPerson = 200m,
            MaxGroupSize = 15,
            Locations = locations.Select(loc => new PackageLocation { Name = loc }).ToList()
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
            GroupSize = groupSize,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 250m,
            SpecialRequests = specialRequests,
            Status = BookingStatus.Confirmed
        };
        db.Bookings.Add(booking);

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

    #endregion
}
