using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;

namespace TrailWise.Api.Tests;

public class PaymentDeadlineTests
{
    private class TestClock : IClock
    {
        public DateTimeOffset UtcNow { get; set; } = new(2026, 9, 29, 10, 0, 0, TimeSpan.Zero);
    }

    private static readonly ILoggerFactory LoggerFactory = Microsoft.Extensions.Logging.LoggerFactory.Create(_ => { });

    private class TestFixture
    {
        public DbContextOptions<TrailWiseDbContext> Options { get; }
        public IServiceScopeFactory ScopeFactory { get; }

        public TestFixture()
        {
            var dbName = Guid.NewGuid().ToString();
            Options = new DbContextOptionsBuilder<TrailWiseDbContext>()
                .UseInMemoryDatabase(dbName)
                .Options;

            var services = new ServiceCollection();
            services.AddDbContext<TrailWiseDbContext>(o => o.UseInMemoryDatabase(dbName));
            services.AddScoped<IAuditLogService, AuditLogService>();
            services.AddLogging();
            var sp = services.BuildServiceProvider();
            ScopeFactory = sp.GetRequiredService<IServiceScopeFactory>();
        }

        public TrailWiseDbContext CreateDbContext() => new(Options);

        public IAuditLogService CreateAuditLogService(TrailWiseDbContext db) =>
            new AuditLogService(db, LoggerFactory.CreateLogger<AuditLogService>());
    }

    private static async Task<(Booking Booking, TourPackage Package, Guid TravelerId)> SeedBookingAsync(
        TrailWiseDbContext db,
        BookingStatus status = BookingStatus.Confirmed,
        decimal totalCost = 500m,
        DateTimeOffset? paymentDueAt = null)
    {
        var travelerId = Guid.NewGuid();
        var package = new TourPackage
        {
            Name = "Deadline Test Tour",
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
            BudgetPerPerson = 250m,
            Status = status,
            PaymentDueAt = paymentDueAt
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
            OutputJson = JsonSerializer.Serialize(new { totalCost, validationResult = "Valid" }),
            DurationMs = 10
        };
        db.AgentStepLogs.Add(stepLog);

        await db.SaveChangesAsync();

        return (booking, package, travelerId);
    }

