using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Fleet;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

/// <summary>
/// Privacy: a driver's trips carry travelers' names and phone numbers, so they are served only to a
/// Driver account through the driver record linked to it (Driver.UserId), never by matching a
/// phone number or name.
/// </summary>
public class DriverAssignmentsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private const string Password = "P@ssword123";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public DriverAssignmentsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/api/drivers/me/assignments")]
    [InlineData("/api/drivers/assignments")]
    public async Task Driver_SeesOnlyTheTripsOfTheirOwnLinkedDriverRecord(string route)
    {
        var (userA, driverA) = await SeedLinkedDriverAsync();
        var (_, driverB) = await SeedLinkedDriverAsync();
        var tripA1 = await SeedTripAsync(driverA);
        var tripA2 = await SeedTripAsync(driverA);
        var tripB = await SeedTripAsync(driverB);

        var client = await LoginAsync(userA.Email);
        var response = await client.GetAsync(route);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        var assignments = JsonSerializer.Deserialize<List<VehicleAssignmentDetailDto>>(body, JsonOptions)!;
        Assert.Equal(
            new[] { tripA1.BookingId, tripA2.BookingId }.OrderBy(x => x),
            assignments.Select(a => a.BookingId).OrderBy(x => x));
        Assert.All(assignments, a => Assert.Equal(driverA.Id, a.DriverId));
        Assert.DoesNotContain(tripB.BookingId.ToString(), body);
        Assert.DoesNotContain(tripB.TravelerPhone, body);
    }

    [Theory]
    [InlineData("/api/drivers/me/assignments")]
    [InlineData("/api/drivers/assignments")]
    public async Task DriverWithTheSamePhoneButNoLink_GetsNotFound_AndNoneOfTheTrips(string route)
    {
        var sharedPhone = NewPhone();
        var unlinkedDriver = await SeedDriverAsync("Sunil Mismatch", sharedPhone, user: null);
        var trip = await SeedTripAsync(unlinkedDriver);
        var lookalike = await SeedDriverUserAsync("Somebody Else", sharedPhone);

        var response = await (await LoginAsync(lookalike.Email)).GetAsync(route);

        await AssertNotFoundWithoutTripAsync(response, trip);
    }

    [Theory]
    [InlineData("/api/drivers/me/assignments")]
    [InlineData("/api/drivers/assignments")]
    public async Task DriverWithTheSameNameButNoLink_GetsNotFound_AndNoneOfTheTrips(string route)
    {
        var unlinkedDriver = await SeedDriverAsync("Kamal Namesake", NewPhone(), user: null);
        var trip = await SeedTripAsync(unlinkedDriver);
        var namesake = await SeedDriverUserAsync("kamal namesake", NewPhone());

        var response = await (await LoginAsync(namesake.Email)).GetAsync(route);

        await AssertNotFoundWithoutTripAsync(response, trip);
    }

    [Fact]
    public async Task DriverWithNoDriverRecordAtAll_GetsTheSameNotFound()
    {
        var user = await SeedDriverUserAsync("Lonely Driver", NewPhone());

        var response = await (await LoginAsync(user.Email)).GetAsync("/api/drivers/me/assignments");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Driver profile not found for current user", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("FleetCoordinator", "/api/drivers/me/assignments")]
    [InlineData("FleetCoordinator", "/api/drivers/assignments")]
    [InlineData("Admin", "/api/drivers/me/assignments")]
    [InlineData("Admin", "/api/drivers/assignments")]
    [InlineData("OperationsManager", "/api/drivers/me/assignments")]
    [InlineData("TourGuide", "/api/drivers/me/assignments")]
    [InlineData("Traveler", "/api/drivers/me/assignments")]
    public async Task NonDriverRoles_AreForbidden_EvenWhenTheirPhoneOrNameMatchADriver(string role, string route)
    {
        // A staff account that shares the phone number and name of a driver with trips.
        var phone = NewPhone();
        var driver = await SeedDriverAsync("Rita Lookalike", phone, user: null);
        var trip = await SeedTripAsync(driver);
        var client = await ClientForRoleAsync(role, "Rita Lookalike", phone);

        var response = await client.GetAsync(route);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.DoesNotContain(trip.TravelerPhone, await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("/api/drivers/me/assignments")]
    [InlineData("/api/drivers/assignments")]
    public async Task Anonymous_IsUnauthorized(string route)
    {
        var response = await _factory.CreateClient().GetAsync(route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------------------------------------------------------------- helpers

    private static async Task AssertNotFoundWithoutTripAsync(HttpResponseMessage response, Trip trip)
    {
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Driver profile not found for current user", body);
        Assert.DoesNotContain(trip.BookingId.ToString(), body);
        Assert.DoesNotContain(trip.TravelerPhone, body);
        Assert.DoesNotContain(trip.TravelerName, body);
    }

    private sealed record Trip(Guid BookingId, string TravelerName, string TravelerPhone);

    private static string NewPhone() => $"+9477{Random.Shared.Next(1_000_000, 9_999_999)}";

    private async Task<User> SeedUserAsync(string name, string phone, UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var user = new User
        {
            Name = name,
            Email = $"{role.ToString().ToLowerInvariant()}-{Guid.NewGuid():N}@example.com",
            ContactNumber = phone,
            Role = role
        };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private Task<User> SeedDriverUserAsync(string name, string phone) => SeedUserAsync(name, phone, UserRole.Driver);

    private async Task<Driver> SeedDriverAsync(string name, string phone, User? user)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var driver = new Driver
        {
            Name = name,
            LicenseNumber = $"LIC-{Guid.NewGuid():N}"[..12],
            ContactInfo = phone,
            UserId = user?.Id
        };
        db.Drivers.Add(driver);
        await db.SaveChangesAsync();
        return driver;
    }

    private async Task<(User User, Driver Driver)> SeedLinkedDriverAsync()
    {
        var phone = NewPhone();
        var user = await SeedDriverUserAsync($"Linked Driver {Guid.NewGuid():N}"[..20], phone);
        var driver = await SeedDriverAsync(user.Name, phone, user);
        return (user, driver);
    }

    private async Task<Trip> SeedTripAsync(Driver driver)
    {
        var travelerName = $"Traveler {Guid.NewGuid():N}"[..18];
        var travelerPhone = NewPhone();
        var traveler = await SeedUserAsync(travelerName, travelerPhone, UserRole.Traveler);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var package = new TourPackage { Name = $"Trip {Guid.NewGuid():N}", Theme = "Test", DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 20 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m };
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(20));
        var booking = new Booking
        {
            TravelerId = traveler.Id,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = start,
            EndDate = start.AddDays(3),
            BudgetPerPerson = 200m,
            Status = BookingStatus.Confirmed
        };
        var vehicle = new Vehicle
        {
            Type = VehicleType.Van,
            RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
            Capacity = 8,
            HasAC = true,
            SeatConfiguration = "2-2",
            MaintenanceStatus = VehicleMaintenanceStatus.Available
        };
        db.AddRange(package, tier, booking, vehicle);
        db.VehicleAssignments.Add(new VehicleAssignment
        {
            Vehicle = vehicle,
            DriverId = driver.Id,
            Booking = booking,
            StartDate = booking.StartDate,
            EndDate = booking.EndDate
        });
        await db.SaveChangesAsync();
        return new Trip(booking.Id, travelerName, travelerPhone);
    }

    private async Task<HttpClient> LoginAsync(string email)
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password });
        login.EnsureSuccessStatusCode();
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> ClientForRoleAsync(string role, string name, string phone)
    {
        if (role == "Admin")
        {
            // The seeded admin cannot be given a driver's name/phone, so use a second admin account
            // carrying them: that is the account the old fallback would have matched.
            return await LoginAsync((await SeedUserAsync(name, phone, UserRole.Admin)).Email);
        }

        var user = await SeedUserAsync(name, phone, Enum.Parse<UserRole>(role));
        return await LoginAsync(user.Email);
    }
}
