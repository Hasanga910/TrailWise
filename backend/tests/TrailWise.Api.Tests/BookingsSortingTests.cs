using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Packages;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class BookingsSortingTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public BookingsSortingTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetMine_DefaultsTo_CreatedAtDescending()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var b1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 30);
        await Task.Delay(20);
        var b2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 10);
        await Task.Delay(20);
        var b3 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 20);

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(3, result!.TotalCount);
        Assert.Equal(b3.Id, result.Items[0].Id);
        Assert.Equal(b2.Id, result.Items[1].Id);
        Assert.Equal(b1.Id, result.Items[2].Id);
    }

    [Fact]
    public async Task GetMine_WithSortByCreatedAt_Desc_ReturnsLatestToOldest()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var b1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 40);
        await Task.Delay(20);
        var b2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 5);
        await Task.Delay(20);
        var b3 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 25);

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=desc", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(b3.Id, result!.Items[0].Id);
        Assert.Equal(b2.Id, result.Items[1].Id);
        Assert.Equal(b1.Id, result.Items[2].Id);
    }

    [Fact]
    public async Task GetMine_WithSortByCreatedAt_Asc_ReturnsOldestToLatest()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var b1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 40);
        await Task.Delay(20);
        var b2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 5);
        await Task.Delay(20);
        var b3 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 25);

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=asc", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(b1.Id, result!.Items[0].Id);
        Assert.Equal(b2.Id, result.Items[1].Id);
        Assert.Equal(b3.Id, result.Items[2].Id);
    }

    [Fact]
    public async Task GetMine_AcrossPagination_MaintainsGlobalOrdering_5Bookings_PageSize2()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        // Create 5 bookings in order: b1 earliest, b5 latest
        var b1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 50);
        await Task.Delay(20);
        var b2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 40);
        await Task.Delay(20);
        var b3 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 30);
        await Task.Delay(20);
        var b4 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 20);
        await Task.Delay(20);
        var b5 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 10);

        // Test Latest to Oldest across 3 pages:
        // Page 1: b5, b4
        // Page 2: b3, b2
        // Page 3: b1
        var p1Desc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=desc&pageSize=2&page=1", JsonOptions);
        var p2Desc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=desc&pageSize=2&page=2", JsonOptions);
        var p3Desc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=desc&pageSize=2&page=3", JsonOptions);

        Assert.Equal(5, p1Desc!.TotalCount);
        Assert.Equal(new[] { b5.Id, b4.Id }, p1Desc.Items.Select(x => x.Id));
        Assert.Equal(new[] { b3.Id, b2.Id }, p2Desc!.Items.Select(x => x.Id));
        Assert.Equal(new[] { b1.Id }, p3Desc!.Items.Select(x => x.Id));

        // Test Oldest to Latest across 3 pages:
        // Page 1: b1, b2
        // Page 2: b3, b4
        // Page 3: b5
        var p1Asc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=asc&pageSize=2&page=1", JsonOptions);
        var p2Asc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=asc&pageSize=2&page=2", JsonOptions);
        var p3Asc = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=createdAt&sortDirection=asc&pageSize=2&page=3", JsonOptions);

        Assert.Equal(5, p1Asc!.TotalCount);
        Assert.Equal(new[] { b1.Id, b2.Id }, p1Asc.Items.Select(x => x.Id));
        Assert.Equal(new[] { b3.Id, b4.Id }, p2Asc!.Items.Select(x => x.Id));
        Assert.Equal(new[] { b5.Id }, p3Asc!.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task GetMine_WithSortByStartDate_SortsCorrectly()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var bEarly = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 5);
        var bLate = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 45);
        var bMid = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 20);

        var ascRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=startDate&sortDirection=asc", JsonOptions);
        Assert.Equal(new[] { bEarly.Id, bMid.Id, bLate.Id }, ascRes!.Items.Select(x => x.Id));

        var descRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=startDate&sortDirection=desc", JsonOptions);
        Assert.Equal(new[] { bLate.Id, bMid.Id, bEarly.Id }, descRes!.Items.Select(x => x.Id));
    }

    [Fact]
    public async Task GetMine_WithSortByStatus_SortsCorrectly()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var b1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 10);
        var b2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 20);

        // Cancel b1 so its status is Cancelled (index 5) while b2 is active (Requested 0 or Confirmed 3)
        var cancelRes = await client.PatchAsJsonAsync($"/api/bookings/{b1.Id}/cancel", new { Reason = "Change of plans" });
        cancelRes.EnsureSuccessStatusCode();

        // Alphabetical status ordering: "Cancelled" (b1) < "Confirmed"/"Requested" (b2)
        var ascRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=status&sortDirection=asc", JsonOptions);
        Assert.Equal(b1.Id, ascRes!.Items[0].Id); // Cancelled
        Assert.Equal(b2.Id, ascRes.Items[1].Id);

        var descRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            "/api/bookings/mine?sortBy=status&sortDirection=desc", JsonOptions);
        Assert.Equal(b2.Id, descRes!.Items[0].Id);
        Assert.Equal(b1.Id, descRes.Items[1].Id); // Cancelled
    }

    [Fact]
    public async Task GetMine_WithFilterAndSort_WorksTogether()
    {
        var client = await AuthenticatedTravelerAsync();
        var tier = await GetFirstTierAsync(client);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var bOutside = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 1); // Not in 10-30 window
        await Task.Delay(20);
        var bIn1 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 15);
        await Task.Delay(20);
        var bIn2 = await CreateBookingAsync(client, tier.Id, startDaysFromNow: 25);

        var fromStr = today.AddDays(10).ToString("yyyy-MM-dd");
        var toStr = today.AddDays(30).ToString("yyyy-MM-dd");

        var result = await client.GetFromJsonAsync<PagedResult<BookingDto>>(
            $"/api/bookings/mine?from={fromStr}&to={toStr}&sortBy=createdAt&sortDirection=desc", JsonOptions);

        Assert.NotNull(result);
        Assert.Equal(2, result!.TotalCount);
        Assert.Equal(bIn2.Id, result.Items[0].Id);
        Assert.Equal(bIn1.Id, result.Items[1].Id);
    }

    private static async Task<BookingDto> CreateBookingAsync(HttpClient client, Guid packageTierId, int startDaysFromNow)
    {
        var response = await client.PostAsJsonAsync("/api/bookings", new
        {
            PackageTierId = packageTierId,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(startDaysFromNow)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(startDaysFromNow + 3)),
            BudgetPerPerson = 500m
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<BookingDto>(JsonOptions))!;
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private static async Task<PackageTierDto> GetFirstTierAsync(HttpClient client)
    {
        var packages = await client.GetFromJsonAsync<List<TourPackageDto>>("/api/packages", JsonOptions);
        return packages!.First(p => p.Tiers.Count > 0).Tiers.First();
    }
}
