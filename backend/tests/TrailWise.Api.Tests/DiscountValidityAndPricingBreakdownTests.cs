using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Discounts;
using TrailWise.Api.Contracts.Payments;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class DiscountValidityAndPricingBreakdownTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public DiscountValidityAndPricingBreakdownTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private class TestClock : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = new(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
    }

    private static GuideMatchResult GoodGuide() =>
        new(Guid.NewGuid(), 0.9, "Cultural Guide");

    private static VehicleMatchResult GoodVehicle() =>
        new(Guid.NewGuid(), Guid.NewGuid(), AcMatch: true, SeatConfigMatch: true, ConflictCheck: false);

    private static Booking SeedBooking(
        TrailWiseDbContext db,
        int groupSize = 5,
        decimal basePricePerPerson = 100m,
        int durationDays = 3,
        List<decimal>? addOnCosts = null)
    {
        var traveler = new User
        {
            Name = "Traveler Test",
            Email = $"traveler-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550100",
            PasswordHash = "irrelevant",
            Role = UserRole.Traveler
        };

        var package = new TourPackage
        {
            Name = "Package Test",
            Theme = "Testing",
            DurationDays = durationDays,
            BasePricePerPerson = basePricePerPerson,
            MaxGroupSize = 50
        };

        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = basePricePerPerson,
            RequiresAC = false
        };

        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = groupSize,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30 + durationDays)),
            BudgetPerPerson = 1000m,
            Status = BookingStatus.Requested
        };

        if (addOnCosts != null)
        {
            foreach (var cost in addOnCosts)
            {
                booking.BookingAddOns.Add(new BookingAddOn
                {
                    Booking = booking,
                    Description = "Addon",
                    Cost = cost
                });
            }
        }

        db.Users.Add(traveler);
        db.TourPackages.Add(package);
        db.PackageTiers.Add(tier);
        db.Bookings.Add(booking);
        db.SaveChanges();

        return booking;
    }

    // 1. existing migrated discount defaults IsActive=true
    [Fact]
    public void Test01_ExistingMigratedDiscount_DefaultsIsActiveTrue()
    {
        var discount = new Discount
        {
            Description = "Standard Discount",
            PercentageOff = 10m,
            MinGroupSize = 4
        };

        Assert.True(discount.IsActive);
        Assert.Null(discount.ValidFrom);
        Assert.Null(discount.ValidUntil);
    }

    // 2. inactive discount ignored
    [Fact]
    public async Task Test02_InactiveDiscount_Ignored()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 5);

        db.Discounts.Add(new Discount
        {
            Description = "Inactive Discount",
            PercentageOff = 20m,
            MinGroupSize = 2,
            IsActive = false
        });
        db.SaveChanges();

        var clock = new TestClock();
        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
    }

    // 3. future/upcoming discount ignored
    [Fact]
    public async Task Test03_FutureUpcomingDiscount_Ignored()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 5);
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero) };

        db.Discounts.Add(new Discount
        {
            Description = "Future Promo",
            PercentageOff = 25m,
            MinGroupSize = 2,
            IsActive = true,
            ValidFrom = clock.UtcNow.AddDays(2),
            ValidUntil = clock.UtcNow.AddDays(10)
        });
        db.SaveChanges();

        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
    }

    // 4. expired discount ignored
    [Fact]
    public async Task Test04_ExpiredDiscount_Ignored()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 5);
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero) };

        db.Discounts.Add(new Discount
        {
            Description = "Past Promo",
            PercentageOff = 25m,
            MinGroupSize = 2,
            IsActive = true,
            ValidFrom = clock.UtcNow.AddDays(-10),
            ValidUntil = clock.UtcNow.AddDays(-1)
        });
        db.SaveChanges();

        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
    }

    // 5. valid discount applied
    [Fact]
    public async Task Test05_ValidDiscount_Applied()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 5, basePricePerPerson: 100m, durationDays: 3);
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero) };

        db.Discounts.Add(new Discount
        {
            Description = "Active Promo",
            PercentageOff = 10m,
            MinGroupSize = 3,
            IsActive = true,
            ValidFrom = clock.UtcNow.AddDays(-1),
            ValidUntil = clock.UtcNow.AddDays(1)
        });
        db.SaveChanges();

        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        // Base = 500, Catering = 15*5*3 = 225, Subtotal = 725, 10% = 72.50
        Assert.Equal(72.50m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
        Assert.Equal(652.50m, doc.RootElement.GetProperty("finalTotal").GetDecimal());
        Assert.Equal("Active Promo", doc.RootElement.GetProperty("discountDescription").GetString());
    }

    // 6. no-date active discount applies
    [Fact]
    public async Task Test06_NoDateActiveDiscount_Applies()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4, basePricePerPerson: 100m, durationDays: 3);

        db.Discounts.Add(new Discount
        {
            Description = "Always Available",
            PercentageOff = 10m,
            MinGroupSize = 4,
            IsActive = true,
            ValidFrom = null,
            ValidUntil = null
        });
        db.SaveChanges();

        var agent = new PricingValidationAgent(db);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(10m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
        Assert.Equal("Always Available", doc.RootElement.GetProperty("discountDescription").GetString());
    }

    // 7. ValidFrom-only behavior
    [Fact]
    public async Task Test07_ValidFromOnlyBehavior()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4);
        var fixedTime = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);

        db.Discounts.Add(new Discount
        {
            Description = "From Only",
            PercentageOff = 15m,
            MinGroupSize = 4,
            IsActive = true,
            ValidFrom = fixedTime
        });
        db.SaveChanges();

        // Before ValidFrom -> not applied
        var clockBefore = new TestClock { UtcNow = fixedTime.AddMinutes(-1) };
        var agentBefore = new PricingValidationAgent(db, clockBefore);
        var resBefore = await agentBefore.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());
        using (var doc = JsonDocument.Parse(resBefore.Breakdown))
        {
            Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
        }

        // After ValidFrom -> applied
        var clockAfter = new TestClock { UtcNow = fixedTime.AddMinutes(1) };
        var agentAfter = new PricingValidationAgent(db, clockAfter);
        var resAfter = await agentAfter.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());
        using (var doc = JsonDocument.Parse(resAfter.Breakdown))
        {
            Assert.Equal(15m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
        }
    }

    // 8. ValidUntil-only behavior
    [Fact]
    public async Task Test08_ValidUntilOnlyBehavior()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4);
        var fixedTime = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);

        db.Discounts.Add(new Discount
        {
            Description = "Until Only",
            PercentageOff = 15m,
            MinGroupSize = 4,
            IsActive = true,
            ValidUntil = fixedTime
        });
        db.SaveChanges();

        // Before ValidUntil -> applied
        var clockBefore = new TestClock { UtcNow = fixedTime.AddMinutes(-1) };
        var agentBefore = new PricingValidationAgent(db, clockBefore);
        var resBefore = await agentBefore.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());
        using (var doc = JsonDocument.Parse(resBefore.Breakdown))
        {
            Assert.Equal(15m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
        }

        // After ValidUntil -> not applied
        var clockAfter = new TestClock { UtcNow = fixedTime.AddMinutes(1) };
        var agentAfter = new PricingValidationAgent(db, clockAfter);
        var resAfter = await agentAfter.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());
        using (var doc = JsonDocument.Parse(resAfter.Breakdown))
        {
            Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
        }
    }

    // 9. boundary now == ValidFrom qualifies
    [Fact]
    public async Task Test09_BoundaryNowEqualsValidFrom_Qualifies()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4);
        var fixedTime = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);

        db.Discounts.Add(new Discount
        {
            Description = "Boundary Start",
            PercentageOff = 10m,
            MinGroupSize = 4,
            IsActive = true,
            ValidFrom = fixedTime
        });
        db.SaveChanges();

        var clock = new TestClock { UtcNow = fixedTime };
        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(10m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
    }

    // 10. boundary now == ValidUntil qualifies
    [Fact]
    public async Task Test10_BoundaryNowEqualsValidUntil_Qualifies()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4);
        var fixedTime = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);

        db.Discounts.Add(new Discount
        {
            Description = "Boundary End",
            PercentageOff = 10m,
            MinGroupSize = 4,
            IsActive = true,
            ValidUntil = fixedTime
        });
        db.SaveChanges();

        var clock = new TestClock { UtcNow = fixedTime };
        var agent = new PricingValidationAgent(db, clock);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(10m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
    }

    // 11. best qualifying discount ordering unchanged
    [Fact]
    public async Task Test11_BestQualifyingDiscountOrderingUnchanged()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 10);

        var now = DateTimeOffset.UtcNow;
        db.Discounts.AddRange(
            new Discount
            {
                Description = "Discount 10%",
                PercentageOff = 10m,
                MinGroupSize = 5,
                IsActive = true,
                CreatedAt = now.AddMinutes(-10)
            },
            new Discount
            {
                Description = "Discount 15% Min5",
                PercentageOff = 15m,
                MinGroupSize = 5,
                IsActive = true,
                CreatedAt = now.AddMinutes(-5)
            },
            new Discount
            {
                Description = "Discount 15% Min10",
                PercentageOff = 15m,
                MinGroupSize = 10,
                IsActive = true,
                CreatedAt = now.AddMinutes(-2)
            }
        );
        db.SaveChanges();

        var agent = new PricingValidationAgent(db);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        // Between 15% Min10 and 15% Min5, MinGroupSize DESC chooses Min10!
        Assert.Equal("Discount 15% Min10", doc.RootElement.GetProperty("discountDescription").GetString());
        Assert.Equal(15m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
    }

    // 12. invalid ValidUntil < ValidFrom rejected
    [Fact]
    public void Test12_InvalidValidUntilLessThanValidFrom_Rejected()
    {
        var request = new CreateDiscountRequest
        {
            Description = "Invalid Range",
            PercentageOff = 10m,
            MinGroupSize = 2,
            ValidFrom = new DateTimeOffset(2026, 10, 5, 0, 0, 0, TimeSpan.Zero),
            ValidUntil = new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero)
        };

        var validationContext = new ValidationContext(request);
        var validationResults = request.Validate(validationContext).ToList();

        Assert.NotEmpty(validationResults);
        Assert.Contains(validationResults, v => v.ErrorMessage!.Contains("ValidUntil must be greater than or equal to ValidFrom"));
    }

    // 13. traveler active endpoint excludes inactive
    // 14. traveler active endpoint excludes future
    // 15. traveler active endpoint excludes expired
    [Fact]
    public async Task Test13_14_15_TravelerActiveEndpoint_ExcludesInactiveFutureAndExpired()
    {
        var db = TestDbContextFactory.Create();
        var fixedNow = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
        var clock = new TestClock { UtcNow = fixedNow };

        var service = new DiscountService(db, new TestAuditLogService(), Microsoft.Extensions.Logging.Abstractions.NullLogger<DiscountService>.Instance, clock);

        await service.CreateAsync("Inactive", 10m, 2, isActive: false);
        await service.CreateAsync("Future", 15m, 2, isActive: true, validFrom: fixedNow.AddDays(1));
        await service.CreateAsync("Expired", 20m, 2, isActive: true, validUntil: fixedNow.AddDays(-1));
        await service.CreateAsync("Active Valid", 12m, 2, isActive: true, validFrom: fixedNow.AddDays(-1), validUntil: fixedNow.AddDays(1));

        var activeList = await service.GetActiveDiscountsAsync(fixedNow);

        Assert.Single(activeList);
        Assert.Equal("Active Valid", activeList[0].Description);
    }

    // 16. historical pricing unaffected after discount deactivation
    // 17. historical pricing unaffected after discount update
    [Fact]
    public async Task Test16_17_HistoricalPricingUnaffectedAfterDiscountDeactivationOrUpdate()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 5);

        var discount = new Discount
        {
            Description = "Initial Discount",
            PercentageOff = 20m,
            MinGroupSize = 2,
            IsActive = true
        };
        db.Discounts.Add(discount);
        db.SaveChanges();

        // Run pricing and record snapshot
        var run = new AgentWorkflowRun
        {
            BookingId = booking.Id,
            Objective = "Pricing",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var snapshotJson = JsonSerializer.Serialize(new
        {
            totalCost = 500m,
            breakdown = JsonSerializer.Serialize(new
            {
                tierBasePrice = 600m,
                cateringCost = 25m,
                addOnsCost = 0m,
                subtotal = 625m,
                discountDescription = "Initial Discount",
                discountPercentage = 20m,
                groupDiscount = 125m,
                finalTotal = 500m
            })
        });

        db.AgentStepLogs.Add(new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = "{}",
            OutputJson = snapshotJson,
            DurationMs = 15
        });
        db.SaveChanges();

        // Create PaymentService
        var paymentService = new PaymentService(db, new TestAuditLogService(), Microsoft.Extensions.Logging.Abstractions.NullLogger<PaymentService>.Instance, new TestClock());

        // Deactivate discount in DB
        discount.IsActive = false;
        discount.PercentageOff = 50m;
        discount.Description = "Modified Discount";
        db.SaveChanges();

        // Fetch payment status
        var status = await paymentService.GetPaymentStatusAsync(booking.Id, booking.TravelerId, false);

        Assert.NotNull(status.PricingBreakdown);
        Assert.Equal(500m, status.TotalCost);
        Assert.Equal(625m, status.PricingBreakdown!.Subtotal);
        Assert.Equal(125m, status.PricingBreakdown.DiscountAmount);
        Assert.Equal(500m, status.PricingBreakdown.FinalTotal);
        Assert.Equal("Initial Discount", status.PricingBreakdown.DiscountDescription);
        Assert.Equal(20m, status.PricingBreakdown.DiscountPercentage);
    }

    // 18. PaymentStatus returns PricingBreakdown
    // 19. breakdown subtotal math correct
    // 20. breakdown final total math correct
    [Fact]
    public async Task Test18_19_20_PaymentStatus_ReturnsPricingBreakdown_AndMathIsCorrect()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 4);

        var run = new AgentWorkflowRun
        {
            BookingId = booking.Id,
            Objective = "Pricing",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var snapshotJson = JsonSerializer.Serialize(new
        {
            totalCost = 594m,
            breakdown = JsonSerializer.Serialize(new
            {
                tierBasePrice = 600m,
                cateringCost = 60m,
                addOnsCost = 0m,
                subtotal = 660m,
                discountDescription = "Group Discount (10%)",
                discountPercentage = 10m,
                groupDiscount = 66m,
                finalTotal = 594m
            })
        });

        db.AgentStepLogs.Add(new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = "{}",
            OutputJson = snapshotJson,
            DurationMs = 10
        });
        db.SaveChanges();

        var paymentService = new PaymentService(db, new TestAuditLogService(), Microsoft.Extensions.Logging.Abstractions.NullLogger<PaymentService>.Instance, new TestClock());
        var status = await paymentService.GetPaymentStatusAsync(booking.Id, booking.TravelerId, false);

        Assert.NotNull(status.PricingBreakdown);
        var bd = status.PricingBreakdown!;
        Assert.Equal(600m, bd.BaseCost);
        Assert.Equal(60m, bd.CateringCost);
        Assert.Equal(0m, bd.AddOnCost);

        // Subtotal = BaseCost + CateringCost + AddOnCost
        Assert.Equal(bd.BaseCost + bd.CateringCost + bd.AddOnCost, bd.Subtotal);

        // FinalTotal = Subtotal - DiscountAmount
        Assert.Equal(bd.Subtotal - bd.DiscountAmount, bd.FinalTotal);
        Assert.Equal(status.TotalCost, bd.FinalTotal);
    }

    // 21. no discount returns zero DiscountAmount
    [Fact]
    public async Task Test21_NoDiscount_ReturnsZeroDiscountAmount()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 2);

        var agent = new PricingValidationAgent(db);
        var result = await agent.CalculateAsync(booking.Id, GoodGuide(), GoodVehicle());

        using var doc = JsonDocument.Parse(result.Breakdown);
        Assert.Equal(0m, doc.RootElement.GetProperty("groupDiscount").GetDecimal());
        Assert.Equal(0m, doc.RootElement.GetProperty("discountPercentage").GetDecimal());
        Assert.True(doc.RootElement.GetProperty("discountDescription").ValueKind == JsonValueKind.Null);
    }

    // 22. malformed/missing old breakdown does not break payment status
    [Fact]
    public async Task Test22_MalformedMissingOldBreakdown_DoesNotBreakPaymentStatus()
    {
        var db = TestDbContextFactory.Create();
        var booking = SeedBooking(db, groupSize: 2);

        var run = new AgentWorkflowRun
        {
            BookingId = booking.Id,
            Objective = "Pricing",
            Status = "Completed",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        // Older or corrupted output JSON missing breakdown
        var legacyJson = JsonSerializer.Serialize(new
        {
            totalCost = 350m,
            breakdown = "not a valid json object"
        });

        db.AgentStepLogs.Add(new AgentStepLog
        {
            WorkflowRun = run,
            AgentName = "PricingValidationAgent",
            InputJson = "{}",
            OutputJson = legacyJson,
            DurationMs = 5
        });
        db.SaveChanges();

        var paymentService = new PaymentService(db, new TestAuditLogService(), Microsoft.Extensions.Logging.Abstractions.NullLogger<PaymentService>.Instance, new TestClock());
        var status = await paymentService.GetPaymentStatusAsync(booking.Id, booking.TravelerId, false);

        Assert.Equal(350m, status.TotalCost);
        Assert.Null(status.PricingBreakdown); // Safely null, does not crash!
    }

    private class TestAuditLogService : IAuditLogService
    {
        public Task LogAsync(
            string entityType,
            Guid entityId,
            string action,
            Guid performedBy,
            object? details = null,
            CancellationToken ct = default) => Task.CompletedTask;

        public Task LogAsync(
            string entityType,
            Guid entityId,
            string action,
            Guid? performedBy,
            object? details = null,
            CancellationToken ct = default) => Task.CompletedTask;
    }
}
