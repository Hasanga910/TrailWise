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
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class TourGuideCreationTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public TourGuideCreationTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreateUser_TourGuide_AutomaticallyCreatesLinkedGuideProfile()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        var result = await sut.CreateUserAsync("Nimal Guide", "nimal@example.com", "P@ssword123", "+94771234567", UserRole.TourGuide);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.User);
        Assert.Equal(UserRole.TourGuide, result.User.Role);

        // Verify Guide profile was automatically created and linked
        var guide = await db.Guides.FirstOrDefaultAsync(g => g.UserId == result.User.Id);
        Assert.NotNull(guide);
        Assert.Equal(result.User.Id, guide.UserId);
        Assert.Equal("Nimal Guide", guide.Name);
        Assert.Equal("+94771234567", guide.ContactInfo);
        Assert.Empty(guide.Languages);
        Assert.Empty(guide.Specializations);
    }

    [Fact]
    public async Task CreateUser_Traveler_DoesNotCreateGuideProfile()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        var result = await sut.CreateUserAsync("Traveler Bob", "bob@example.com", "P@ssword123", "+94770000001", UserRole.Traveler);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.User);

        var guideCount = await db.Guides.CountAsync(g => g.UserId == result.User.Id);
        Assert.Equal(0, guideCount);
    }

    [Fact]
    public async Task CreateUser_OperationsManager_DoesNotCreateGuideProfile()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        var result = await sut.CreateUserAsync("Ops Alice", "alice@example.com", "P@ssword123", "+94770000002", UserRole.OperationsManager);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.User);

        var guideCount = await db.Guides.CountAsync(g => g.UserId == result.User.Id);
        Assert.Equal(0, guideCount);
    }

    [Fact]
    public async Task CreateUser_FleetCoordinator_DoesNotCreateGuideProfile()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        var result = await sut.CreateUserAsync("Fleet Charlie", "charlie@example.com", "P@ssword123", "+94770000003", UserRole.FleetCoordinator);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.User);

        var guideCount = await db.Guides.CountAsync(g => g.UserId == result.User.Id);
        Assert.Equal(0, guideCount);
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_FailsAndDoesNotCreateDuplicateUserOrGuide()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        var first = await sut.CreateUserAsync("Guide First", "unique@example.com", "P@ssword123", "+94771111111", UserRole.TourGuide);
        Assert.True(first.Succeeded);

        var second = await sut.CreateUserAsync("Guide Second", "UNIQUE@example.com", "P@ssword123", "+94772222222", UserRole.TourGuide);
        Assert.False(second.Succeeded);
        Assert.Equal("A user with this email already exists.", second.Error);

        var usersWithEmail = await db.Users.CountAsync(u => u.Email == "unique@example.com");
        Assert.Equal(1, usersWithEmail);

        var guidesWithUser = await db.Guides.CountAsync(g => g.UserId == first.User!.Id);
        Assert.Equal(1, guidesWithUser);
    }

    [Fact]
    public async Task CreateUser_WhenCancellationOccurs_DoesNotPersistPartialData()
    {
        var db = TestDbContextFactory.Create();
        var sut = new AuthService(db, new StubTokenService());

        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(async () =>
        {
            await sut.CreateUserAsync("Canceled Guide", "canceled@example.com", "P@ssword123", "+94773333333", UserRole.TourGuide, cts.Token);
        });

        var userExists = await db.Users.AnyAsync(u => u.Email == "canceled@example.com");
        Assert.False(userExists);
        var guideExists = await db.Guides.AnyAsync(g => g.Name == "Canceled Guide");
        Assert.False(guideExists);
    }

    [Fact]
    public async Task Admin_CreateTourGuide_ApiFlow_CreatesLinkedGuideAndAllowsImmediateTourGuideFeatures()
    {
        var admin = await AdminClientAsync();
        var guideEmail = $"tg-{Guid.NewGuid():N}@example.com";
        var password = "P@ssword123";

        // Admin creates TourGuide staff
        var createResponse = await admin.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "EndToEnd Guide",
            Email = guideEmail,
            Password = password,
            ContactNumber = "+94779998877",
            Role = "TourGuide"
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        Assert.NotNull(createdUser);
        Assert.Equal("TourGuide", createdUser.Role.ToString());

        // Verify Guide profile exists in database with UserId == createdUser.Id
        Guide? linkedGuide;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            linkedGuide = await db.Guides.FirstOrDefaultAsync(g => g.UserId == createdUser.Id);
            Assert.NotNull(linkedGuide);
            Assert.Equal(createdUser.Id, linkedGuide.UserId);
            Assert.Equal("EndToEnd Guide", linkedGuide.Name);
            Assert.Equal("+94779998877", linkedGuide.ContactInfo);
        }

        // TourGuide logs in
        var guideClient = _factory.CreateClient();
        var loginResponse = await guideClient.PostAsJsonAsync("/api/auth/login", new
        {
            Email = guideEmail,
            Password = password
        });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        Assert.NotNull(auth);
        guideClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        // Person 2 Feature 1: GET /api/guides/me/assigned-tours works without "Guide profile not found"
        var assignedResponse = await guideClient.GetAsync("/api/guides/me/assigned-tours");
        Assert.Equal(HttpStatusCode.OK, assignedResponse.StatusCode);
        var tours = await assignedResponse.Content.ReadFromJsonAsync<List<AssignedTourDto>>(JsonOptions);
        Assert.NotNull(tours);
        Assert.Empty(tours);

        // Person 2 Feature 2: PUT /api/guides/{guide.Id}/availability works
        var putAvailabilityResponse = await guideClient.PutAsJsonAsync(
            $"/api/guides/{linkedGuide.Id}/availability",
            new UpdateGuideAvailabilityRequest
            {
                Dates = new List<GuideAvailabilityItemRequest>
                {
                    new() { Date = new DateOnly(2026, 12, 25), IsAvailable = true }
                }
            });
        Assert.Equal(HttpStatusCode.OK, putAvailabilityResponse.StatusCode);
        var availabilities = await putAvailabilityResponse.Content.ReadFromJsonAsync<List<GuideAvailabilityDto>>(JsonOptions);
        Assert.NotNull(availabilities);
        Assert.Single(availabilities);
        Assert.Equal(new DateOnly(2026, 12, 25), availabilities[0].Date);
        Assert.True(availabilities[0].IsAvailable);
    }

    [Fact]
    public async Task Admin_CreateOperationsManager_ApiFlow_DoesNotCreateGuideProfile()
    {
        var admin = await AdminClientAsync();
        var opsEmail = $"ops-{Guid.NewGuid():N}@example.com";

        var createResponse = await admin.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "EndToEnd Ops",
            Email = opsEmail,
            Password = "P@ssword123",
            ContactNumber = "+94771112233",
            Role = "OperationsManager"
        });
        Assert.Equal(HttpStatusCode.OK, createResponse.StatusCode);
        var createdUser = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        Assert.NotNull(createdUser);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var guide = await db.Guides.FirstOrDefaultAsync(g => g.UserId == createdUser.Id);
        Assert.Null(guide);
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
}
