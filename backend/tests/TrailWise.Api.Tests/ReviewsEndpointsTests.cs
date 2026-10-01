using System.Net;
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
    public async Task CompletedBooking_WithoutReview_ReturnsHasReviewFalse()
    {
        var (client, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Completed);

        // Check GET /api/bookings/mine
        var myBookingsRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>("/api/bookings/mine", JsonOptions);
        Assert.NotNull(myBookingsRes);
        var bookingInMine = myBookingsRes!.Items.FirstOrDefault(b => b.Id == bookingId);
        Assert.NotNull(bookingInMine);
        Assert.False(bookingInMine.HasReview);

        // Check GET /api/bookings/{id}
        var getByIdRes = await client.GetFromJsonAsync<BookingDto>($"/api/bookings/{bookingId}", JsonOptions);
        Assert.NotNull(getByIdRes);
        Assert.False(getByIdRes.HasReview);
    }

    [Fact]
    public async Task CompletedBooking_WithExistingReview_ReturnsHasReviewTrue()
    {
        var (client, bookingId, _, _) = await SetupBookingAsync(BookingStatus.Completed);

        // Submit review
        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Phenomenal tour experience!"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // Check GET /api/bookings/mine
        var myBookingsRes = await client.GetFromJsonAsync<PagedResult<BookingDto>>("/api/bookings/mine", JsonOptions);
        Assert.NotNull(myBookingsRes);
        var bookingInMine = myBookingsRes!.Items.FirstOrDefault(b => b.Id == bookingId);
        Assert.NotNull(bookingInMine);
        Assert.True(bookingInMine.HasReview);

        // Check GET /api/bookings/{id}
        var getByIdRes = await client.GetFromJsonAsync<BookingDto>($"/api/bookings/{bookingId}", JsonOptions);
        Assert.NotNull(getByIdRes);
        Assert.True(getByIdRes.HasReview);
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
    public async Task SubmitReview_WhenCompletedAndDepositPaid_ReturnsBadRequest()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        Guid bookingId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var package = new TourPackage { Name = "Deposit Tour", Theme = "T", DurationDays = 3, BasePricePerPerson = 200m, MaxGroupSize = 10 };
            var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, IncludesFood = false, BasePricePerPerson = 200m, RequiresAC = false };
            var booking = new Booking
            {
                TravelerId = travelerId,
                TourPackage = package,
                PackageTier = tier,
                GroupSize = 2,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
                BudgetPerPerson = 500m,
                Status = BookingStatus.Completed
            };
            db.Bookings.Add(booking);

            var run = new AgentWorkflowRun { Booking = booking, Objective = "Pricing", Status = "Completed", StartedAt = DateTimeOffset.UtcNow };
            db.AgentWorkflowRuns.Add(run);
            db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRun = run,
                AgentName = "PricingValidationAgent",
                InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
                OutputJson = JsonSerializer.Serialize(new { totalCost = 400m, breakdown = "{}", validationResult = "Valid" }),
                DurationMs = 10
            });

            db.Payments.Add(new Payment
            {
                Booking = booking,
                Amount = 200m,
                Status = PaymentStatus.DepositPaid,
                SubmittedAt = DateTimeOffset.UtcNow.AddDays(-5),
                PaidAt = DateTimeOffset.UtcNow.AddDays(-5),
                Method = "BankTransfer",
                BankSlipUrl = "slips/test.jpg"
            });
            await db.SaveChangesAsync();
            bookingId = booking.Id;
        }

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Trying to review with deposit only"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Reviews can only be submitted after the booking is fully paid", content);
    }

    [Fact]
    public async Task SubmitReview_WhenCompletedAndPendingPayment_ReturnsBadRequest()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        Guid bookingId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var package = new TourPackage { Name = "Pending Tour", Theme = "T", DurationDays = 3, BasePricePerPerson = 200m, MaxGroupSize = 10 };
            var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, IncludesFood = false, BasePricePerPerson = 200m, RequiresAC = false };
            var booking = new Booking
            {
                TravelerId = travelerId,
                TourPackage = package,
                PackageTier = tier,
                GroupSize = 2,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
                BudgetPerPerson = 500m,
                Status = BookingStatus.Completed
            };
            db.Bookings.Add(booking);

            var run = new AgentWorkflowRun { Booking = booking, Objective = "Pricing", Status = "Completed", StartedAt = DateTimeOffset.UtcNow };
            db.AgentWorkflowRuns.Add(run);
            db.AgentStepLogs.Add(new AgentStepLog
            {
                WorkflowRun = run,
                AgentName = "PricingValidationAgent",
                InputJson = JsonSerializer.Serialize(new { bookingId = booking.Id }),
                OutputJson = JsonSerializer.Serialize(new { totalCost = 400m, breakdown = "{}", validationResult = "Valid" }),
                DurationMs = 10
            });

            db.Payments.Add(new Payment
            {
                Booking = booking,
                Amount = 200m,
                Status = PaymentStatus.DepositPaid,
                SubmittedAt = DateTimeOffset.UtcNow.AddDays(-5),
                PaidAt = DateTimeOffset.UtcNow.AddDays(-5),
                Method = "BankTransfer",
                BankSlipUrl = "slips/test.jpg"
            });
            db.Payments.Add(new Payment
            {
                Booking = booking,
                Amount = 200m,
                Status = PaymentStatus.Pending,
                SubmittedAt = DateTimeOffset.UtcNow.AddDays(-1),
                Method = "BankTransfer",
                BankSlipUrl = "slips/balance.jpg"
            });
            await db.SaveChangesAsync();
            bookingId = booking.Id;
        }

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Trying to review while pending"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Reviews cannot be submitted while payment verification is pending", content);
    }

    [Fact]
    public async Task SubmitReview_WhenCompletedAndPricingUnavailable_ReturnsBadRequest()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        Guid bookingId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var package = new TourPackage { Name = "No Pricing Tour", Theme = "T", DurationDays = 3, BasePricePerPerson = 200m, MaxGroupSize = 10 };
            var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, IncludesFood = false, BasePricePerPerson = 200m, RequiresAC = false };
            var booking = new Booking
            {
                TravelerId = travelerId,
                TourPackage = package,
                PackageTier = tier,
                GroupSize = 2,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
                BudgetPerPerson = 500m,
                Status = BookingStatus.Completed
            };
            db.Bookings.Add(booking);
            await db.SaveChangesAsync();
            bookingId = booking.Id;
        }

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Trying to review without pricing"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var content = await response.Content.ReadAsStringAsync();
        Assert.Contains("Booking pricing is not available yet", content);
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

    [Fact]
    public async Task PackageWithNoReviews_HasZeroAggregates_InAllEndpoints()
    {
        var packageId = await CreatePackageAsync("Zero Reviews Tour");
        var publicClient = _factory.CreateClient();
        var authClient = await AuthenticatedTravelerAsync();

        // 1. GET /api/packages/{id}/reviews (public)
        var reviewsRes = await publicClient.GetAsync($"/api/packages/{packageId}/reviews");
        Assert.Equal(HttpStatusCode.OK, reviewsRes.StatusCode);
        var reviewsData = await reviewsRes.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(reviewsData);
        Assert.Equal(0.0, reviewsData.AverageRating);
        Assert.Equal(0, reviewsData.TotalReviews);
        Assert.Empty(reviewsData.Reviews);

        // 2. GET /api/packages/{id} (authenticated)
        var pkgRes = await authClient.GetAsync($"/api/packages/{packageId}");
        Assert.Equal(HttpStatusCode.OK, pkgRes.StatusCode);
        var pkgData = await pkgRes.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.NotNull(pkgData);
        Assert.Equal(0.0, pkgData.AverageRating);
        Assert.Equal(0, pkgData.ReviewCount);

        // 3. GET /api/packages (authenticated)
        var allPkgsRes = await authClient.GetAsync("/api/packages");
        Assert.Equal(HttpStatusCode.OK, allPkgsRes.StatusCode);
        var allPkgs = await allPkgsRes.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions);
        Assert.NotNull(allPkgs);
        var matchingPkg = allPkgs.FirstOrDefault(p => p.Id == packageId);
        Assert.NotNull(matchingPkg);
        Assert.Equal(0.0, matchingPkg.AverageRating);
        Assert.Equal(0, matchingPkg.ReviewCount);
    }

    [Fact]
    public async Task MixedReviews_Ratings345_CalculatesAverageRating4Point0()
    {
        var packageId = await CreatePackageAsync("Mixed Reviews Tour 3-4-5");

        var (client1, booking1, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);
        var (client2, booking2, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);
        var (client3, booking3, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);

        await client1.PostAsJsonAsync($"/api/bookings/{booking1}/reviews", new { Rating = 3, Comment = "Good" });
        await client2.PostAsJsonAsync($"/api/bookings/{booking2}/reviews", new { Rating = 4, Comment = "Very good" });
        await client3.PostAsJsonAsync($"/api/bookings/{booking3}/reviews", new { Rating = 5, Comment = "Excellent" });

        var publicClient = _factory.CreateClient();
        var reviewsRes = await publicClient.GetAsync($"/api/packages/{packageId}/reviews");
        Assert.Equal(HttpStatusCode.OK, reviewsRes.StatusCode);
        var reviewsData = await reviewsRes.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(reviewsData);
        Assert.Equal(3, reviewsData.TotalReviews);
        Assert.Equal(4.0, reviewsData.AverageRating);
    }

    [Fact]
    public async Task TwoReviews_Ratings4And5_CalculatesAverageRating4Point5()
    {
        var packageId = await CreatePackageAsync("Two Reviews Tour 4-5");

        var (client1, booking1, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);
        var (client2, booking2, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);

        await client1.PostAsJsonAsync($"/api/bookings/{booking1}/reviews", new { Rating = 4, Comment = "Great" });
        await client2.PostAsJsonAsync($"/api/bookings/{booking2}/reviews", new { Rating = 5, Comment = "Amazing" });

        var publicClient = _factory.CreateClient();
        var reviewsRes = await publicClient.GetAsync($"/api/packages/{packageId}/reviews");
        Assert.Equal(HttpStatusCode.OK, reviewsRes.StatusCode);
        var reviewsData = await reviewsRes.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(reviewsData);
        Assert.Equal(2, reviewsData.TotalReviews);
        Assert.Equal(4.5, reviewsData.AverageRating);
    }

    [Fact]
    public async Task PackageEndpoints_IncludeAverageRatingAndReviewCount()
    {
        var packageId = await CreatePackageAsync("Aggregate Endpoint Tour");

        var (client1, booking1, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);
        var (client2, booking2, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);

        await client1.PostAsJsonAsync($"/api/bookings/{booking1}/reviews", new { Rating = 4, Comment = "Tour A" });
        await client2.PostAsJsonAsync($"/api/bookings/{booking2}/reviews", new { Rating = 5, Comment = "Tour B" });

        // Check GET /api/packages/{id}
        var pkgRes = await client1.GetAsync($"/api/packages/{packageId}");
        Assert.Equal(HttpStatusCode.OK, pkgRes.StatusCode);
        var pkgData = await pkgRes.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.NotNull(pkgData);
        Assert.Equal(4.5, pkgData.AverageRating);
        Assert.Equal(2, pkgData.ReviewCount);

        // Check GET /api/packages
        var allPkgsRes = await client1.GetAsync("/api/packages");
        Assert.Equal(HttpStatusCode.OK, allPkgsRes.StatusCode);
        var allPkgs = await allPkgsRes.Content.ReadFromJsonAsync<List<TourPackageDto>>(JsonOptions);
        Assert.NotNull(allPkgs);
        var pkgInList = allPkgs.FirstOrDefault(p => p.Id == packageId);
        Assert.NotNull(pkgInList);
        Assert.Equal(4.5, pkgInList.AverageRating);
        Assert.Equal(2, pkgInList.ReviewCount);
    }

    [Fact]
    public async Task PackageAReviews_DoNotAffectPackageBAggregates()
    {
        var packageAId = await CreatePackageAsync("Package A Tour");
        var packageBId = await CreatePackageAsync("Package B Tour");

        // Submit two 5-star reviews for Package A
        var (client1, booking1, _, _) = await SetupBookingForPackageAsync(packageAId, BookingStatus.Completed);
        var (client2, booking2, _, _) = await SetupBookingForPackageAsync(packageAId, BookingStatus.Completed);
        await client1.PostAsJsonAsync($"/api/bookings/{booking1}/reviews", new { Rating = 5, Comment = "A1" });
        await client2.PostAsJsonAsync($"/api/bookings/{booking2}/reviews", new { Rating = 5, Comment = "A2" });

        // Package A checks
        var pkgARes = await client1.GetAsync($"/api/packages/{packageAId}");
        Assert.Equal(HttpStatusCode.OK, pkgARes.StatusCode);
        var pkgA = await pkgARes.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.NotNull(pkgA);
        Assert.Equal(5.0, pkgA.AverageRating);
        Assert.Equal(2, pkgA.ReviewCount);

        // Package B checks - should remain completely unreviewed
        var pkgBRes = await client1.GetAsync($"/api/packages/{packageBId}");
        Assert.Equal(HttpStatusCode.OK, pkgBRes.StatusCode);
        var pkgB = await pkgBRes.Content.ReadFromJsonAsync<TourPackageDto>(JsonOptions);
        Assert.NotNull(pkgB);
        Assert.Equal(0.0, pkgB.AverageRating);
        Assert.Equal(0, pkgB.ReviewCount);

        var publicClient = _factory.CreateClient();
        var reviewsBRes = await publicClient.GetAsync($"/api/packages/{packageBId}/reviews");
        Assert.Equal(HttpStatusCode.OK, reviewsBRes.StatusCode);
        var reviewsB = await reviewsBRes.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(reviewsB);
        Assert.Equal(0.0, reviewsB.AverageRating);
        Assert.Equal(0, reviewsB.TotalReviews);
        Assert.Empty(reviewsB.Reviews);
    }

    [Fact]
    public async Task PublicReviewResponse_DoesNotExposePrivateDetails_AndContainsExpectedAttribution()
    {
        var (client, bookingId, packageId, travelerId) = await SetupBookingAsync(BookingStatus.Completed);

        await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Private checks tour"
        });

        var publicClient = _factory.CreateClient();
        var response = await publicClient.GetAsync($"/api/packages/{packageId}/reviews");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var jsonString = await response.Content.ReadAsStringAsync();

        // Assert no private fields are leaked in the public json response
        Assert.DoesNotContain("bookingId", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("travelerId", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("email", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("contactNumber", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("phoneNumber", jsonString, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(bookingId.ToString(), jsonString);
        Assert.DoesNotContain(travelerId.ToString(), jsonString);

        // Assert public DTO fields
        var packageReviews = JsonSerializer.Deserialize<PackageReviewsDto>(jsonString, JsonOptions);
        Assert.NotNull(packageReviews);
        Assert.Single(packageReviews.Reviews);
        var review = packageReviews.Reviews[0];
        Assert.Equal("Verified Traveler", review.ReviewerDisplayName);
        Assert.True(review.IsVerifiedTrip);
        Assert.Equal(5, review.Rating);
        Assert.Equal("Private checks tour", review.Comment);
    }

    [Fact]
    public async Task PackageReviews_OrderedNewestFirst()
    {
        var packageId = await CreatePackageAsync("Ordered Reviews Tour");

        var (client1, booking1, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);
        var (client2, booking2, _, _) = await SetupBookingForPackageAsync(packageId, BookingStatus.Completed);

        await client1.PostAsJsonAsync($"/api/bookings/{booking1}/reviews", new { Rating = 3, Comment = "First posted" });
        await Task.Delay(20);
        await client2.PostAsJsonAsync($"/api/bookings/{booking2}/reviews", new { Rating = 5, Comment = "Second posted" });

        var client = _factory.CreateClient();
        var reviewsRes = await client.GetAsync($"/api/packages/{packageId}/reviews");
        var reviewsData = await reviewsRes.Content.ReadFromJsonAsync<PackageReviewsDto>(JsonOptions);
        Assert.NotNull(reviewsData);
        Assert.Equal(2, reviewsData.Reviews.Count);

        // Newest first: second review should be first
        Assert.True(reviewsData.Reviews[0].SubmittedAt >= reviewsData.Reviews[1].SubmittedAt);
        Assert.Equal("Second posted", reviewsData.Reviews[0].Comment);
        Assert.Equal("First posted", reviewsData.Reviews[1].Comment);
    }

    [Fact]
    public async Task SubmitReview_CreatesReviewSubmittedAuditLog()
    {
        var (client, bookingId, _, travelerId) = await SetupBookingAsync(BookingStatus.Completed);

        var response = await client.PostAsJsonAsync($"/api/bookings/{bookingId}/reviews", new
        {
            Rating = 5,
            Comment = "Audit logged review"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var auditLog = await db.AuditLogs
            .FirstOrDefaultAsync(a => a.EntityType == "Review" && a.Action == "ReviewSubmitted" && a.Details != null && a.Details.Contains(bookingId.ToString()));

        Assert.NotNull(auditLog);
        Assert.Equal(travelerId, auditLog.PerformedBy);
        Assert.Contains(bookingId.ToString(), auditLog.Details);
    }

    private async Task<Guid> CreatePackageAsync(string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var package = new TourPackage
        {
            Name = $"{name} {Guid.NewGuid():N}",
            Theme = "Adventure",
            DurationDays = 3,
            BasePricePerPerson = 250m,
            MaxGroupSize = 12
        };
        db.TourPackages.Add(package);
        await db.SaveChangesAsync();
        return package.Id;
    }

    private async Task<(HttpClient Client, Guid BookingId, Guid PackageId, Guid TravelerId)> SetupBookingForPackageAsync(Guid packageId, BookingStatus status)
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var tier = new PackageTier
        {
            TourPackageId = packageId,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 250m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackageId = packageId,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7)),
            BudgetPerPerson = 500m,
            Status = status
        };

        db.Bookings.Add(booking);

        if (status == BookingStatus.Completed)
        {
            var totalCost = tier.BasePricePerPerson * booking.GroupSize;
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

            var payment = new Payment
            {
                Booking = booking,
                Amount = totalCost,
                Status = PaymentStatus.FullyPaid,
                SubmittedAt = DateTimeOffset.UtcNow.AddDays(-5),
                PaidAt = DateTimeOffset.UtcNow.AddDays(-5),
                Method = "BankTransfer",
                BankSlipUrl = "slips/test.jpg"
            };
            db.Payments.Add(payment);
        }

        await db.SaveChangesAsync();

        return (client, booking.Id, packageId, travelerId);
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

        if (status == BookingStatus.Completed)
        {
            var totalCost = tier.BasePricePerPerson * booking.GroupSize;
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

            var payment = new Payment
            {
                Booking = booking,
                Amount = totalCost,
                Status = PaymentStatus.FullyPaid,
                SubmittedAt = DateTimeOffset.UtcNow.AddDays(-5),
                PaidAt = DateTimeOffset.UtcNow.AddDays(-5),
                Method = "BankTransfer",
                BankSlipUrl = "slips/test.jpg"
            };
            db.Payments.Add(payment);
        }

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
