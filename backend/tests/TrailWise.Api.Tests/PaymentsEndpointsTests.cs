using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class PaymentsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public PaymentsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task CreatePayment_WhenBookingIsConfirmed_RecordsDepositAndReturnsCreated()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 150m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);
        Assert.Equal(150m, payment.Amount);
        Assert.Equal("Card", payment.Method);
        Assert.Equal("DepositPaid", payment.Status);

        // Check payment status
        var statusResponse = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var status = await statusResponse.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.NotNull(status);
        Assert.Equal(500m, status.TotalCost);
        Assert.Equal(150m, status.TotalPaid);
        Assert.Equal(350m, status.RemainingAmount);
        Assert.Equal("DepositPaid", status.Status);
    }

    [Fact]
    public async Task CreatePayment_WhenCumulativeAmountReachesTotal_SetsFullyPaid()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // First payment: 200 (Deposit)
        var firstResponse = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 200m,
            Method = "Card"
        });
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Second payment: 300 (Remaining balance -> FullyPaid)
        var secondResponse = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 300m,
            Method = "BankTransfer"
        });
        Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);
        var secondPayment = await secondResponse.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.Equal("FullyPaid", secondPayment!.Status);

        // Verify status
        var statusResponse = await client.GetAsync($"/api/bookings/{bookingId}/payment-status");
        var status = await statusResponse.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.Equal(500m, status!.TotalPaid);
        Assert.Equal(0m, status.RemainingAmount);
        Assert.Equal("FullyPaid", status.Status);
    }

    [Fact]
    public async Task CreatePayment_WhenAlreadyFullyPaid_ReturnsConflict()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // Pay full amount
        var initial = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 500m,
            Method = "Card"
        });
        Assert.Equal(HttpStatusCode.Created, initial.StatusCode);

        // Attempt another payment
        var nextResponse = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 50m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.Conflict, nextResponse.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_WhenBookingNotConfirmed_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m, status: BookingStatus.Requested);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 100m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_WhenNotOwner_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        // Another traveler
        var otherClient = await AuthenticatedTravelerAsync();
        var response = await otherClient.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 100m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_WithInvalidMethod_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 100m,
            Method = "CryptoCurrency"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePayment_WithNegativeOrZeroAmount_ReturnsBadRequest()
    {
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = -10m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPaymentStatus_AsManagerOrAdmin_ReturnsOk()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var adminClient = await AuthenticatedAdminAsync();
        var response = await adminClient.GetAsync($"/api/bookings/{bookingId}/payment-status");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var status = await response.Content.ReadFromJsonAsync<PaymentStatusDto>(JsonOptions);
        Assert.Equal(500m, status!.TotalCost);
        Assert.Equal("Pending", status.Status);
    }

    [Fact]
    public async Task GetPaymentStatus_AsUnrelatedTraveler_ReturnsForbidden()
    {
        var (_, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var otherClient = await AuthenticatedTravelerAsync();
        var response = await otherClient.GetAsync($"/api/bookings/{bookingId}/payment-status");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupConfirmedBookingWithPricingAsync(
        decimal totalCost,
        BookingStatus status = BookingStatus.Confirmed)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = "Payment Test Tour",
            Theme = "Test",
            DurationDays = 3,
            BasePricePerPerson = 250m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 250m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);

        var run = new AgentWorkflowRun
        {
            Booking = booking,
            Objective = "Pricing Test",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var stepLog = new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
            OutputJson = JsonSerializer.Serialize(new
            {
                totalCost,
                breakdown = "{}",
                validationResult = "Valid"
            }),
            DurationMs = 10
        };
        db.AgentStepLogs.Add(stepLog);

        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler T", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedTravelerAsync()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        return client;
    }

    private async Task<HttpClient> AuthenticatedAdminAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
