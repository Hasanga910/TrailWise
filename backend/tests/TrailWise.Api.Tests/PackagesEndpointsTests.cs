using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Packages;
using Xunit;

namespace TrailWise.Api.Tests;

public class PackagesEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public PackagesEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Create_WithTravelerToken_ReturnsForbidden()
    {
        var client = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var response = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithOperationsManagerToken_ReturnsCreated()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var response = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal("Integration Test Package", created!.Name);
        Assert.Single(created.Tiers);
    }

    [Fact]
    public async Task AddTier_ToExistingPackage_ReturnsUpdatedPackageWithNewTier()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var createResponse = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var addTierResponse = await client.PostAsJsonAsync($"/api/packages/{created!.Id}/tiers", new
        {
            ClassType = "First",
            IncludesFood = true,
            BasePricePerPerson = 260m,
            RequiresAC = true
        });

        Assert.Equal(HttpStatusCode.OK, addTierResponse.StatusCode);
        var updated = await addTierResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal(2, updated!.Tiers.Count);
        Assert.Contains(updated.Tiers, t => t.ClassType.ToString() == "First" && t.RequiresAC);
    }

    [Fact]
    public async Task AddTier_WithTravelerToken_ReturnsForbidden()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var createResponse = await managerClient.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var travelerClient = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var response = await travelerClient.PostAsJsonAsync($"/api/packages/{created!.Id}/tiers", new
        {
            ClassType = "First",
            IncludesFood = true,
            BasePricePerPerson = 260m,
            RequiresAC = true
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task AddTier_WithNonexistentId_ReturnsNotFound()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var response = await client.PostAsJsonAsync($"/api/packages/{Guid.NewGuid()}/tiers", new
        {
            ClassType = "First",
            IncludesFood = true,
            BasePricePerPerson = 260m,
            RequiresAC = true
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetById_WithNonexistentId_ReturnsNotFound()
    {
        var client = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var response = await client.GetAsync($"/api/packages/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_AsOperationsManager_ReturnsOkWithUpdatedFields()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var createResponse = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var updateResponse = await client.PutAsJsonAsync($"/api/packages/{created!.Id}", new
        {
            Name = "Updated Package Name",
            Theme = "Updated Theme",
            DurationDays = 5,
            BasePricePerPerson = 199.99m,
            MaxGroupSize = 20,
            LocationNames = new[] { "Kandy" }
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal("Updated Package Name", updated!.Name);
        Assert.Equal("Updated Theme", updated.Theme);
        Assert.Equal(5, updated.DurationDays);
        Assert.Equal(199.99m, updated.BasePricePerPerson);
        Assert.Equal(20, updated.MaxGroupSize);
        Assert.Contains(updated.Locations, l => l.Name == "Kandy");
    }

    [Fact]
    public async Task Update_WithTravelerToken_ReturnsForbidden()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var createResponse = await managerClient.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var travelerClient = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var response = await travelerClient.PutAsJsonAsync($"/api/packages/{created!.Id}", new
        {
            Name = "Hacked Name",
            Theme = "Testing",
            DurationDays = 2,
            BasePricePerPerson = 100m,
            MaxGroupSize = 10,
            LocationNames = new[] { "Galle" }
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Update_WithNonexistentId_ReturnsNotFound()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var response = await client.PutAsJsonAsync($"/api/packages/{Guid.NewGuid()}", new
        {
            Name = "Ghost Package",
            Theme = "Testing",
            DurationDays = 2,
            BasePricePerPerson = 100m,
            MaxGroupSize = 10,
            LocationNames = new[] { "Galle" }
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteWithoutBookings_ReturnsNoContent()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var createResponse = await client.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var deleteResponse = await client.DeleteAsync($"/api/packages/{created!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Delete_WithExistingBooking_ReturnsConflict()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var createResponse = await managerClient.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var travelerClient = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var bookingResponse = await travelerClient.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = created!.Tiers[0].Id,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 500m
        });
        bookingResponse.EnsureSuccessStatusCode();

        var deleteResponse = await managerClient.DeleteAsync($"/api/packages/{created.Id}");

        Assert.Equal(HttpStatusCode.Conflict, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Delete_WithTravelerToken_ReturnsForbidden()
    {
        var managerClient = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var createResponse = await managerClient.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await createResponse.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);

        var travelerClient = await AuthenticatedTravelerAsync(_factory.CreateClient());
        var response = await travelerClient.DeleteAsync($"/api/packages/{created!.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Delete_WithNonexistentId_ReturnsNotFound()
    {
        var client = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());

        var response = await client.DeleteAsync($"/api/packages/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------------------------------------------------------------- tier configuration

    private async Task<(HttpClient Manager, TourPackageDto Package)> CreatePackageWithTierAsync()
    {
        var manager = await AuthenticatedOperationsManagerAsync(_factory.CreateClient());
        var response = await manager.PostAsJsonAsync("/api/packages", NewPackagePayload());
        var created = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        return (manager, created!);
    }

    private static object TierPayload(string classType, decimal price = 150m, bool food = false, bool ac = false) =>
        new { ClassType = classType, IncludesFood = food, BasePricePerPerson = price, RequiresAC = ac };

    [Fact]
    public async Task UpdateTier_ChangesTheTierAndWritesAnAuditEntry()
    {
        var (manager, package) = await CreatePackageWithTierAsync();
        var tierId = package.Tiers[0].Id;

        var response = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{tierId}", TierPayload("First", 320m, food: true, ac: true));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        var tier = Assert.Single(updated!.Tiers);
        Assert.Equal((tierId, "First", 320m, true, true), (tier.Id, tier.ClassType.ToString(), tier.BasePricePerPerson, tier.IncludesFood, tier.RequiresAC));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWise.Infrastructure.Persistence.TrailWiseDbContext>();
        Assert.Contains(db.AuditLogs, a => a.EntityType == "PackageTier" && a.EntityId == tierId && a.Action == "PackageTierUpdated" && a.PerformedBy != null);
    }

    [Fact]
    public async Task UpdateTier_ToAClassAndFoodComboTheOtherTierAlreadyHas_ReturnsConflict()
    {
        var (manager, package) = await CreatePackageWithTierAsync(); // Normal, without food
        var add = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("First", 260m, true, true));
        var withTwo = await add.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        var first = withTwo!.Tiers.Single(t => t.ClassType.ToString() == "First");

        var response = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{first.Id}", TierPayload("Normal", food: false));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTier_ToTheSameClassWithDifferentFood_IsAllowed()
    {
        var (manager, package) = await CreatePackageWithTierAsync(); // Normal, without food
        var add = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("First", 260m, true, true));
        var withTwo = await add.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        var first = withTwo!.Tiers.Single(t => t.ClassType.ToString() == "First");

        var response = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{first.Id}", TierPayload("Normal", 180m, food: true));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTier_KeepingItsOwnClass_IsAllowed()
    {
        var (manager, package) = await CreatePackageWithTierAsync();

        var response = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{package.Tiers[0].Id}", TierPayload("Normal", 199m));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task UpdateTier_WithAPriceOfZero_ReturnsValidationError()
    {
        var (manager, package) = await CreatePackageWithTierAsync();

        var response = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{package.Tiers[0].Id}", TierPayload("Normal", 0m));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddTier_WithAClassAndFoodComboThePackageAlreadyHas_ReturnsConflict()
    {
        var (manager, package) = await CreatePackageWithTierAsync(); // Normal, without food

        var response = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("Normal", food: false));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task AddTier_WithTheSameClassButDifferentFood_IsAllowed()
    {
        var (manager, package) = await CreatePackageWithTierAsync(); // Normal, without food

        var response = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("Normal", 140m, food: true));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.Equal(2, updated!.Tiers.Count(t => t.ClassType.ToString() == "Normal"));
    }

    [Fact]
    public async Task UpdateAndDeleteTier_WithUnknownIds_ReturnNotFound()
    {
        var (manager, package) = await CreatePackageWithTierAsync();

        var unknownTier = await manager.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{Guid.NewGuid()}", TierPayload("Normal"));
        var unknownPackage = await manager.DeleteAsync($"/api/packages/{Guid.NewGuid()}/tiers/{package.Tiers[0].Id}");

        Assert.Equal(HttpStatusCode.NotFound, unknownTier.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, unknownPackage.StatusCode);
    }

    [Fact]
    public async Task DeleteTier_RemovesAnUnusedTier_AndAuditsIt()
    {
        var (manager, package) = await CreatePackageWithTierAsync();
        var add = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("Second", 180m));
        var withTwo = await add.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        var second = withTwo!.Tiers.Single(t => t.ClassType.ToString() == "Second");

        var response = await manager.DeleteAsync($"/api/packages/{package.Id}/tiers/{second.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var remaining = await response.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.DoesNotContain(remaining!.Tiers, t => t.Id == second.Id);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWise.Infrastructure.Persistence.TrailWiseDbContext>();
        Assert.Contains(db.AuditLogs, a => a.EntityId == second.Id && a.Action == "PackageTierDeleted");
    }

    [Fact]
    public async Task DeleteTier_TheLastTier_ReturnsConflict()
    {
        var (manager, package) = await CreatePackageWithTierAsync();

        var response = await manager.DeleteAsync($"/api/packages/{package.Id}/tiers/{package.Tiers[0].Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task DeleteTier_WithExistingBookings_ReturnsConflict()
    {
        var (manager, package) = await CreatePackageWithTierAsync();
        var add = await manager.PostAsJsonAsync($"/api/packages/{package.Id}/tiers", TierPayload("First", 260m, true, true));
        var withTwo = await add.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        var first = withTwo!.Tiers.Single(t => t.ClassType.ToString() == "First");

        var traveler = await AuthenticatedTravelerAsync(_factory.CreateClient());
        (await traveler.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = first.Id,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(33)),
            BudgetPerPerson = 500m
        })).EnsureSuccessStatusCode();

        var response = await manager.DeleteAsync($"/api/packages/{package.Id}/tiers/{first.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task TierEdits_WithTravelerToken_ReturnForbidden()
    {
        var (_, package) = await CreatePackageWithTierAsync();
        var traveler = await AuthenticatedTravelerAsync(_factory.CreateClient());

        var put = await traveler.PutAsJsonAsync($"/api/packages/{package.Id}/tiers/{package.Tiers[0].Id}", TierPayload("Normal"));
        var delete = await traveler.DeleteAsync($"/api/packages/{package.Id}/tiers/{package.Tiers[0].Id}");

        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
    }

    private static object NewPackagePayload() => new
    {
        Name = "Integration Test Package",
        Theme = "Testing",
        DurationDays = 2,
        BasePricePerPerson = 100m,
        MaxGroupSize = 10,
        Tiers = new[]
        {
            new { ClassType = "Normal", IncludesFood = false, BasePricePerPerson = 100m, RequiresAC = false }
        },
        LocationNames = new[] { "Galle" }
    };

    private static async Task<HttpClient> AuthenticatedOperationsManagerAsync(HttpClient client)
    {
        var opsManagerEmail = await CreateOperationsManagerAsync(client);
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = opsManagerEmail, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static async Task<HttpClient> AuthenticatedTravelerAsync(HttpClient client)
    {
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static async Task<string> CreateOperationsManagerAsync(HttpClient client)
    {
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
        var response = await client.SendAsync(adminRequest);
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        return created!.Email;
    }
}
