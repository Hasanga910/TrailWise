using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Guides;
using Xunit;

namespace TrailWise.Api.Tests;

public class GuideEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public GuideEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetAll_ReturnsCreatedGuides()
    {
        var admin = await AdminClientAsync();

        var createResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Saman Perera",
            Languages = new[] { "English", "Sinhala" },
            Specializations = new[] { "Cultural", "History" },
            ContactInfo = "+94771234567"
        });
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var listResponse = await admin.GetAsync("/api/guides");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var guides = await listResponse.Content.ReadFromJsonAsync<List<GuideDto>>(JsonOptions);

        Assert.NotNull(guides);
        Assert.Contains(guides, g => g.Id == created!.Id && g.Name == "Saman Perera");
    }

    [Fact]
    public async Task GetAll_FilterBySpecialization_ReturnsMatchingGuidesCaseInsensitively()
    {
        var admin = await AdminClientAsync();

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Spec Wildlife Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Wildlife", "Birdwatching" },
            ContactInfo = "+94770000001"
        });

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Spec Hiking Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Hiking", "Adventure" },
            ContactInfo = "+94770000002"
        });

        var response = await admin.GetAsync("/api/guides?specialization=wildlife");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var guides = await response.Content.ReadFromJsonAsync<List<GuideDto>>(JsonOptions);

        Assert.NotNull(guides);
        Assert.Contains(guides, g => g.Name == "Spec Wildlife Guide");
        Assert.DoesNotContain(guides, g => g.Name == "Spec Hiking Guide");
    }

    [Fact]
    public async Task GetAll_FilterByLanguage_ReturnsMatchingGuidesCaseInsensitively()
    {
        var admin = await AdminClientAsync();

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "French Guide",
            Languages = new[] { "French", "English" },
            Specializations = new[] { "Cultural" },
            ContactInfo = "+94770000003"
        });

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "German Guide",
            Languages = new[] { "German", "English" },
            Specializations = new[] { "Cultural" },
            ContactInfo = "+94770000004"
        });

        var response = await admin.GetAsync("/api/guides?language=french");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var guides = await response.Content.ReadFromJsonAsync<List<GuideDto>>(JsonOptions);

        Assert.NotNull(guides);
        Assert.Contains(guides, g => g.Name == "French Guide");
        Assert.DoesNotContain(guides, g => g.Name == "German Guide");
    }

    [Fact]
    public async Task GetAll_CombinedFilter_RequiresBothMatches()
    {
        var admin = await AdminClientAsync();

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Japanese Wildlife Guide",
            Languages = new[] { "Japanese", "English" },
            Specializations = new[] { "Wildlife" },
            ContactInfo = "+94770000005"
        });

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Japanese Cultural Guide",
            Languages = new[] { "Japanese", "English" },
            Specializations = new[] { "Cultural" },
            ContactInfo = "+94770000006"
        });

        await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "English Wildlife Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Wildlife" },
            ContactInfo = "+94770000007"
        });

        var response = await admin.GetAsync("/api/guides?specialization=wildlife&language=japanese");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var guides = await response.Content.ReadFromJsonAsync<List<GuideDto>>(JsonOptions);

        Assert.NotNull(guides);
        Assert.Contains(guides, g => g.Name == "Japanese Wildlife Guide");
        Assert.DoesNotContain(guides, g => g.Name == "Japanese Cultural Guide");
        Assert.DoesNotContain(guides, g => g.Name == "English Wildlife Guide");
    }

    [Fact]
    public async Task GetById_ExistingGuide_ReturnsGuide()
    {
        var admin = await AdminClientAsync();

        var createResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Kumara Silva",
            Languages = new[] { "English", "German" },
            Specializations = new[] { "Trekking" },
            ContactInfo = "+94772345678"
        });
        var created = await createResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var getResponse = await admin.GetAsync($"/api/guides/{created!.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var guide = await getResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        Assert.NotNull(guide);
        Assert.Equal(created.Id, guide.Id);
        Assert.Equal("Kumara Silva", guide.Name);
        Assert.Equal("+94772345678", guide.ContactInfo);
    }

    [Fact]
    public async Task GetById_NonExistent_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();
        var response = await admin.GetAsync($"/api/guides/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_AsOperationsManager_ReturnsCreated()
    {
        var opsManager = await OperationsManagerClientAsync();

        var response = await opsManager.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Ops Created Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Beach" },
            ContactInfo = "+94773456789"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal("Ops Created Guide", created.Name);
    }

    [Fact]
    public async Task Create_WithEmptyName_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();

        var response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "   ",
            Languages = new[] { "English" },
            Specializations = new[] { "General" }
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_AsTraveler_ReturnsForbidden()
    {
        var traveler = await TravelerClientAsync();

        var response = await traveler.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Unauthorized Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "General" }
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Update_AsTraveler_ReturnsForbidden()
    {
        var admin = await AdminClientAsync();
        var createResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Guide Before Traveler Edit",
            Languages = new[] { "English" },
            Specializations = new[] { "General" }
        });
        var created = await createResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var traveler = await TravelerClientAsync();
        var updateResponse = await traveler.PutAsJsonAsync($"/api/guides/{created!.Id}", new UpdateGuideRequest
        {
            Name = "Hacked Name"
        });

        Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
    }

    [Fact]
    public async Task Update_ExistingGuide_UpdatesFieldsSuccessfully()
    {
        var admin = await AdminClientAsync();

        var createResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Original Guide",
            Languages = new[] { "English" },
            Specializations = new[] { "Safari" },
            ContactInfo = "+94771111111"
        });
        var created = await createResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var updateResponse = await admin.PutAsJsonAsync($"/api/guides/{created!.Id}", new UpdateGuideRequest
        {
            Name = "Updated Guide Name",
            Languages = new[] { "English", "Russian" },
            Specializations = new[] { "Safari", "Photography" },
            ContactInfo = "+94772222222"
        });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal("Updated Guide Name", updated.Name);
        Assert.Equal("+94772222222", updated.ContactInfo);
        Assert.Contains("Russian", updated.Languages);
        Assert.Contains("Photography", updated.Specializations);
    }

    [Fact]
    public async Task Update_NonExistentGuide_ReturnsNotFound()
    {
        var admin = await AdminClientAsync();

        var updateResponse = await admin.PutAsJsonAsync($"/api/guides/{Guid.NewGuid()}", new UpdateGuideRequest
        {
            Name = "Ghost Guide"
        });

        Assert.Equal(HttpStatusCode.NotFound, updateResponse.StatusCode);
    }

    [Fact]
    public async Task Create_WithValidTourGuideUserId_Succeeds()
    {
        var admin = await AdminClientAsync();
        var tourGuideUserId = await CreateTourGuideUserAsync(admin);

        var response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Linked Tour Guide",
            Languages = new[] { "English", "Sinhala" },
            Specializations = new[] { "Cultural" },
            UserId = tourGuideUserId
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal(tourGuideUserId, created.UserId);
    }

    [Fact]
    public async Task Create_WithNonExistentUserId_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();

        var response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Invalid User Guide",
            UserId = Guid.NewGuid()
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithNonTourGuideRoleUser_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();

        // Create an OperationsManager user (not TourGuide)
        var nonGuideUserId = await CreateOperationsManagerUserAsync(admin);

        var response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Guide Linked To Ops User",
            UserId = nonGuideUserId
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithDuplicateUserId_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();
        var tourGuideUserId = await CreateTourGuideUserAsync(admin);

        var firstResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "First Guide",
            UserId = tourGuideUserId
        });
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Attempting to create a second guide profile linked to the same user
        var secondResponse = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Second Guide",
            UserId = tourGuideUserId
        });

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
    }

    [Fact]
    public async Task Update_WithDuplicateUserId_ReturnsBadRequest()
    {
        var admin = await AdminClientAsync();
        var tourGuideUser1 = await CreateTourGuideUserAsync(admin);
        var tourGuideUser2 = await CreateTourGuideUserAsync(admin);

        var guide1Response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Guide One",
            UserId = tourGuideUser1
        });
        var guide1 = await guide1Response.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        var guide2Response = await admin.PostAsJsonAsync("/api/guides", new CreateGuideRequest
        {
            Name = "Guide Two",
            UserId = tourGuideUser2
        });
        var guide2 = await guide2Response.Content.ReadFromJsonAsync<GuideDto>(JsonOptions);

        // Try updating guide2 to point to tourGuideUser1 (which is already linked to guide1)
        var updateResponse = await admin.PutAsJsonAsync($"/api/guides/{guide2!.Id}", new UpdateGuideRequest
        {
            Name = "Guide Two Renamed",
            UserId = tourGuideUser1
        });

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
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
        var client = _factory.CreateClient();
        var adminClient = await AdminClientAsync();
        var opsEmail = $"ops-{Guid.NewGuid():N}@example.com";

        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Ops Manager",
            Email = opsEmail,
            Password = "P@ssword123",
            ContactNumber = "+14155550199",
            Role = "OperationsManager"
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new
        {
            Email = opsEmail,
            Password = "P@ssword123"
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

    private static async Task<Guid> CreateTourGuideUserAsync(HttpClient adminClient)
    {
        var email = $"tourguide-{Guid.NewGuid():N}@example.com";
        var response = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Tour Guide User",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550177",
            Role = "TourGuide"
        });
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        return user!.Id;
    }

    private static async Task<Guid> CreateOperationsManagerUserAsync(HttpClient adminClient)
    {
        var email = $"ops-{Guid.NewGuid():N}@example.com";
        var response = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = "Ops User",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550166",
            Role = "OperationsManager"
        });
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        return user!.Id;
    }
}
