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

public class TourGuideNotesEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public TourGuideNotesEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Test01_AssignedTourGuide_CanMarkAttendance()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Attendance");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Attendance Package", new DateOnly(2026, 10, 10));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = false,
                Notes = null
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var dto = await patchResponse.Content.ReadFromJsonAsync<AssignedTourDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.True(dto.Attended);
        Assert.False(dto.Completed);
        Assert.Null(dto.GuideNotes);
    }

    [Fact]
    public async Task Test02_AssignedTourGuide_CanMarkCompleted()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Completed");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Completion Package", new DateOnly(2026, 10, 12));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = false,
                Completed = true,
                Notes = null
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var dto = await patchResponse.Content.ReadFromJsonAsync<AssignedTourDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.False(dto.Attended);
        Assert.True(dto.Completed);
    }

    [Fact]
    public async Task Test03_AssignedTourGuide_CanSaveGuideNotes()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Notes");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Notes Package", new DateOnly(2026, 10, 14));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = false,
                Completed = false,
                Notes = "Traveler group arrived on time and were very polite."
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var dto = await patchResponse.Content.ReadFromJsonAsync<AssignedTourDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.Equal("Traveler group arrived on time and were very polite.", dto.GuideNotes);
    }

    [Fact]
    public async Task Test04_AssignedTourGuide_CanUpdateAllThreeTogether()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide All Three");

        var booking = await SeedAssignedBookingAsync(guide.Id, "All In One Package", new DateOnly(2026, 10, 16));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Tour completed successfully with full attendance."
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);
        var dto = await patchResponse.Content.ReadFromJsonAsync<AssignedTourDto>(JsonOptions);
        Assert.NotNull(dto);
        Assert.True(dto.Attended);
        Assert.True(dto.Completed);
        Assert.Equal("Tour completed successfully with full attendance.", dto.GuideNotes);
    }

    [Fact]
    public async Task Test05_AnotherTourGuide_GetsForbidden()
    {
        var admin = await AdminClientAsync();
        var (guide1Client, guide1UserId) = await TourGuideClientAsync(admin);
        var guide1 = await CreateGuideAsync(admin, guide1UserId, "Guide Assigned");

        var (guide2Client, guide2UserId) = await TourGuideClientAsync(admin);
        await CreateGuideAsync(admin, guide2UserId, "Guide Unassigned");

        var booking = await SeedAssignedBookingAsync(guide1.Id, "Guide 1 Package", new DateOnly(2026, 10, 18));

        // Guide 2 attempts to patch Guide 1's booking
        var patchResponse = await guide2Client.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Intruder notes"
            });

        Assert.Equal(HttpStatusCode.Forbidden, patchResponse.StatusCode);
    }

    [Fact]
    public async Task Test06_TourGuide_NotAssignedToBooking_GetsForbidden()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        await CreateGuideAsync(admin, guideUserId, "Unassigned Guide");

        // Seed booking without any guide assigned to it
        Booking unassignedBooking;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            unassignedBooking = await SeedBookingWithPackageAsync(
                db,
                "No Guide Tour",
                "Adventure",
                new[] { "Ella" },
                new DateOnly(2026, 10, 20),
                new DateOnly(2026, 10, 22));
        }

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{unassignedBooking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = false,
                Notes = "Trying to mark unassigned"
            });

        Assert.Equal(HttpStatusCode.Forbidden, patchResponse.StatusCode);
    }

    [Fact]
    public async Task Test07_NonTourGuideRole_GetsForbidden()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide For Role Test");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Role Test Tour", new DateOnly(2026, 10, 24));

        var travelerClient = await TravelerClientAsync();

        // Traveler role attempts to patch
        var travelerPatchResponse = await travelerClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Traveler trying to mark guide notes"
            });

        Assert.Equal(HttpStatusCode.Forbidden, travelerPatchResponse.StatusCode);

        // Admin role attempts to patch
        var adminPatchResponse = await admin.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Admin trying to mark guide notes"
            });

        Assert.Equal(HttpStatusCode.Forbidden, adminPatchResponse.StatusCode);
    }

    [Fact]
    public async Task Test08_NonexistentBooking_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        await CreateGuideAsync(admin, guideUserId, "Guide For 404");

        var nonexistentId = Guid.NewGuid();
        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{nonexistentId}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Notes for ghost booking"
            });

        Assert.Equal(HttpStatusCode.NotFound, patchResponse.StatusCode);
    }

    [Fact]
    public async Task Test09_UpdatedValues_PersistInDatabase()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Persistence");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Persistence Tour", new DateOnly(2026, 10, 26));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Verified persistent values in PostgreSQL."
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var dbBooking = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == booking.Id);

        Assert.NotNull(dbBooking);
        Assert.True(dbBooking.Attended);
        Assert.True(dbBooking.Completed);
        Assert.Equal("Verified persistent values in PostgreSQL.", dbBooking.GuideNotes);
    }

    [Fact]
    public async Task Test10_GetMyAssignedTours_ReturnsUpdatedAttendedCompletedNotes()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Assigned Fetch");

        var booking = await SeedAssignedBookingAsync(guide.Id, "Fetch Verification Tour", new DateOnly(2026, 10, 28));

        var patchResponse = await guideClient.PatchAsJsonAsync(
            $"/api/bookings/{booking.Id}/guide-notes",
            new UpdateGuideTourRequest
            {
                Attended = true,
                Completed = true,
                Notes = "Check via assigned tours endpoint"
            });

        Assert.Equal(HttpStatusCode.OK, patchResponse.StatusCode);

        var listResponse = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);

        var tours = await listResponse.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);

        var tour = tours.FirstOrDefault(t => t.BookingId == booking.Id);
        Assert.NotNull(tour);
        Assert.True(tour.Attended);
        Assert.True(tour.Completed);
        Assert.Equal("Check via assigned tours endpoint", tour.GuideNotes);
    }

    #region Helpers

    private async Task<Booking> SeedAssignedBookingAsync(Guid guideId, string packageName, DateOnly startDate)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var booking = await SeedBookingWithPackageAsync(
            db,
            packageName,
            "Cultural",
            new[] { "Kandy" },
            startDate,
            startDate.AddDays(2),
            groupSize: 2);

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
