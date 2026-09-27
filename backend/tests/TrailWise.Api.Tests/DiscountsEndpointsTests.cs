using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Discounts;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class DiscountsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public DiscountsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Test01_OperationsManager_CanCreateDiscount()
    {
        var (client, _) = await AuthenticatedOperationsManagerWithIdAsync();
        var request = new CreateDiscountRequest
        {
            Description = $"Ops Promo {Guid.NewGuid():N}",
            PercentageOff = 15m,
            MinGroupSize = 4
        };

        var response = await client.PostAsJsonAsync("/api/discounts", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(request.Description, created.Description);
        Assert.Equal(15m, created.PercentageOff);
        Assert.Equal(4, created.MinGroupSize);
        Assert.True(created.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-2));
        Assert.True(created.UpdatedAt > DateTimeOffset.UtcNow.AddMinutes(-2));
        Assert.NotNull(response.Headers.Location);
    }

    [Fact]
    public async Task Test02_Admin_CanCreateDiscount()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var request = new CreateDiscountRequest
        {
            Description = $"Admin Promo {Guid.NewGuid():N}",
            PercentageOff = 20m,
            MinGroupSize = 5
        };

        var response = await client.PostAsJsonAsync("/api/discounts", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal(request.Description, created.Description);
        Assert.Equal(20m, created.PercentageOff);
        Assert.Equal(5, created.MinGroupSize);
    }

    [Fact]
    public async Task Test03_Traveler_CannotCreateDiscount()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var request = new CreateDiscountRequest
        {
            Description = "Traveler Promo",
            PercentageOff = 10m,
            MinGroupSize = 2
        };

        var response = await client.PostAsJsonAsync("/api/discounts", request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(100.5)]
    [InlineData(150)]
    public async Task Test04_InvalidPercentageOff_Rejected(decimal invalidPercentage)
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var request = new CreateDiscountRequest
        {
            Description = "Invalid Percentage Discount",
            PercentageOff = invalidPercentage,
            MinGroupSize = 2
        };

        var response = await client.PostAsJsonAsync("/api/discounts", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-10)]
    public async Task Test05_MinGroupSizeLessThanOne_Rejected(int invalidMinGroupSize)
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var request = new CreateDiscountRequest
        {
            Description = "Invalid Group Size Discount",
            PercentageOff = 10m,
            MinGroupSize = invalidMinGroupSize
        };

        var response = await client.PostAsJsonAsync("/api/discounts", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Test06_ListDiscounts()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var tag = $"ListTag-{Guid.NewGuid():N}";
        var req1 = new CreateDiscountRequest { Description = $"{tag} A", PercentageOff = 10m, MinGroupSize = 2 };
        var req2 = new CreateDiscountRequest { Description = $"{tag} B", PercentageOff = 15m, MinGroupSize = 4 };

        await client.PostAsJsonAsync("/api/discounts", req1);
        await client.PostAsJsonAsync("/api/discounts", req2);

        var response = await client.GetAsync($"/api/discounts?search={tag}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2, result.TotalCount);
        Assert.Contains(result.Items, d => d.Description == req1.Description);
        Assert.Contains(result.Items, d => d.Description == req2.Description);
    }

    [Fact]
    public async Task Test07_SearchByDescription()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var uniqueKeyword = $"UniqueKeyword{Guid.NewGuid():N}";
        var req1 = new CreateDiscountRequest { Description = $"Discount With {uniqueKeyword} In Title", PercentageOff = 10m, MinGroupSize = 2 };
        var req2 = new CreateDiscountRequest { Description = $"Other Unrelated Discount {Guid.NewGuid():N}", PercentageOff = 12m, MinGroupSize = 3 };

        await client.PostAsJsonAsync("/api/discounts", req1);
        await client.PostAsJsonAsync("/api/discounts", req2);

        var response = await client.GetAsync($"/api/discounts?search={uniqueKeyword}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(result);
        Assert.Single(result.Items);
        Assert.Equal(req1.Description, result.Items[0].Description);
    }

    [Fact]
    public async Task Test08_SortingWorks()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var tag = $"SortTag{Guid.NewGuid():N}";

        await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest { Description = $"{tag} Low", PercentageOff = 5m, MinGroupSize = 2 });
        await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest { Description = $"{tag} Mid", PercentageOff = 25m, MinGroupSize = 6 });
        await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest { Description = $"{tag} High", PercentageOff = 50m, MinGroupSize = 10 });

        // Sort by percentageOff ascending
        var ascResponse = await client.GetAsync($"/api/discounts?search={tag}&sortBy=percentageOff&sortDirection=asc");
        Assert.Equal(HttpStatusCode.OK, ascResponse.StatusCode);
        var ascResult = await ascResponse.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(ascResult);
        Assert.Equal(3, ascResult.Items.Count);
        Assert.Equal(5m, ascResult.Items[0].PercentageOff);
        Assert.Equal(25m, ascResult.Items[1].PercentageOff);
        Assert.Equal(50m, ascResult.Items[2].PercentageOff);

        // Sort by percentageOff descending
        var descResponse = await client.GetAsync($"/api/discounts?search={tag}&sortBy=percentageOff&sortDirection=desc");
        Assert.Equal(HttpStatusCode.OK, descResponse.StatusCode);
        var descResult = await descResponse.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(descResult);
        Assert.Equal(3, descResult.Items.Count);
        Assert.Equal(50m, descResult.Items[0].PercentageOff);
        Assert.Equal(25m, descResult.Items[1].PercentageOff);
        Assert.Equal(5m, descResult.Items[2].PercentageOff);

        // Sort by minGroupSize ascending
        var groupAscResp = await client.GetAsync($"/api/discounts?search={tag}&sortBy=minGroupSize&sortDirection=asc");
        Assert.Equal(HttpStatusCode.OK, groupAscResp.StatusCode);
        var groupAscResult = await groupAscResp.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(groupAscResult);
        Assert.Equal(2, groupAscResult.Items[0].MinGroupSize);
        Assert.Equal(6, groupAscResult.Items[1].MinGroupSize);
        Assert.Equal(10, groupAscResult.Items[2].MinGroupSize);
    }

    [Fact]
    public async Task Test09_PaginationWorks()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var tag = $"PageTag{Guid.NewGuid():N}";

        for (var i = 1; i <= 5; i++)
        {
            await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
            {
                Description = $"{tag} Item {i:D2}",
                PercentageOff = i * 5m,
                MinGroupSize = i
            });
        }

        // Page 1 with pageSize 2
        var p1Response = await client.GetAsync($"/api/discounts?search={tag}&page=1&pageSize=2&sortBy=percentageOff&sortDirection=asc");
        Assert.Equal(HttpStatusCode.OK, p1Response.StatusCode);
        var p1 = await p1Response.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(p1);
        Assert.Equal(5, p1.TotalCount);
        Assert.Equal(1, p1.Page);
        Assert.Equal(2, p1.PageSize);
        Assert.Equal(2, p1.Items.Count);

        // Page 2 with pageSize 2
        var p2Response = await client.GetAsync($"/api/discounts?search={tag}&page=2&pageSize=2&sortBy=percentageOff&sortDirection=asc");
        Assert.Equal(HttpStatusCode.OK, p2Response.StatusCode);
        var p2 = await p2Response.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(p2);
        Assert.Equal(5, p2.TotalCount);
        Assert.Equal(2, p2.Page);
        Assert.Equal(2, p2.PageSize);
        Assert.Equal(2, p2.Items.Count);

        // Items across page 1 and page 2 must be different
        var p1Ids = p1.Items.Select(x => x.Id).ToList();
        var p2Ids = p2.Items.Select(x => x.Id).ToList();
        Assert.Empty(p1Ids.Intersect(p2Ids));
    }

    [Fact]
    public async Task Test10_GetDiscountById()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = $"GetById Promo {Guid.NewGuid():N}",
            PercentageOff = 18m,
            MinGroupSize = 3
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var getResponse = await client.GetAsync($"/api/discounts/{created.Id}");

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        var fetched = await getResponse.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched.Id);
        Assert.Equal(created.Description, fetched.Description);
        Assert.Equal(created.PercentageOff, fetched.PercentageOff);
        Assert.Equal(created.MinGroupSize, fetched.MinGroupSize);
    }

    [Fact]
    public async Task Test11_MissingId_Returns404()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var missingId = Guid.NewGuid();

        var response = await client.GetAsync($"/api/discounts/{missingId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Test12_UpdateDiscount()
    {
        var (client, _) = await AuthenticatedOperationsManagerWithIdAsync();
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = $"Initial Discount {Guid.NewGuid():N}",
            PercentageOff = 10m,
            MinGroupSize = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var updateRequest = new UpdateDiscountRequest
        {
            Description = $"Updated Discount {Guid.NewGuid():N}",
            PercentageOff = 30m,
            MinGroupSize = 6
        };

        var putResponse = await client.PutAsJsonAsync($"/api/discounts/{created.Id}", updateRequest);

        Assert.Equal(HttpStatusCode.OK, putResponse.StatusCode);
        var updated = await putResponse.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal(updateRequest.Description, updated.Description);
        Assert.Equal(30m, updated.PercentageOff);
        Assert.Equal(6, updated.MinGroupSize);
        Assert.True(updated.UpdatedAt >= created.UpdatedAt);

        // Fetch to confirm persistence
        var fetchResp = await client.GetAsync($"/api/discounts/{created.Id}");
        var fetched = await fetchResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(fetched);
        Assert.Equal(updateRequest.Description, fetched.Description);
        Assert.Equal(30m, fetched.PercentageOff);
        Assert.Equal(6, fetched.MinGroupSize);
    }

    [Fact]
    public async Task Test13_Traveler_CannotUpdate()
    {
        var (adminClient, _) = await AuthenticatedAdminWithIdAsync();
        var createResp = await adminClient.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = $"Admin Discount {Guid.NewGuid():N}",
            PercentageOff = 10m,
            MinGroupSize = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var (travelerClient, _) = await AuthenticatedTravelerWithIdAsync();
        var putResponse = await travelerClient.PutAsJsonAsync($"/api/discounts/{created.Id}", new UpdateDiscountRequest
        {
            Description = "Traveler Attempted Update",
            PercentageOff = 99m,
            MinGroupSize = 1
        });

        Assert.Equal(HttpStatusCode.Forbidden, putResponse.StatusCode);
    }

    [Fact]
    public async Task Test14_DeleteDiscount()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = $"Delete Me {Guid.NewGuid():N}",
            PercentageOff = 10m,
            MinGroupSize = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var deleteResponse = await client.DeleteAsync($"/api/discounts/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Test15_Traveler_CannotDelete()
    {
        var (adminClient, _) = await AuthenticatedAdminWithIdAsync();
        var createResp = await adminClient.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = $"Do Not Delete {Guid.NewGuid():N}",
            PercentageOff = 10m,
            MinGroupSize = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var (travelerClient, _) = await AuthenticatedTravelerWithIdAsync();
        var deleteResponse = await travelerClient.DeleteAsync($"/api/discounts/{created.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task Test16_DeletedDiscount_IsNoLongerReturned()
    {
        var (client, _) = await AuthenticatedAdminWithIdAsync();
        var uniqueDescription = $"Deleted Check {Guid.NewGuid():N}";
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = uniqueDescription,
            PercentageOff = 12m,
            MinGroupSize = 3
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        // Delete discount
        var deleteResp = await client.DeleteAsync($"/api/discounts/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        // Get by ID returns 404
        var getResp = await client.GetAsync($"/api/discounts/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResp.StatusCode);

        // List search does not include it
        var listResp = await client.GetAsync($"/api/discounts?search={uniqueDescription}");
        var list = await listResp.Content.ReadFromJsonAsync<PagedResult<DiscountDto>>(JsonOptions);
        Assert.NotNull(list);
        Assert.Empty(list.Items);
    }

    [Fact]
    public async Task Test17_AuditLogCreated_OnCreate()
    {
        var (client, adminId) = await AuthenticatedAdminWithIdAsync();
        var description = $"Audit Create Test {Guid.NewGuid():N}";
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = description,
            PercentageOff = 15m,
            MinGroupSize = 4
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLog = await db.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityType == "Discount" && a.EntityId == created.Id && a.Action == "DiscountCreated");

        Assert.NotNull(auditLog);
        Assert.Equal(adminId, auditLog.PerformedBy);
        Assert.NotNull(auditLog.Details);
        Assert.Contains(description, auditLog.Details);
        Assert.Contains("15", auditLog.Details);
        Assert.Contains("4", auditLog.Details);
    }

    [Fact]
    public async Task Test18_AuditLogCreated_OnUpdate()
    {
        var (client, adminId) = await AuthenticatedAdminWithIdAsync();
        var initialDesc = $"Audit Update Initial {Guid.NewGuid():N}";
        var updatedDesc = $"Audit Update Modified {Guid.NewGuid():N}";

        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = initialDesc,
            PercentageOff = 10m,
            MinGroupSize = 2
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var putResp = await client.PutAsJsonAsync($"/api/discounts/{created.Id}", new UpdateDiscountRequest
        {
            Description = updatedDesc,
            PercentageOff = 35m,
            MinGroupSize = 5
        });
        Assert.Equal(HttpStatusCode.OK, putResp.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLog = await db.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityType == "Discount" && a.EntityId == created.Id && a.Action == "DiscountUpdated");

        Assert.NotNull(auditLog);
        Assert.Equal(adminId, auditLog.PerformedBy);
        Assert.NotNull(auditLog.Details);
        Assert.Contains(updatedDesc, auditLog.Details);
        Assert.Contains("35", auditLog.Details);
        Assert.Contains("5", auditLog.Details);
    }

    [Fact]
    public async Task Test19_AuditLogCreated_OnDelete()
    {
        var (client, adminId) = await AuthenticatedAdminWithIdAsync();
        var description = $"Audit Delete Test {Guid.NewGuid():N}";
        var createResp = await client.PostAsJsonAsync("/api/discounts", new CreateDiscountRequest
        {
            Description = description,
            PercentageOff = 22m,
            MinGroupSize = 3
        });
        var created = await createResp.Content.ReadFromJsonAsync<DiscountDto>(JsonOptions);
        Assert.NotNull(created);

        var deleteResp = await client.DeleteAsync($"/api/discounts/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLog = await db.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityType == "Discount" && a.EntityId == created.Id && a.Action == "DiscountDeleted");

        Assert.NotNull(auditLog);
        Assert.Equal(adminId, auditLog.PerformedBy);
        Assert.NotNull(auditLog.Details);
        Assert.Contains(description, auditLog.Details);
        Assert.Contains("22", auditLog.Details);
        Assert.Contains("3", auditLog.Details);
    }

    [Fact]
    public async Task Test20_PricingValidationAgent_StillUsesUpdatedDiscountValuesCorrectly()
    {
        var db = TestDbContextFactory.Create();
        var auditLogService = new AuditLogService(db, NullLogger<AuditLogService>.Instance);
        var discountService = new DiscountService(db, auditLogService, NullLogger<DiscountService>.Instance);
        var pricingAgent = new PricingValidationAgent(db);

        // Seed a booking with GroupSize = 4, BasePrice = 100, 2 days -> subtotal = 100 * 4 = 400
        var traveler = new User
        {
            Name = "Pricing Test Traveler",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550100",
            PasswordHash = "irrelevant",
            Role = UserRole.Traveler
        };

        var package = new TourPackage
        {
            Name = "Pricing Discount Package",
            Theme = "Testing",
            DurationDays = 2,
            BasePricePerPerson = 100m,
            MaxGroupSize = 20
        };

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 100m,
            RequiresAC = false
        };

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 4,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            BudgetPerPerson = 500m,
            Status = BookingStatus.PendingApproval
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        // 1. Create a discount via the service (10% for minGroupSize 4)
        var created = await discountService.CreateAsync($"Initial 10% for 4+ {Guid.NewGuid():N}", 10m, 4);

        // 2. PricingValidationAgent calculates pricing with initial discount:
        // Subtotal = 100 * 4 = 400. 10% discount = 40. Final total = 360.
        var initialResult = await pricingAgent.CalculateAsync(
            booking.Id,
            new GuideMatchResult(Guid.NewGuid(), 0.9, "Guide"),
            new VehicleMatchResult(Guid.NewGuid(), Guid.NewGuid(), AcMatch: true, SeatConfigMatch: true, ConflictCheck: false));

        var initialDoc = JsonDocument.Parse(initialResult.Breakdown);
        Assert.Equal(10m, initialDoc.RootElement.GetProperty("discountPercentage").GetDecimal());
        Assert.Equal(40m, initialDoc.RootElement.GetProperty("groupDiscount").GetDecimal());
        Assert.Equal(360m, initialDoc.RootElement.GetProperty("finalTotal").GetDecimal());
        Assert.Equal(360m, initialResult.TotalCost);

        // 3. Update the discount via the service to 25%
        await discountService.UpdateAsync(created.Id, $"Updated 25% for 4+ {Guid.NewGuid():N}", 25m, 4);

        // 4. PricingValidationAgent calculates pricing again:
        // Subtotal = 400. 25% discount = 100. Final total = 300.
        var updatedResult = await pricingAgent.CalculateAsync(
            booking.Id,
            new GuideMatchResult(Guid.NewGuid(), 0.9, "Guide"),
            new VehicleMatchResult(Guid.NewGuid(), Guid.NewGuid(), AcMatch: true, SeatConfigMatch: true, ConflictCheck: false));

        var updatedDoc = JsonDocument.Parse(updatedResult.Breakdown);
        Assert.Equal(25m, updatedDoc.RootElement.GetProperty("discountPercentage").GetDecimal());
        Assert.Equal(100m, updatedDoc.RootElement.GetProperty("groupDiscount").GetDecimal());
        Assert.Equal(300m, updatedDoc.RootElement.GetProperty("finalTotal").GetDecimal());
        Assert.Equal(300m, updatedResult.TotalCost);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedAdminWithIdAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        loginResponse.EnsureSuccessStatusCode();
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedOperationsManagerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var adminLogin = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var adminAuth = await adminLogin.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        var email = $"ops-{Guid.NewGuid():N}@example.com";
        using var adminReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/admin/users")
        {
            Headers = { Authorization = new AuthenticationHeaderValue("Bearer", adminAuth!.Token) },
            Content = JsonContent.Create(new
            {
                Name = "Ops Manager",
                Email = email,
                Password = "P@ssword123",
                ContactNumber = "+14155550101",
                Role = "OperationsManager"
            })
        };
        var createResp = await client.SendAsync(adminReq);
        createResp.EnsureSuccessStatusCode();

        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResp.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync("/api/auth/register", new { Name = "Traveler T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }
}
