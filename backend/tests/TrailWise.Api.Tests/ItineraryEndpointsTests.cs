using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Guides;
using TrailWise.Api.Contracts.Itineraries;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ItineraryEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ItineraryEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Test01_OperationsManager_CanCreateItinerary_ForConfirmedBooking()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = 1,
                    Activity = "Visit Sigiriya Rock Fortress",
                    Location = "Sigiriya",
                    StartTime = new TimeOnly(8, 30, 0)
                }
            }
        };

        var response = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var steps = await response.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Single(steps);
        Assert.Equal(1, steps[0].DayNumber);
        Assert.Equal("Visit Sigiriya Rock Fortress", steps[0].Activity);
        Assert.Equal("Sigiriya", steps[0].Location);
        Assert.Equal(new TimeOnly(8, 30, 0), steps[0].StartTime);
        Assert.Equal(booking.Id, steps[0].BookingId);
    }

    [Fact]
    public async Task Test02_AssignedTourGuide_CanCreateItinerary()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide D1 Itinerary");

        var booking = await SeedAssignedBookingAsync(guide.Id, BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = 1,
                    Activity = "Morning Safari",
                    Location = "Yala National Park",
                    StartTime = new TimeOnly(6, 0, 0)
                }
            }
        };

        var response = await guideClient.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var steps = await response.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Single(steps);
        Assert.Equal("Morning Safari", steps[0].Activity);
    }

    [Fact]
    public async Task Test03_UnassignedTourGuide_Gets403_OnPostItinerary()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        await CreateGuideAsync(admin, guideUserId, "Unassigned Guide POST");

        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = 1,
                    Activity = "Temple Tour",
                    Location = "Kandy",
                    StartTime = new TimeOnly(9, 0, 0)
                }
            }
        };

        var response = await guideClient.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test04_Traveler_CannotPostItinerary()
    {
        var (travelerClient, _) = await TravelerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = 1,
                    Activity = "Self planned hike",
                    Location = "Ella",
                    StartTime = new TimeOnly(7, 0, 0)
                }
            }
        };

        var response = await travelerClient.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test05_NonConfirmedBooking_CannotReceiveItinerary()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Requested);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = 1,
                    Activity = "Preview Activity",
                    Location = "Colombo",
                    StartTime = new TimeOnly(10, 0, 0)
                }
            }
        };

        var response = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test06_Post_ReplacesExistingItinerary_InsteadOfAppending()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var initialRequest = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Original Step 1", Location = "Loc 1", StartTime = new TimeOnly(9, 0) },
                new() { DayNumber = 2, Activity = "Original Step 2", Location = "Loc 2", StartTime = new TimeOnly(11, 0) }
            }
        };

        var res1 = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", initialRequest);
        Assert.Equal(HttpStatusCode.OK, res1.StatusCode);
        var steps1 = await res1.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.Equal(2, steps1!.Count);

        var replacementRequest = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Replacement Only", Location = "New Loc", StartTime = new TimeOnly(14, 0) }
            }
        };

        var res2 = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", replacementRequest);
        Assert.Equal(HttpStatusCode.OK, res2.StatusCode);
        var steps2 = await res2.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps2);
        Assert.Single(steps2);
        Assert.Equal("Replacement Only", steps2[0].Activity);

        // Verify via GET as well
        var getRes = await opsManager.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var getSteps = await getRes.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.Single(getSteps!);
        Assert.Equal("Replacement Only", getSteps![0].Activity);
    }

    [Fact]
    public async Task Test07_Get_ReturnsSteps_OrderedByDayNumberAndStartTime()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        // Supply steps deliberately out of chronological order
        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 2, Activity = "Day 2 Morning", Location = "Loc A", StartTime = new TimeOnly(9, 0) },
                new() { DayNumber = 1, Activity = "Day 1 Afternoon", Location = "Loc B", StartTime = new TimeOnly(15, 30) },
                new() { DayNumber = 1, Activity = "Day 1 Morning", Location = "Loc C", StartTime = new TimeOnly(8, 0) }
            }
        };

        var postRes = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        var getRes = await opsManager.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var steps = await getRes.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Equal(3, steps.Count);

        Assert.Equal(1, steps[0].DayNumber);
        Assert.Equal(new TimeOnly(8, 0), steps[0].StartTime);
        Assert.Equal("Day 1 Morning", steps[0].Activity);

        Assert.Equal(1, steps[1].DayNumber);
        Assert.Equal(new TimeOnly(15, 30), steps[1].StartTime);
        Assert.Equal("Day 1 Afternoon", steps[1].Activity);

        Assert.Equal(2, steps[2].DayNumber);
        Assert.Equal(new TimeOnly(9, 0), steps[2].StartTime);
        Assert.Equal("Day 2 Morning", steps[2].Activity);
    }

    [Fact]
    public async Task Test08_BookingOwnerTraveler_CanGetItinerary()
    {
        var (travelerClient, travelerUserId) = await TravelerClientAsync();
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed, travelerUserId);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Explore Galle Fort", Location = "Galle", StartTime = new TimeOnly(10, 0) }
            }
        };

        var postRes = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        var getRes = await travelerClient.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var steps = await getRes.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Single(steps);
        Assert.Equal("Explore Galle Fort", steps[0].Activity);
    }

    [Fact]
    public async Task Test09_AssignedTourGuide_CanGetItinerary()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        var guide = await CreateGuideAsync(admin, guideUserId, "Guide Assigned GET");

        var booking = await SeedAssignedBookingAsync(guide.Id, BookingStatus.Confirmed);

        var opsManager = await OperationsManagerClientAsync();
        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Nine Arch Bridge Walk", Location = "Ella", StartTime = new TimeOnly(7, 30) }
            }
        };

        var postRes = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        var getRes = await guideClient.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var steps = await getRes.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Single(steps);
        Assert.Equal("Nine Arch Bridge Walk", steps[0].Activity);
    }

    [Fact]
    public async Task Test10_OperationsManager_CanGetItinerary()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Ops Created Activity", Location = "Kandy", StartTime = new TimeOnly(11, 0) }
            }
        };

        await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);

        var getRes = await opsManager.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.OK, getRes.StatusCode);
        var steps = await getRes.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Single(steps);
    }

    [Fact]
    public async Task Test11_UnrelatedTraveler_Gets403_OnGetItinerary()
    {
        var (ownerClient, ownerUserId) = await TravelerClientAsync();
        var (unrelatedClient, _) = await TravelerClientAsync();

        var booking = await SeedBookingAsync(BookingStatus.Confirmed, ownerUserId);

        var response = await unrelatedClient.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test12_UnassignedTourGuide_Gets403_OnGetItinerary()
    {
        var admin = await AdminClientAsync();
        var (guideClient, guideUserId) = await TourGuideClientAsync(admin);
        await CreateGuideAsync(admin, guideUserId, "Unassigned Guide GET");

        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var response = await guideClient.GetAsync($"/api/bookings/{booking.Id}/itinerary");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Test13_NonexistentBooking_Returns404()
    {
        var opsManager = await OperationsManagerClientAsync();
        var nonExistentId = Guid.NewGuid();

        var getRes = await opsManager.GetAsync($"/api/bookings/{nonExistentId}/itinerary");
        Assert.Equal(HttpStatusCode.NotFound, getRes.StatusCode);

        var postRes = await opsManager.PostAsJsonAsync($"/api/bookings/{nonExistentId}/itinerary", new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "Activity", Location = "Location", StartTime = new TimeOnly(9, 0) }
            }
        });
        Assert.Equal(HttpStatusCode.NotFound, postRes.StatusCode);
    }

    [Fact]
    public async Task Test14_ExistingBooking_WithNoItinerary_ReturnsEmptyList()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var response = await opsManager.GetAsync($"/api/bookings/{booking.Id}/itinerary");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var steps = await response.Content.ReadFromJsonAsync<List<ItineraryStepDto>>(JsonOptions);
        Assert.NotNull(steps);
        Assert.Empty(steps);
    }

    [Theory]
    [InlineData(0, "Valid activity", "Valid location")]
    [InlineData(-1, "Valid activity", "Valid location")]
    [InlineData(1, "", "Valid location")]
    [InlineData(1, "   ", "Valid location")]
    [InlineData(1, "Valid activity", "")]
    [InlineData(1, "Valid activity", "   ")]
    public async Task Test15_InvalidStepInput_Returns400(int dayNumber, string activity, string location)
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new()
                {
                    DayNumber = dayNumber,
                    Activity = activity,
                    Location = location,
                    StartTime = new TimeOnly(10, 0)
                }
            }
        };

        var response = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test16_DuplicateSchedule_SameDayAndStartTime_Returns400()
    {
        var opsManager = await OperationsManagerClientAsync();
        var booking = await SeedBookingAsync(BookingStatus.Confirmed);

        var request = new SetItineraryRequest
        {
            Steps = new List<ItineraryStepRequest>
            {
                new() { DayNumber = 1, Activity = "First Activity", Location = "Loc 1", StartTime = new TimeOnly(9, 0) },
                new() { DayNumber = 1, Activity = "Second Activity Same Time", Location = "Loc 2", StartTime = new TimeOnly(9, 0) }
            }
        };

        var response = await opsManager.PostAsJsonAsync($"/api/bookings/{booking.Id}/itinerary", request);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    #region Helpers

    private async Task<Booking> SeedBookingAsync(BookingStatus status, Guid? travelerId = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var user = travelerId.HasValue
            ? await db.Users.FindAsync(travelerId.Value)
            : null;

        if (user is null)
        {
            user = new User
            {
                Name = "Traveler " + Guid.NewGuid().ToString("N")[..8],
                Email = $"traveler-{Guid.NewGuid():N}@example.com",
                PasswordHash = "hash",
                Role = UserRole.Traveler
            };
            db.Users.Add(user);
        }

        var tourPackage = new TourPackage
        {
            Name = "Package " + Guid.NewGuid().ToString("N")[..8],
            Theme = "Adventure",
            DurationDays = 5,
            BasePricePerPerson = 200m,
            MaxGroupSize = 10
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
            TravelerId = user.Id,
            TourPackage = tourPackage,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = new DateOnly(2026, 11, 1),
            EndDate = new DateOnly(2026, 11, 5),
            BudgetPerPerson = 200m,
            Status = status
        };
        db.Bookings.Add(booking);

        await db.SaveChangesAsync();
        return booking;
    }

    private async Task<Booking> SeedAssignedBookingAsync(Guid guideId, BookingStatus status)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var traveler = new User
        {
            Name = "Traveler " + Guid.NewGuid().ToString("N")[..8],
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            PasswordHash = "hash",
            Role = UserRole.Traveler
        };
        db.Users.Add(traveler);

        var tourPackage = new TourPackage
        {
            Name = "Assigned Pkg " + Guid.NewGuid().ToString("N")[..8],
            Theme = "Cultural",
            DurationDays = 6,
            BasePricePerPerson = 250m,
            MaxGroupSize = 12
        };

        var tier = new PackageTier
        {
            TourPackage = tourPackage,
            ClassType = ClassType.First,
            IncludesFood = true,
            BasePricePerPerson = 200m,
            RequiresAC = true
        };
        tourPackage.PackageTiers.Add(tier);
        db.TourPackages.Add(tourPackage);


        var booking = new Booking
        {
            TravelerId = traveler.Id,
            TourPackage = tourPackage,
            PackageTier = tier,
            GroupSize = 4,
            StartDate = new DateOnly(2026, 10, 20),
            EndDate = new DateOnly(2026, 10, 25),
            BudgetPerPerson = 350m,
            Status = status
        };
        db.Bookings.Add(booking);

        var availability = new GuideAvailability
        {
            GuideId = guideId,
            Date = new DateOnly(2026, 10, 20),
            IsAvailable = false,
            AssignedBooking = booking
        };
        db.GuideAvailabilities.Add(availability);

        await db.SaveChangesAsync();
        return booking;
    }

    private async Task<GuideDto> CreateGuideAsync(HttpClient adminClient, Guid userId, string name)
    {
        var createResponse = await adminClient.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = name,
            Languages = new[] { "English" },
            Specializations = new[] { "Culture" },
            ContactInfo = "+94771112233",
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

    private async Task<HttpClient> OperationsManagerClientAsync()
    {
        var admin = await AdminClientAsync();
        var client = _factory.CreateClient();
        var email = $"ops-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await admin.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Ops Manager Test",
            Email = email,
            Password = password,
            ContactNumber = "+14155550199",
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

    private async Task<(HttpClient Client, Guid UserId)> TourGuideClientAsync(HttpClient adminClient)
    {
        var client = _factory.CreateClient();
        var email = $"guide-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Tour Guide Test",
            Email = email,
            Password = password,
            ContactNumber = "+14155550233",
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

    private async Task<(HttpClient Client, Guid UserId)> TravelerClientAsync()
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
        var auth = await regResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    #endregion
}