    // 1. Requested -> Confirmed creates PaymentDueAt
    [Fact]
    public void RequestedToConfirmed_CreatesPaymentDueAt()
    {
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 12, 0, 0, TimeSpan.Zero) };
        var lifecycle = new BookingLifecycleService(clock);
        var booking = new Booking
        {
            Status = BookingStatus.Requested,
            PaymentDueAt = null
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);

        Assert.True(transitioned);
        Assert.Equal(BookingStatus.Confirmed, booking.Status);
        Assert.NotNull(booking.PaymentDueAt);
        Assert.Equal(clock.UtcNow.AddHours(1), booking.PaymentDueAt);
    }

    // 2. PendingApproval -> Confirmed creates PaymentDueAt
    [Fact]
    public void PendingApprovalToConfirmed_CreatesPaymentDueAt()
    {
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 14, 15, 0, TimeSpan.Zero) };
        var lifecycle = new BookingLifecycleService(clock);
        var booking = new Booking
        {
            Status = BookingStatus.PendingApproval,
            PaymentDueAt = null
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);

        Assert.True(transitioned);
        Assert.Equal(BookingStatus.Confirmed, booking.Status);
        Assert.NotNull(booking.PaymentDueAt);
        Assert.Equal(clock.UtcNow.AddHours(1), booking.PaymentDueAt);
    }

    // 3. Existing PaymentDueAt is never overwritten
    [Fact]
    public void ExistingPaymentDueAt_IsNeverOverwritten()
    {
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        var lifecycle = new BookingLifecycleService(clock);
        var existingDeadline = clock.UtcNow.AddMinutes(45);
        var booking = new Booking
        {
            Status = BookingStatus.Requested,
            PaymentDueAt = existingDeadline
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);

        Assert.True(transitioned);
        Assert.Equal(BookingStatus.Confirmed, booking.Status);
        Assert.Equal(existingDeadline, booking.PaymentDueAt);
    }

    // 4. Saving unrelated changes on existing Confirmed booking with PaymentDueAt null does NOT create a deadline
    [Fact]
    public async Task SavingUnrelatedChanges_OnExistingConfirmedBooking_WithNullPaymentDueAt_DoesNotCreateDeadline()
    {
        var fixture = new TestFixture();
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed, paymentDueAt: null);
            bookingId = booking.Id;
        }

        using (var db = fixture.CreateDbContext())
        {
            var booking = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(booking);
            Assert.Null(booking.PaymentDueAt);

            // Make an unrelated update
            booking.SpecialRequests = "Vegetarian meal preference";
            booking.GroupSize = 5;
            await db.SaveChangesAsync();
        }

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(refreshed);
            Assert.Equal(BookingStatus.Confirmed, refreshed.Status);
            Assert.Equal("Vegetarian meal preference", refreshed.SpecialRequests);
            Assert.Equal(5, refreshed.GroupSize);
            Assert.Null(refreshed.PaymentDueAt);
        }
    }

    // 5. Saving unrelated changes on Confirmed booking with deadline does not modify deadline
    [Fact]
    public async Task SavingUnrelatedChanges_OnConfirmedBooking_WithDeadline_DoesNotModifyDeadline()
    {
        var fixture = new TestFixture();
        var fixedDeadline = new DateTimeOffset(2026, 9, 29, 12, 0, 0, TimeSpan.Zero);
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed, paymentDueAt: fixedDeadline);
            bookingId = booking.Id;
        }

        using (var db = fixture.CreateDbContext())
        {
            var booking = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(booking);
            booking.SpecialRequests = "Late arrival expected";
            await db.SaveChangesAsync();
        }

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(refreshed);
            Assert.Equal(fixedDeadline, refreshed.PaymentDueAt);
        }
    }

    // 7 & 8. Fake/injected clock determines exact PaymentDueAt which equals fakeClock.UtcNow + 1 hour exactly
    [Fact]
    public void FakeInjectedClock_DeterminesExactPaymentDueAt_EqualsClockUtcNowPlusOneHour()
    {
        var fixedTime = new DateTimeOffset(2026, 9, 29, 16, 45, 12, 345, TimeSpan.Zero);
        var clock = new TestClock { UtcNow = fixedTime };
        var lifecycle = new BookingLifecycleService(clock);
        var booking = new Booking
        {
            Status = BookingStatus.Requested,
            PaymentDueAt = null
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);

        Assert.True(transitioned);
        Assert.Equal(fixedTime.AddHours(1), booking.PaymentDueAt);
    }

    // Historical or already Confirmed booking does not re-transition or set deadline
    [Fact]
    public void AlreadyConfirmedBooking_TransitionReturnsFalse_AndPreservesPaymentDueAt()
    {
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        var lifecycle = new BookingLifecycleService(clock);
        var booking = new Booking
        {
            Status = BookingStatus.Confirmed,
            PaymentDueAt = null
        };

        var transitioned = lifecycle.TransitionToConfirmed(booking);

        Assert.False(transitioned);
        Assert.Null(booking.PaymentDueAt);
    }

    // 2. Non-confirmed booking has no deadline
    [Theory]
    [InlineData(BookingStatus.Requested)]
    [InlineData(BookingStatus.PlanProposed)]
    [InlineData(BookingStatus.PendingApproval)]
    [InlineData(BookingStatus.NeedsManualReview)]
    [InlineData(BookingStatus.Completed)]
    [InlineData(BookingStatus.Cancelled)]
    public async Task NonConfirmedBooking_HasNoPaymentDueAtDeadline(BookingStatus status)
    {
        var fixture = new TestFixture();
        using var db = fixture.CreateDbContext();
        var (booking, _, _) = await SeedBookingAsync(db, status);

        Assert.Null(booking.PaymentDueAt);
    }

    // 3. Unpaid confirmed booking expires after deadline
    // 4. Expired booking becomes Cancelled
    // 5. PaymentExpiredAt is set
    // 6. CancellationReason is set
    // 7. BookingPaymentExpired audit is written
    [Fact]
    public async Task UnpaidConfirmedBooking_ExpiresAfterDeadline_SetsCancelledAndAudit()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            await db.SaveChangesAsync();
        }

        // Advance time past deadline
        clock.UtcNow = clock.UtcNow.AddMinutes(61);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(1, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(refreshed);
            Assert.Equal(BookingStatus.Cancelled, refreshed.Status); // Test 4
            Assert.Equal(clock.UtcNow, refreshed.PaymentExpiredAt); // Test 5
            Assert.Equal("Advance payment was not submitted within the required 1-hour period.", refreshed.CancellationReason); // Test 6

            var audit = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.EntityType == "Booking" && a.EntityId == bookingId && a.Action == "BookingPaymentExpired");
            Assert.NotNull(audit); // Test 7
            Assert.Contains("Confirmed", audit.Details);
            Assert.Contains("Cancelled", audit.Details);
        }
    }

    // 8. Expiry is idempotent
    // 9. No duplicate audit on subsequent service runs
    [Fact]
    public async Task Expiry_IsIdempotent_NoDuplicateAuditOnSubsequentRuns()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(-5);
            await db.SaveChangesAsync();
        }

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var firstRun = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(1, firstRun);

        var secondRun = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(0, secondRun); // Test 8: idempotent

        using (var db = fixture.CreateDbContext())
        {
            var auditCount = await db.AuditLogs
                .CountAsync(a => a.EntityType == "Booking" && a.EntityId == bookingId && a.Action == "BookingPaymentExpired");
            Assert.Equal(1, auditCount); // Test 9: no duplicate audit
        }
    }

    // 10. Pending slip submitted before deadline prevents expiry
    [Fact]
    public async Task PendingSlip_SubmittedBeforeDeadline_PreventsExpiry()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var payment = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip1.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(45), // before deadline
                Status = PaymentStatus.Pending
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
        }

        // Advance past deadline
        clock.UtcNow = clock.UtcNow.AddMinutes(75);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(0, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshed!.Status);
            Assert.Null(refreshed.PaymentExpiredAt);
        }
    }

    // 11. Pending slip approved after deadline remains valid
    [Fact]
    public async Task PendingSlip_ApprovedAfterDeadline_RemainsValid()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid paymentId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var payment = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip1.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(45),
                Status = PaymentStatus.Pending
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            paymentId = payment.Id;
        }

        // Staff reviews at 11:30 (past deadline)
        clock.UtcNow = clock.UtcNow.AddMinutes(90);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var staffId = Guid.NewGuid();
            var result = await paymentService.ApprovePaymentAsync(paymentId, staffId);

            Assert.True(result.Succeeded);
            Assert.Equal(PaymentStatus.DepositPaid, result.Payment!.Status);

            var refreshedBooking = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshedBooking!.Status);
        }
    }

    // 12. DepositPaid prevents expiry
    [Fact]
    public async Task DepositPaid_PreventsExpiry()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                PaidAt = clock.UtcNow.AddMinutes(35),
                Status = PaymentStatus.DepositPaid
            });
            await db.SaveChangesAsync();
        }

        clock.UtcNow = clock.UtcNow.AddMinutes(90);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(0, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshed!.Status);
        }
    }

    // 13. FullyPaid prevents expiry
    [Fact]
    public async Task FullyPaid_PreventsExpiry()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                Amount = 500m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                PaidAt = clock.UtcNow.AddMinutes(35),
                Status = PaymentStatus.FullyPaid
            });
            await db.SaveChangesAsync();
        }

        clock.UtcNow = clock.UtcNow.AddMinutes(90);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(0, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshed!.Status);
        }
    }

    // 14. Failed payment does not prevent expiry
    [Fact]
    public async Task FailedPayment_DoesNotPreventExpiry()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                Status = PaymentStatus.Failed
            });
            await db.SaveChangesAsync();
        }

        clock.UtcNow = clock.UtcNow.AddMinutes(70);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(1, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Cancelled, refreshed!.Status);
        }
    }

    // 15. Refunded payment does not prevent expiry
    [Fact]
    public async Task RefundedPayment_DoesNotPreventExpiry()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                Status = PaymentStatus.Refunded
            });
            await db.SaveChangesAsync();
        }

        clock.UtcNow = clock.UtcNow.AddMinutes(70);

        var expiryService = new BookingPaymentExpiryService(
            fixture.ScopeFactory,
            clock,
            LoggerFactory.CreateLogger<BookingPaymentExpiryService>());

        var expiredCount = await expiryService.ProcessExpiredBookingsAsync();
        Assert.Equal(1, expiredCount);

        using (var db = fixture.CreateDbContext())
        {
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Cancelled, refreshed!.Status);
        }
    }

    // 16. First submission after deadline rejected
    // 17. Late submission race safely cancels booking
    [Fact]
    public async Task FirstSubmission_AfterDeadline_RejectedAndSafelyCancelsBooking()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid travelerId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, tId) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            travelerId = tId;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            await db.SaveChangesAsync();
        }

        // Traveler submits after deadline without background worker having run yet
        clock.UtcNow = clock.UtcNow.AddMinutes(65);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var result = await paymentService.SubmitBankTransferAsync(
                bookingId,
                250m,
                "/uploads/slips/slip.jpg",
                travelerId);

            Assert.False(result.Succeeded); // Test 16
            Assert.Equal(409, result.StatusCode);
            Assert.Contains("Advance payment deadline has expired", result.Error);

            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(refreshed);
            Assert.Equal(BookingStatus.Cancelled, refreshed.Status); // Test 17
            Assert.Equal(clock.UtcNow, refreshed.PaymentExpiredAt);
            Assert.Equal("Advance payment was not submitted within the required 1-hour period.", refreshed.CancellationReason);

            var auditLog = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.EntityType == "Booking" && a.EntityId == bookingId && a.Action == "BookingPaymentExpired");
            Assert.NotNull(auditLog);
        }
    }

    // 18. Rejected slip before deadline leaves booking Confirmed
    // 19. Traveler can resubmit before deadline after rejection
    [Fact]
    public async Task RejectedSlip_BeforeDeadline_LeavesBookingConfirmed_AndCanResubmit()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid travelerId;
        Guid paymentId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, tId) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            travelerId = tId;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var payment = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip1.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(20),
                Status = PaymentStatus.Pending
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            paymentId = payment.Id;
        }

        // Rejected at 10:30 (before 11:00 deadline)
        clock.UtcNow = clock.UtcNow.AddMinutes(30);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var staffId = Guid.NewGuid();
            var rejectResult = await paymentService.RejectPaymentAsync(paymentId, "Slip blurry", staffId);
            Assert.True(rejectResult.Succeeded);

            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshed!.Status); // Test 18
            Assert.Null(refreshed.PaymentExpiredAt);

            // Traveler resubmits before deadline at 10:45
            clock.UtcNow = clock.UtcNow.AddMinutes(15);
            var resubmitResult = await paymentService.SubmitBankTransferAsync(
                bookingId,
                250m,
                "/uploads/slips/slip2.jpg",
                travelerId);

            Assert.True(resubmitResult.Succeeded); // Test 19
            Assert.Equal(PaymentStatus.Pending, resubmitResult.Payment!.Status);
        }
    }

    // 20. Rejected initial slip after deadline cancels booking
    // 21. Rejection after deadline logs PaymentRejected
    // 22. Rejection after deadline also logs BookingPaymentExpired
    [Fact]
    public async Task RejectedInitialSlip_AfterDeadline_CancelsBooking_AndLogsBothAudits()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid paymentId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var payment = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip1.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(45),
                Status = PaymentStatus.Pending
            };
            db.Payments.Add(payment);
            await db.SaveChangesAsync();
            paymentId = payment.Id;
        }

        // Rejected after deadline at 11:20
        clock.UtcNow = clock.UtcNow.AddMinutes(80);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var staffId = Guid.NewGuid();
            var rejectResult = await paymentService.RejectPaymentAsync(paymentId, "Invalid bank account", staffId);
            Assert.True(rejectResult.Succeeded);

            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.NotNull(refreshed);
            Assert.Equal(BookingStatus.Cancelled, refreshed.Status); // Test 20
            Assert.Equal(clock.UtcNow, refreshed.PaymentExpiredAt);
            Assert.Equal("Advance payment was rejected after the payment deadline.", refreshed.CancellationReason);

            var paymentRejectAudit = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.EntityType == "Payment" && a.EntityId == paymentId && a.Action == "PaymentRejected");
            Assert.NotNull(paymentRejectAudit); // Test 21

            var bookingExpiredAudit = await db.AuditLogs
                .FirstOrDefaultAsync(a => a.EntityType == "Booking" && a.EntityId == bookingId && a.Action == "BookingPaymentExpired");
            Assert.NotNull(bookingExpiredAudit); // Test 22
            Assert.Contains("Advance payment was rejected after the payment deadline.", bookingExpiredAudit.Details);
        }
    }

    // 23. A second valid pending slip before deadline prevents cancellation
    [Fact]
    public async Task SecondValidPendingSlip_BeforeDeadline_PreventsCancellation_OnRejection()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid payment1Id;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var payment1 = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip1.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                Status = PaymentStatus.Pending
            };
            var payment2 = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/slip2.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(40),
                Status = PaymentStatus.Pending
            };
            db.Payments.AddRange(payment1, payment2);
            await db.SaveChangesAsync();
            payment1Id = payment1.Id;
        }

        // Staff rejects slip 1 after deadline at 11:20
        clock.UtcNow = clock.UtcNow.AddMinutes(80);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var staffId = Guid.NewGuid();
            var result = await paymentService.RejectPaymentAsync(payment1Id, "Slip 1 rejected", staffId);
            Assert.True(result.Succeeded);

            // Booking remains confirmed because payment2 is still qualifying
            var refreshed = await db.Bookings.FindAsync(bookingId);
            Assert.Equal(BookingStatus.Confirmed, refreshed!.Status);
            Assert.Null(refreshed.PaymentExpiredAt);
        }
    }

    // 24. Subsequent balance payment is not blocked by expired initial-deadline concept once DepositPaid
    [Fact]
    public async Task SubsequentBalancePayment_NotBlockedByExpiredInitialDeadline_OnceDepositPaid()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid travelerId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, tId) = await SeedBookingAsync(db, BookingStatus.Confirmed, totalCost: 500m);
            bookingId = booking.Id;
            travelerId = tId;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            var initialDeposit = new Payment
            {
                BookingId = booking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/deposit.jpg",
                SubmittedAt = clock.UtcNow.AddMinutes(30),
                PaidAt = clock.UtcNow.AddMinutes(35),
                Status = PaymentStatus.DepositPaid
            };
            db.Payments.Add(initialDeposit);
            await db.SaveChangesAsync();
        }

        // Days later, traveler pays the balance
        clock.UtcNow = clock.UtcNow.AddDays(2);

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var balanceResult = await paymentService.SubmitBankTransferAsync(
                bookingId,
                250m,
                "/uploads/slips/balance.jpg",
                travelerId);

            Assert.True(balanceResult.Succeeded);
            Assert.Equal(PaymentStatus.Pending, balanceResult.Payment!.Status);
        }
    }

    // 25. Payment status DTO returns PaymentDueAt
    // 26. Payment status reports deadline not expired before deadline
    // 27. Payment status reports deadline expired after deadline when obligation unsatisfied
    [Fact]
    public async Task PaymentStatus_ReturnsPaymentDueAt_AndCorrectExpiryFlag()
    {
        var fixture = new TestFixture();
        var clock = new TestClock { UtcNow = new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero) };
        Guid bookingId;
        Guid travelerId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, tId) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            bookingId = booking.Id;
            travelerId = tId;
            booking.PaymentDueAt = clock.UtcNow.AddMinutes(60);
            await db.SaveChangesAsync();
        }

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            // Before deadline:
            var statusBefore = await paymentService.GetPaymentStatusAsync(bookingId, travelerId, isManagerOrAdmin: false);
            Assert.True(statusBefore.Succeeded);
            Assert.NotNull(statusBefore.PaymentDueAt); // Test 25
            Assert.False(statusBefore.IsPaymentDeadlineExpired); // Test 26

            // After deadline without payment:
            clock.UtcNow = clock.UtcNow.AddMinutes(70);
            var statusAfter = await paymentService.GetPaymentStatusAsync(bookingId, travelerId, isManagerOrAdmin: false);
            Assert.True(statusAfter.Succeeded);
            Assert.True(statusAfter.IsPaymentDeadlineExpired); // Test 27
        }
    }

    // 28. Cancelled booking cannot submit payment
    [Fact]
    public async Task CancelledBooking_CannotSubmitPayment()
    {
        var fixture = new TestFixture();
        var clock = new TestClock();
        Guid bookingId;
        Guid travelerId;

        using (var db = fixture.CreateDbContext())
        {
            var (booking, _, tId) = await SeedBookingAsync(db, BookingStatus.Cancelled);
            bookingId = booking.Id;
            travelerId = tId;
        }

        using (var db = fixture.CreateDbContext())
        {
            var paymentService = new PaymentService(
                db,
                fixture.CreateAuditLogService(db),
                LoggerFactory.CreateLogger<PaymentService>(),
                clock);

            var result = await paymentService.SubmitBankTransferAsync(
                bookingId,
                250m,
                "/uploads/slips/slip.jpg",
                travelerId);

            Assert.False(result.Succeeded);
            Assert.Equal(400, result.StatusCode);
            Assert.Equal("Payment can only be recorded for confirmed bookings.", result.Error);
        }
    }

    // 29. Occupancy excludes auto-cancelled booking
    [Fact]
    public async Task Occupancy_ExcludesAutoCancelledBooking()
    {
        var fixture = new TestFixture();
        Guid packageId;

        using (var db = fixture.CreateDbContext())
        {
            var (confirmedBooking, package, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);
            confirmedBooking.GroupSize = 4;
            packageId = package.Id;

            var (cancelledBooking, _, _) = await SeedBookingAsync(db, BookingStatus.Cancelled);
            cancelledBooking.TourPackageId = package.Id;
            cancelledBooking.TourPackage = package;
            cancelledBooking.GroupSize = 6;
            cancelledBooking.PaymentExpiredAt = DateTimeOffset.UtcNow;
            cancelledBooking.CancellationReason = "Advance payment was not submitted within the required 1-hour period.";

            await db.SaveChangesAsync();
        }

        using (var db = fixture.CreateDbContext())
        {
            var reportService = new OperationsReportService(
                db,
                LoggerFactory.CreateLogger<OperationsReportService>());

            var from = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
            var to = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(15));
            var occupancy = await reportService.GetOccupancyReportAsync(from, to);

            var pkgReport = occupancy.FirstOrDefault(p => p.TourPackageId == packageId);
            Assert.NotNull(pkgReport);
            Assert.Equal(1, pkgReport.BookingCount); // only confirmed booking, cancelled excluded
            Assert.Equal(4, pkgReport.BookedTravelers); // 4, not 4 + 6
        }
    }

    // 30. Revenue unaffected by expired unpaid booking
    [Fact]
    public async Task Revenue_UnaffectedByExpiredUnpaidBooking()
    {
        var fixture = new TestFixture();

        using (var db = fixture.CreateDbContext())
        {
            var (confirmedBooking, _, _) = await SeedBookingAsync(db, BookingStatus.Confirmed);

            // Confirmed booking with approved deposit
            db.Payments.Add(new Payment
            {
                BookingId = confirmedBooking.Id,
                Amount = 250m,
                Method = "BankTransfer",
                BankSlipUrl = "/uploads/slips/deposit.jpg",
                PaidAt = DateTimeOffset.UtcNow,
                Status = PaymentStatus.DepositPaid
            });

            // Expired cancelled booking with no approved payment
            var (cancelledBooking, _, _) = await SeedBookingAsync(db, BookingStatus.Cancelled);
            cancelledBooking.PaymentExpiredAt = DateTimeOffset.UtcNow;
            cancelledBooking.CancellationReason = "Advance payment was not submitted within the required 1-hour period.";

            await db.SaveChangesAsync();
        }

        using (var db = fixture.CreateDbContext())
        {
            var reportService = new OperationsReportService(
                db,
                LoggerFactory.CreateLogger<OperationsReportService>());

            var revenue = await reportService.GetRevenueReportAsync(null, null);
            Assert.Equal(250m, revenue.TotalRevenue); // Only 250m, unaffected by cancelled booking
        }
    }
}
