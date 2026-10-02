using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ManualGuideAssignmentEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ManualGuideAssignmentEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task AssignGuide_OperationsManager_AssignsGuideToNeedsManualReviewBooking_ConfirmsAndReservesAvailability()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);

        var guide = await CreateGuideAsync("Guide Kasun", specializations: new[] { "Wildlife" });

        var startDate = new DateOnly(2026, 11, 1);
        var endDate = new DateOnly(2026, 11, 3);
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate, theme: "Wildlife");

        // Seed vehicle & driver so all 3 resources are present when guide is assigned
        using (var vScope = _factory.Services.CreateScope())
        {
            var vDb = vScope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var v = new Vehicle
            {
                Type = VehicleType.Van,
                RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
                Capacity = 8,
                HasAC = true,
                SeatConfiguration = "2-2-2-2",
                MaintenanceStatus = VehicleMaintenanceStatus.Available
            };
            var d = new Driver
            {
                Name = "Kasun Driver",
                LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10],
                ContactInfo = "+94770000009"
            };
            vDb.Vehicles.Add(v);
            vDb.Drivers.Add(d);
            vDb.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = v,
                Driver = d,
                BookingId = booking.Id,
                StartDate = startDate,
                EndDate = endDate
            });
            await vDb.SaveChangesAsync();
        }

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<AssignGuideResponse>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(booking.Id, result.BookingId);
        Assert.Equal(guide.Id, result.GuideId);
        Assert.Equal(BookingStatus.Confirmed, result.Status);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var updatedBooking = await db.Bookings.FindAsync(booking.Id);
        Assert.NotNull(updatedBooking);
        Assert.Equal(BookingStatus.Confirmed, updatedBooking.Status);

        var availabilityRows = db.GuideAvailabilities
            .Where(a => a.GuideId == guide.Id && a.AssignedBookingId == booking.Id)
            .OrderBy(a => a.Date)
            .ToList();

        Assert.Equal(3, availabilityRows.Count);
        Assert.All(availabilityRows, a =>
        {
            Assert.False(a.IsAvailable);
            Assert.Equal(booking.Id, a.AssignedBookingId);
        });
    }

    [Fact]
    public async Task AssignGuide_TravelerRole_ReturnsForbidden()
    {
        var traveler = await TravelerClientAsync();
        var guide = await CreateGuideAsync("Guide Nimal");
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, new DateOnly(2026, 11, 5), new DateOnly(2026, 11, 6));

        var response = await traveler.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssignGuide_TourGuideRole_ReturnsForbidden()
    {
        var admin = await AdminClientAsync();
        var (tourGuide, _) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync("Guide Sunil");
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, new DateOnly(2026, 11, 7), new DateOnly(2026, 11, 8));

        var response = await tourGuide.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AssignGuide_NonexistentBooking_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);
        var guide = await CreateGuideAsync("Guide Kamal");

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{Guid.NewGuid()}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AssignGuide_NonexistentGuide_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 10));

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new AssignGuideRequest(Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AssignGuide_BookingNotNeedsManualReview_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);
        var guide = await CreateGuideAsync("Guide Ruwan");
        var confirmedBooking = await SeedBookingAsync(BookingStatus.Confirmed, new DateOnly(2026, 11, 11), new DateOnly(2026, 11, 12));

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{confirmedBooking.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AssignGuide_ConflictingGuide_ReturnsConflict_AndKeepsNeedsManualReview()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);
        var guide = await CreateGuideAsync("Guide Anura");

        var startDate = new DateOnly(2026, 11, 15);
        var endDate = new DateOnly(2026, 11, 17);

        // Pre-reserve a conflicting date
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guide.Id,
                Date = new DateOnly(2026, 11, 16),
                IsAvailable = false,
                AssignedBookingId = Guid.NewGuid()
            });
            await db.SaveChangesAsync();
        }

        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);

        var response = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var freshBooking = await db.Bookings.FindAsync(booking.Id);
            Assert.NotNull(freshBooking);
            Assert.Equal(BookingStatus.NeedsManualReview, freshBooking.Status);
        }
    }

    [Fact]
    public async Task AssignGuide_DoubleBookingProtection_SecondBookingFailsWithConflict()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);
        var guide = await CreateGuideAsync("Guide Chamara");

        var startDate = new DateOnly(2026, 11, 20);
        var endDate = new DateOnly(2026, 11, 22);

        var booking1 = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);
        var booking2 = await SeedBookingAsync(BookingStatus.NeedsManualReview, startDate, endDate);

        var res1 = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking1.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);

        var res2 = await opsManager.PostAsJsonAsync(
            $"/api/bookings/{booking2.Id}/assign-guide",
            new AssignGuideRequest(guide.Id));
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
    }

    [Fact]
    public async Task GetAvailableGuides_ReturnsAvailableGuidesAndExcludesConflicting()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);

        var guideFree = await CreateGuideAsync("Guide Free", specializations: new[] { "Cultural" }, languages: new[] { "English" });
        var guideBusy = await CreateGuideAsync("Guide Busy", specializations: new[] { "Cultural" });

        var startDate = new DateOnly(2026, 12, 1);
        var endDate = new DateOnly(2026, 12, 3);

        // Pre-reserve guideBusy
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            db.GuideAvailabilities.Add(new GuideAvailability
            {
                GuideId = guideBusy.Id,
                Date = new DateOnly(2026, 12, 2),
                IsAvailable = false,
                AssignedBookingId = Guid.NewGuid()
            });
            await db.SaveChangesAsync();
        }

        var booking = await SeedBookingAsync(
            BookingStatus.NeedsManualReview,
            startDate,
            endDate,
            theme: "Cultural",
            languagePreference: "English");

        var response = await opsManager.GetAsync($"/api/bookings/{booking.Id}/available-guides");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var availableGuides = await response.Content.ReadFromJsonAsync<List<AvailableGuideDto>>(JsonOptions);
        Assert.NotNull(availableGuides);

        Assert.Contains(availableGuides, g => g.GuideId == guideFree.Id);
        Assert.DoesNotContain(availableGuides, g => g.GuideId == guideBusy.Id);

        var freeDto = availableGuides.First(g => g.GuideId == guideFree.Id);
        Assert.True(freeDto.MatchesSpecialization);
        Assert.True(freeDto.MatchesLanguage);
        Assert.NotNull(freeDto.Notes);
    }

    [Fact]
    public async Task GetAvailableGuides_TravelerOrTourGuide_ReturnsForbidden()
    {
        var traveler = await TravelerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.NeedsManualReview, new DateOnly(2026, 12, 10), new DateOnly(2026, 12, 12));

        var response = await traveler.GetAsync($"/api/bookings/{booking.Id}/available-guides");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetAvailableGuides_NonexistentBooking_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var opsManager = await OperationsManagerClientAsync(admin);

        var response = await opsManager.GetAsync($"/api/bookings/{Guid.NewGuid()}/available-guides");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    #region Helpers

    private async Task<Guide> CreateGuideAsync(
        string name,
        string[]? specializations = null,
        string[]? languages = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var guide = new Guide
        {
            Name = name,
            ContactInfo = "+94770000000",
            Specializations = specializations ?? new[] { "General" },
            Languages = languages ?? new[] { "English" }
        };
        db.Guides.Add(guide);
        await db.SaveChangesAsync();
        return guide;
    }

    private async Task<Booking> SeedBookingAsync(
        BookingStatus status,
        DateOnly startDate,
        DateOnly endDate,
        string theme = "Adventure",
        string? languagePreference = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var traveler = new User
        {
            Name = $"Traveler-{Guid.NewGuid():N}",
            Email = $"traveler-{Guid.NewGuid():N}@test.local",
            PasswordHash = "hashed",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var package = new TourPackage
        {
            Name = $"Package-{Guid.NewGuid():N}",
            Theme = theme,
            DurationDays = (endDate.DayNumber - startDate.DayNumber) + 1,
            BasePricePerPerson = 150m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 100m,
            RequiresAC = false
        };
        package.PackageTiers.Add(tier);
        db.TourPackages.Add(package);

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = startDate,
            EndDate = endDate,
            BudgetPerPerson = 300m,
            LanguagePreference = languagePreference,
            Status = status
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

    private async Task<HttpClient> OperationsManagerClientAsync(HttpClient adminClient)
    {
        var client = _factory.CreateClient();
        var email = $"ops-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Test Ops Manager",
            Email = email,
            Password = password,
            ContactNumber = "+14155550333",
            Role = "OperationsManager"
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
        return client;
    }

    private async Task<HttpClient> TravelerClientAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var regResponse = await client.PostAsJsonAsync("/api/auth/register", new
        {
            Name = "Traveler Tester",
            Email = email,
            Password = password,
            ContactNumber = "+14155550444"
        });
        regResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = email,
            Password = password
        });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<(HttpClient Client, Guid UserId)> TourGuideClientAsync(HttpClient adminClient)
    {
        var client = _factory.CreateClient();
        var email = $"guideuser-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Guide Tester",
            Email = email,
            Password = password,
            ContactNumber = "+14155550555",
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

    #endregion
}
