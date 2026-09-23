using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Api.Contracts.Reviews;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class AuditLogEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public AuditLogEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SuccessfulPayment_CreatesExactlyOneAuditLogRow()
    {
        var (client, bookingId, travelerId) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m);

        var response = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 150m,
            Method = "Card"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var payment = await response.Content.ReadFromJsonAsync<PaymentDto>(JsonOptions);
        Assert.NotNull(payment);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLogs = await db.AuditLogs
            .Where(a => a.EntityType == "Payment" && a.EntityId == payment.Id)
            .ToListAsync();

        Assert.Single(auditLogs);
        var log = auditLogs[0];
        Assert.Equal("PaymentRecorded", log.Action);
        Assert.Equal(travelerId, log.PerformedBy);
        Assert.True(log.Timestamp > DateTimeOffset.UtcNow.AddMinutes(-5));

        Assert.NotNull(log.Details);
        using var detailsDoc = JsonDocument.Parse(log.Details);
        var root = detailsDoc.RootElement;
        Assert.Equal(bookingId, root.GetProperty("bookingId").GetGuid());
        Assert.Equal(150m, root.GetProperty("amount").GetDecimal());
        Assert.Equal("Card", root.GetProperty("method").GetString());
        Assert.Equal("DepositPaid", root.GetProperty("status").GetString());

        // Verify sensitive tokens or passwords are not present
        Assert.False(root.TryGetProperty("token", out _));
        Assert.False(root.TryGetProperty("password", out _));
        Assert.False(root.TryGetProperty("secret", out _));
    }

    [Fact]
    public async Task FailedPaymentAttempt_DoesNotCreateAuditLogRow()
    {
        // Booking in Requested status (cannot be paid)
        var (client, bookingId, _) = await SetupConfirmedBookingWithPricingAsync(totalCost: 500m, status: BookingStatus.Requested);

        using (var scopeBefore = _factory.Services.CreateScope())
        {
            var dbBefore = scopeBefore.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var countBefore = await dbBefore.AuditLogs
                .CountAsync(a => a.EntityType == "Payment" && a.Details != null && a.Details.Contains(bookingId.ToString()));
            Assert.Equal(0, countBefore);
        }

        // Attempt 1: invalid booking status
        var response1 = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 100m,
            Method = "Card"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response1.StatusCode);

        // Attempt 2: invalid method
        var response2 = await client.PostAsJsonAsync("/api/payments", new
        {
            BookingId = bookingId,
            Amount = 100m,
            Method = "InvalidMethod"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response2.StatusCode);

        using (var scopeAfter = _factory.Services.CreateScope())
        {
            var dbAfter = scopeAfter.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var paymentLogs = await dbAfter.AuditLogs
                .Where(a => a.EntityType == "Payment" && a.Details != null && a.Details.Contains(bookingId.ToString()))
                .ToListAsync();

            Assert.Empty(paymentLogs);
        }
    }

    [Fact]
    public async Task SuccessfulReview_CreatesExactlyOneAuditLogRow()
    {
        var (client, bookingId, travelerId) = await SetupCompletedBookingAsync();

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Outstanding experience across the board!"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var review = await response.Content.ReadFromJsonAsync<ReviewDto>(JsonOptions);
        Assert.NotNull(review);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLogs = await db.AuditLogs
            .Where(a => a.EntityType == "Review" && a.EntityId == review.Id)
            .ToListAsync();

        Assert.Single(auditLogs);
        var log = auditLogs[0];
        Assert.Equal("ReviewSubmitted", log.Action);
        Assert.Equal(travelerId, log.PerformedBy);
        Assert.True(log.Timestamp > DateTimeOffset.UtcNow.AddMinutes(-5));

        Assert.NotNull(log.Details);
        using var detailsDoc = JsonDocument.Parse(log.Details);
        var root = detailsDoc.RootElement;
        Assert.Equal(bookingId, root.GetProperty("bookingId").GetGuid());
        Assert.Equal(5, root.GetProperty("rating").GetInt32());

        // Verify unnecessary traveler personal data or comments are not stored in audit details
        Assert.False(root.TryGetProperty("comment", out _));
        Assert.False(root.TryGetProperty("email", out _));
        Assert.False(root.TryGetProperty("password", out _));
    }

    [Fact]
    public async Task FailedReviewAttempt_DoesNotCreateAuditLogRow()
    {
        // Booking is in Confirmed status, not Completed
        var (client, bookingId, _) = await SetupBookingWithStatusAsync(BookingStatus.Confirmed);

        // Attempt 1: booking not completed
        var response1 = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 4,
            Comment = "Trip hasn't completed yet."
        });
        Assert.Equal(HttpStatusCode.BadRequest, response1.StatusCode);

        // Attempt 2: rating out of bounds
        var response2 = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 99,
            Comment = "Invalid rating"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response2.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var reviewLogs = await db.AuditLogs
            .Where(a => a.EntityType == "Review" && a.Details != null && a.Details.Contains(bookingId.ToString()))
            .ToListAsync();

        Assert.Empty(reviewLogs);
    }

    [Fact]
    public async Task DuplicateReviewAttempt_DoesNotCreateSecondAuditLogRow()
    {
        var (client, bookingId, travelerId) = await SetupCompletedBookingAsync();

        // First review succeeds
        var firstResponse = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 4,
            Comment = "Great tour!"
        });
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Duplicate review fails with 409 Conflict
        var secondResponse = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Trying to review again"
        });
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var reviewLogs = await db.AuditLogs
            .Where(a => a.EntityType == "Review" && a.Details != null && a.Details.Contains(bookingId.ToString()))
            .ToListAsync();

        // Exactly one row was created for the first successful review, not for the rejected duplicate
        Assert.Single(reviewLogs);
        Assert.Equal("ReviewSubmitted", reviewLogs[0].Action);
        Assert.Equal(travelerId, reviewLogs[0].PerformedBy);
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
            Name = $"Audit Test Tour {Guid.NewGuid():N}",
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

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupCompletedBookingAsync()
    {
        return await SetupBookingWithStatusAsync(BookingStatus.Completed);
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupBookingWithStatusAsync(BookingStatus status)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = $"Audit Review Package {Guid.NewGuid():N}",
            Theme = "Cultural",
            DurationDays = 3,
            BasePricePerPerson = 300m,
            MaxGroupSize = 8
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.First,
            IncludesFood = true,
            BasePricePerPerson = 450m,
            RequiresAC = true
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            BudgetPerPerson = 600m,
            Status = status
        };

        db.Bookings.Add(booking);
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
}
