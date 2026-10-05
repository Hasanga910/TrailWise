using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Approvals;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Bookings;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class ApprovalsEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ApprovalsEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Seeded(Guid ApprovalId, Guid BookingId, Guid RunId, Guid GuideId, Guid VehicleId, string Theme);

    // ---------------------------------------------------------------- queue

    [Fact]
    public async Task GetPending_ReturnsCountsPerTypeAndEvidenceFromTheWorkflowRun()
    {
        var before = await GetPendingAsync(await StaffClientAsync("OperationsManager"));
        var large = await SeedAsync(ApprovalType.LargeGroupOrCustomItinerary, groupSize: 12);
        var budget = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var refund = await SeedAsync(ApprovalType.RefundException, groupSize: 2);

        var after = await GetPendingAsync(await StaffClientAsync("OperationsManager"));

        Assert.Equal(before.Counts.LargeGroupOrCustomItinerary + 1, after.Counts.LargeGroupOrCustomItinerary);
        Assert.Equal(before.Counts.BudgetOverride + 1, after.Counts.BudgetOverride);
        Assert.Equal(before.Counts.RefundException + 1, after.Counts.RefundException);
        Assert.Equal(before.Counts.Total + 3, after.Counts.Total);

        var item = Assert.Single(after.Items, i => i.Id == large.ApprovalId);
        Assert.Equal(ApprovalType.LargeGroupOrCustomItinerary, item.Type);
        Assert.Equal(ApprovalStatus.Pending, item.Status);
        Assert.Equal(large.BookingId, item.BookingId);
        Assert.Equal(large.RunId, item.WorkflowRunId);
        Assert.Contains("Group size 12", Assert.Single(item.Reasons));

        Assert.Equal(12, item.Booking.GroupSize);
        Assert.Equal("Seed Traveler", item.Booking.TravelerName);

        Assert.NotNull(item.Evidence.Guide);
        Assert.Equal(large.GuideId, item.Evidence.Guide!.GuideId);
        Assert.Equal("Evidence Guide", item.Evidence.Guide.Name);
        Assert.Equal(0.9, item.Evidence.Guide.MatchScore);
        Assert.Equal("Matched on theme and availability.", item.Evidence.Guide.Reasoning);

        Assert.NotNull(item.Evidence.Vehicle);
        Assert.Equal(large.VehicleId, item.Evidence.Vehicle!.VehicleId);
        Assert.True(item.Evidence.Vehicle.HasAc);
        Assert.True(item.Evidence.Vehicle.AcMatch);
        Assert.Equal("Evidence Driver", item.Evidence.Vehicle.DriverName);
        Assert.False(item.Evidence.Vehicle.ConflictCheck);

        Assert.NotNull(item.Evidence.Pricing);
        Assert.Equal(1200m, item.Evidence.Pricing!.TotalCost);
        Assert.Equal("Base 1000 + catering 200", item.Evidence.Pricing.Breakdown);
        Assert.Equal(12 * 100m, item.Evidence.Pricing.TotalBudget); // BudgetPerPerson 100 x group
        Assert.Equal(12 * 100m * 1.15m, item.Evidence.Pricing.BudgetCeiling);

        Assert.Equal("NeedsApproval", item.Evidence.Validation!.Decision);
        Assert.Equal("Large group.", Assert.Single(item.Evidence.Validation.Reasons));
        Assert.Equal("Proposal summary text.", item.Evidence.SummaryText);
        Assert.Equal(new[] { "Large group" }, item.Evidence.AdvisoryFlags);

        Assert.Contains(after.Items, i => i.Id == budget.ApprovalId && i.Type == ApprovalType.BudgetOverride);
        Assert.Contains(after.Items, i => i.Id == refund.ApprovalId && i.Type == ApprovalType.RefundException);
    }

    [Fact]
    public async Task GetPending_FiltersByType_AndKeepsCountsForAllTypes()
    {
        var client = await StaffClientAsync("OperationsManager");
        var budget = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        await SeedAsync(ApprovalType.LargeGroupOrCustomItinerary, groupSize: 12);

        var result = await client.GetFromJsonAsync<PendingApprovalsDto>("/api/approvals/pending?type=BudgetOverride", JsonOptions);

        Assert.NotNull(result);
        Assert.All(result!.Items, i => Assert.Equal(ApprovalType.BudgetOverride, i.Type));
        Assert.Contains(result.Items, i => i.Id == budget.ApprovalId);
        Assert.True(result.Counts.LargeGroupOrCustomItinerary >= 1, "counts cover every type, not just the filtered one");
    }

    [Fact]
    public async Task GetPending_ExcludesDecidedRequests()
    {
        var client = await StaffClientAsync("OperationsManager");
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var decide = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Reject", Note = "No." });
        Assert.Equal(HttpStatusCode.OK, decide.StatusCode);

        var result = await GetPendingAsync(client);

        Assert.DoesNotContain(result.Items, i => i.Id == seeded.ApprovalId);
    }

    // ---------------------------------------------------------------- role guards

    [Theory]
    [InlineData("OperationsManager", HttpStatusCode.OK)]
    [InlineData("Admin", HttpStatusCode.OK)]
    [InlineData("FleetCoordinator", HttpStatusCode.Forbidden)]
    [InlineData("TourGuide", HttpStatusCode.Forbidden)]
    [InlineData("Traveler", HttpStatusCode.Forbidden)]
    public async Task GetPending_IsRestrictedToOperationsManagerAndAdmin(string role, HttpStatusCode expected)
    {
        var client = await StaffClientAsync(role);

        var response = await client.GetAsync("/api/approvals/pending");

        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData("FleetCoordinator")]
    [InlineData("TourGuide")]
    [InlineData("Traveler")]
    public async Task Decide_IsForbiddenForOtherRoles_AndChangesNothing(string role)
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var client = await StaffClientAsync(role);

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertUntouchedAsync(seeded);
    }

    [Fact]
    public async Task Endpoints_RequireAuthentication()
    {
        var anonymous = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/approvals/pending")).StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync($"/api/approvals/{Guid.NewGuid()}/decide", new { Decision = "Approve" })).StatusCode);
    }

    [Fact]
    public async Task Decide_AsAdmin_Works()
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var admin = await StaffClientAsync("Admin");

        var response = await admin.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ---------------------------------------------------------------- decisions

    [Theory]
    [InlineData(ApprovalType.LargeGroupOrCustomItinerary, "Approve", BookingStatus.Confirmed, ApprovalStatus.Approved, "BookingApproved")]
    [InlineData(ApprovalType.LargeGroupOrCustomItinerary, "Reject", BookingStatus.Cancelled, ApprovalStatus.Rejected, "BookingRejected")]
    [InlineData(ApprovalType.LargeGroupOrCustomItinerary, "RequestRevision", BookingStatus.PlanProposed, ApprovalStatus.RevisionRequested, "BookingRevisionRequested")]
    [InlineData(ApprovalType.BudgetOverride, "Approve", BookingStatus.Confirmed, ApprovalStatus.Approved, "BookingApproved")]
    [InlineData(ApprovalType.BudgetOverride, "Reject", BookingStatus.Cancelled, ApprovalStatus.Rejected, "BookingRejected")]
    [InlineData(ApprovalType.BudgetOverride, "RequestRevision", BookingStatus.PlanProposed, ApprovalStatus.RevisionRequested, "BookingRevisionRequested")]
    public async Task Decide_AppliesTheDecision_ToBookingApprovalRunAndAudit(
        ApprovalType type, string decision, BookingStatus expectedBooking, ApprovalStatus expectedApproval, string expectedAudit)
    {
        var seeded = await SeedAsync(type, groupSize: type == ApprovalType.LargeGroupOrCustomItinerary ? 12 : 2);
        var client = await StaffClientAsync("OperationsManager");
        var note = decision == "Approve" ? null : "Please reduce the group or confirm the budget.";

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = decision, Note = note });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApprovalDecidedDto>(JsonOptions);
        Assert.Equal(expectedApproval, body!.Status);
        Assert.Equal(expectedBooking, body.Booking.Status);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
        Assert.Equal(expectedBooking, booking.Status);
        Assert.Equal(decision == "RequestRevision" ? note : null, booking.RevisionNote);
        Assert.Equal(decision == "Reject" ? note : null, booking.CancellationReason);
        Assert.Equal(decision == "RequestRevision" ? note : null, body.Booking.RevisionNote);

        var approval = await db.ApprovalRequests.SingleAsync(a => a.Id == seeded.ApprovalId);
        Assert.Equal(expectedApproval, approval.Status);
        Assert.NotNull(approval.DecidedBy);
        Assert.NotNull(approval.DecidedAt);
        Assert.Equal(note, approval.DecisionNote);

        var run = await db.AgentWorkflowRuns.Include(r => r.StepLogs).SingleAsync(r => r.Id == seeded.RunId);
        Assert.Equal("Completed", run.Status);
        Assert.NotNull(run.CompletedAt);
        var decisionLog = Assert.Single(run.StepLogs, s => s.AgentName == "manager_decision");
        Assert.Contains(decision, decisionLog.InputJson);

        var audit = await db.AuditLogs.SingleAsync(a => a.EntityId == seeded.BookingId && a.Action == expectedAudit);
        Assert.NotNull(audit.PerformedBy);
        Assert.Contains(type.ToString(), audit.Details);

        var guideRows = await db.GuideAvailabilities.CountAsync(a => a.AssignedBookingId == seeded.BookingId);
        Assert.Equal(expectedBooking == BookingStatus.Confirmed, guideRows > 0);
    }

    [Fact]
    public async Task Decide_Approve_ConfirmsWithTheGuideProposedByTheWorkflow()
    {
        var seeded = await SeedAsync(ApprovalType.LargeGroupOrCustomItinerary, groupSize: 12);
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var guideIds = await db.GuideAvailabilities
            .Where(a => a.AssignedBookingId == seeded.BookingId).Select(a => a.GuideId).Distinct().ToListAsync();
        Assert.Equal(new[] { seeded.GuideId }, guideIds);
        Assert.True(await db.VehicleAssignments.AnyAsync(a => a.BookingId == seeded.BookingId));
    }

    [Theory]
    [InlineData("Reject", null)]
    [InlineData("Reject", "")]
    [InlineData("Reject", "   ")]
    [InlineData("RequestRevision", null)]
    [InlineData("RequestRevision", "   ")]
    public async Task Decide_RejectOrRevisionWithoutANote_Returns400_AndChangesNothing(string decision, string? note)
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = decision, Note = note });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertUntouchedAsync(seeded);
    }

    [Fact]
    public async Task Decide_WithAnUnknownDecisionOrOverlongNote_Returns400()
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var client = await StaffClientAsync("OperationsManager");

        var unknown = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Maybe" });
        var tooLong = await client.PostAsJsonAsync(
            $"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Reject", Note = new string('x', 501) });

        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        await AssertUntouchedAsync(seeded);
    }

    [Fact]
    public async Task Decide_AnAlreadyDecidedApproval_Returns409()
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var client = await StaffClientAsync("OperationsManager");
        var first = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Reject", Note = "No." });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        Assert.Equal(BookingStatus.Cancelled, (await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId)).Status);
        Assert.Equal(ApprovalStatus.Rejected, (await db.ApprovalRequests.SingleAsync(a => a.Id == seeded.ApprovalId)).Status);
    }

    [Fact]
    public async Task Decide_UnknownApproval_Returns404()
    {
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/approvals/{Guid.NewGuid()}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task LegacyBookingDecide_AlsoSettlesTheOpenApprovalRequest()
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2);
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/bookings/{seeded.BookingId}/decide", new { Decision = "Approve", Notes = "ok" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var approval = await db.ApprovalRequests.SingleAsync(a => a.Id == seeded.ApprovalId);
        Assert.Equal(ApprovalStatus.Approved, approval.Status);
        Assert.Equal("ok", approval.DecisionNote);
    }

    // ---------------------------------------------------------------- transaction rollback

    [Fact]
    public async Task Decide_Approve_WhenNoVehicleCanBeReserved_RollsBackEverything()
    {
        // The proposed vehicle is no longer available and a 500-seat group cannot be re-matched to
        // any other vehicle, so the reservation fails after the guide assignment already happened:
        // nothing may be left behind.
        var seeded = await SeedAsync(
            ApprovalType.LargeGroupOrCustomItinerary, groupSize: 500, withFleet: false, vehicleOutOfService: true);
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Missing: Vehicle & Driver", await response.Content.ReadAsStringAsync());
        await AssertUntouchedAsync(seeded);
    }

    [Fact]
    public async Task Decide_Approve_WhenNoGuideQualifies_RollsBackEverything()
    {
        var seeded = await SeedAsync(ApprovalType.BudgetOverride, groupSize: 2, withMatchingGuide: false);
        var client = await StaffClientAsync("OperationsManager");

        var response = await client.PostAsJsonAsync($"/api/approvals/{seeded.ApprovalId}/decide", new { Decision = "Approve" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Missing: Tour Guide", await response.Content.ReadAsStringAsync());
        await AssertUntouchedAsync(seeded);
    }

    // ---------------------------------------------------------------- helpers

    /// <summary>Booking still pending, approval still open, run still waiting, nothing held or logged.</summary>
    private async Task AssertUntouchedAsync(Seeded seeded)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var booking = await db.Bookings.SingleAsync(b => b.Id == seeded.BookingId);
        Assert.Equal(BookingStatus.PendingApproval, booking.Status);
        Assert.Null(booking.RevisionNote);
        Assert.Null(booking.CancellationReason);

        var approval = await db.ApprovalRequests.SingleAsync(a => a.Id == seeded.ApprovalId);
        Assert.Equal(ApprovalStatus.Pending, approval.Status);
        Assert.Null(approval.DecidedBy);

        var run = await db.AgentWorkflowRuns.Include(r => r.StepLogs).SingleAsync(r => r.Id == seeded.RunId);
        Assert.Equal("AwaitingApproval", run.Status);
        Assert.Null(run.CompletedAt);
        Assert.DoesNotContain(run.StepLogs, s => s.AgentName == "manager_decision");

        Assert.False(await db.GuideAvailabilities.AnyAsync(a => a.AssignedBookingId == seeded.BookingId));
        Assert.Equal(
            seeded.VehicleId != Guid.Empty ? 1 : 0,
            await db.VehicleAssignments.CountAsync(a => a.BookingId == seeded.BookingId));
        Assert.False(await db.AuditLogs.AnyAsync(a => a.EntityId == seeded.BookingId));
    }

    private static async Task<PendingApprovalsDto> GetPendingAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<PendingApprovalsDto>("/api/approvals/pending", JsonOptions))!;

    private async Task<Seeded> SeedAsync(
        ApprovalType type, int groupSize, bool withFleet = true, bool withMatchingGuide = true, bool vehicleOutOfService = false)
    {
        var theme = $"Theme-{Guid.NewGuid():N}";
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var traveler = new User
        {
            Name = "Seed Traveler",
            Email = $"seed-{Guid.NewGuid():N}@example.com",
            ContactNumber = "+14155550100",
            PasswordHash = "irrelevant",
            Role = UserRole.Traveler
        };
        var package = new TourPackage
        {
            Name = $"Approval Package {theme}",
            Theme = theme,
            DurationDays = 3,
            BasePricePerPerson = 100m,
            MaxGroupSize = 600
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = true,
            BasePricePerPerson = 100m,
            RequiresAC = false
        };
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var booking = new Booking
        {
            Traveler = traveler,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = groupSize,
            StartDate = start,
            EndDate = start.AddDays(3),
            BudgetPerPerson = 100m,
            Status = BookingStatus.PendingApproval
        };

        var guide = new Guide
        {
            Name = "Evidence Guide",
            Specializations = new[] { withMatchingGuide ? theme : "SomethingElse" },
            Languages = new[] { "English" },
            ContactInfo = "guide@example.com"
        };
        var vehicle = new Vehicle
        {
            Type = VehicleType.Van,
            RegistrationNumber = $"REG-{Guid.NewGuid():N}"[..10],
            Capacity = 20,
            HasAC = true,
            SeatConfiguration = "2-2",
            MaintenanceStatus = vehicleOutOfService ? VehicleMaintenanceStatus.OutOfService : VehicleMaintenanceStatus.Available
        };
        var driver = new Driver { Name = "Evidence Driver", LicenseNumber = $"DL-{Guid.NewGuid():N}"[..10], ContactInfo = "+94770000009" };
        db.AddRange(traveler, package, tier, booking, guide, vehicle, driver);

        if (withFleet)
        {
            db.VehicleAssignments.Add(new VehicleAssignment
            {
                Vehicle = vehicle,
                Driver = driver,
                Booking = booking,
                StartDate = booking.StartDate,
                EndDate = booking.EndDate
            });
        }

        var run = new AgentWorkflowRun
        {
            Booking = booking,
            Objective = "Evidence run",
            Status = "AwaitingApproval",
            SummaryText = "Proposal summary text.",
            StartedAt = DateTimeOffset.UtcNow
        };
        db.AgentWorkflowRuns.Add(run);

        var clock = DateTimeOffset.UtcNow;
        AgentStepLog Log(string agent, object output, string? validation = null) => new()
        {
            WorkflowRun = run,
            AgentName = agent,
            InputJson = "{}",
            OutputJson = JsonSerializer.Serialize(output, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
            ValidationResult = validation,
            DurationMs = 5,
            CreatedAt = clock = clock.AddMilliseconds(10)
        };
        db.AgentStepLogs.AddRange(
            Log("GuideMatchingAgent", new { guideId = guide.Id, matchScore = 0.9, reasoning = "Matched on theme and availability." }),
            Log("FleetCapacityAgent", new { vehicleId = vehicle.Id, driverId = driver.Id, acMatch = true, seatConfigMatch = true, conflictCheck = false }),
            Log("PricingValidationAgent", new { totalCost = 1200m, breakdown = "Base 1000 + catering 200", validationResult = "Valid" }),
            Log("PricingValidationAgent", new { decision = "NeedsApproval", reasons = new[] { "Large group." } }, "NeedsApproval"),
            Log("ProposalSummaryAgent", new { summaryText = "Proposal summary text.", advisoryFlags = new[] { "Large group" } }));

        var approval = new ApprovalRequest
        {
            Booking = booking,
            Type = type,
            Status = ApprovalStatus.Pending,
            PreviousBookingStatus = BookingStatus.Requested,
            ReasonsJson = JsonSerializer.Serialize(new[] { $"Group size {groupSize} exceeds the large-group threshold of 10." })
        };
        db.ApprovalRequests.Add(approval);

        await db.SaveChangesAsync();
        return new Seeded(approval.Id, booking.Id, run.Id, guide.Id, withFleet ? vehicle.Id : Guid.Empty, theme);
    }

    private async Task<HttpClient> StaffClientAsync(string role)
    {
        var client = _factory.CreateClient();
        string email;
        string password;

        if (role == "Admin")
        {
            email = "admin@test.local";
            password = "TestAdminPass123!";
        }
        else
        {
            email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@example.com";
            password = "P@ssword123";
            if (role == "Traveler")
            {
                await client.PostAsJsonAsync(
                    "/api/auth/register",
                    new { Name = "Traveler", Email = email, Password = password, ContactNumber = "+14155550100" });
            }
            else
            {
                var admin = await StaffClientAsync("Admin");
                var create = await admin.PostAsJsonAsync("/api/auth/admin/users", new
                {
                    Name = $"Staff {role}",
                    Email = email,
                    Password = password,
                    ContactNumber = "+14155550101",
                    Role = role
                });
                create.EnsureSuccessStatusCode();
            }
        }

        var login = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = password });
        login.EnsureSuccessStatusCode();
        var auth = await login.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }
}
