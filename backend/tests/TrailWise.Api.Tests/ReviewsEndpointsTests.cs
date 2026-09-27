using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Reviews;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ReviewsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ReviewsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SubmitReview_WhenBookingIsCompletedAndOwner_ReturnsCreated()
    {
        var (client, bookingId, packageId, _) = await SetupBookingAsync(BookingStatus.Completed);

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Phenomenal tour experience!"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var review = await response.Content.ReadFromJsonAsync<ReviewDto>(JsonOptions);
        Assert.NotNull(review);
        Assert.Equal(bookingId, review.BookingId);
        Assert.Equal(5, review.Rating);
        Assert.Equal("Phenomenal tour experience!", review.Comment);

        // Verify package reviews endpoint
        var packageReviewsResponse = await client.GetAsync($"/api/packages/{packageId}/reviews");
        Assert.Equal(HttpStatusCode.OK, packageReviewsResponse.StatusCode);
        var packageReviews = await packageReviewsResponse.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(packageReviews);
        Assert.Equal(1, packageReviews.TotalReviews);
        Assert.Equal(5.0, packageReviews.AverageRating);
        Assert.Single(packageReviews.Reviews);
    }

    [Fact]
    public async Task SubmitReview_WhenBookingIsNotCompleted_ReturnsBadRequest()
    {
        var (client, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Confirmed);

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 4,
            Comment = "Too early to review."
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitReview_WhenNotOwner_ReturnsForbidden()
    {
        var (_, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Completed);

        // Different traveler tries to review
        var otherClient = await AuthenticatedTravelerAsync();
        var response = await otherClient.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "I didn't take this trip."
        });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task SubmitReview_WhenDuplicateReviewSubmitted_ReturnsConflict()
    {
        var (client, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Completed);

        // First review
        var first = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 4,
            Comment = "First review"
        });
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        // Second review
        var second = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Second review attempt"
        });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task SubmitReview_WithInvalidRating_ReturnsBadRequest()
    {
        var (client, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Completed);

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 6, // Invalid
            Comment = "Out of bounds rating"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SubmitReview_WithNonexistentBooking_ReturnsNotFound()
    {
        var client = await AuthenticatedTravelerAsync();

        var response = await client.PostAsJsonAsync($"/api/bookings/{Guid.NewGuid()}/reviews", new
        {
            Rating = 5,
            Comment = "Ghost booking"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetPackageReviews_WhenPackageDoesNotExist_ReturnsNotFound()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync($"/api/packages/{Guid.NewGuid()}/reviews");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid PackageId, Guid TravelerId)> SetupBookingAsync(BookingStatus status)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = $"Review Test Tour {Guid.NewGuid():N}",
            Theme = "ReviewTheme",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 200m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (client, booking.Id, package.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Traveler R", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

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
}
