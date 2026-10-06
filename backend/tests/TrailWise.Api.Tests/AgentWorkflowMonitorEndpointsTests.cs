using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Api.Contracts.Common;
using TrailWise.Infrastructure.Agents;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;
using static TrailWise.Api.Tests.ApiTestHelpers;

namespace TrailWise.Api.Tests;

public class AgentWorkflowMonitorEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private readonly TrailWiseWebApplicationFactory _factory;

    public AgentWorkflowMonitorEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private sealed record Step(
        string Agent,
        string? Input = "{}",
        string? Output = "{}",
        string? Tools = null,
        string? Validation = null,
        long DurationMs = 5);

    private sealed record SeededRun(Guid RunId, Guid BookingId, string TravelerName, string PackageName);

    // ---------------------------------------------------------------- list

    [Fact]
    public async Task List_ReturnsRunsNewestFirst_WithProgressStepCountAndTotalDuration()
    {
        var older = await SeedRunAsync(
            "Completed", startedAgo: TimeSpan.FromHours(3),
            plan: """{"steps":[{"step":"a","agent":"A","status":"done"},{"step":"b","agent":"B","status":"done"}]}""",
            steps: new[] { new Step("A", DurationMs: 10), new Step("B", DurationMs: 32) });
        var newer = await SeedRunAsync(
            "Running", startedAgo: TimeSpan.FromMinutes(1),
            plan: """{"steps":[{"step":"a","agent":"A","status":"done"},{"step":"b","agent":"B","status":"pending"},{"step":"c","agent":"C","status":"pending"}]}""",
            steps: new[] { new Step("A", DurationMs: 7) });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var result = await client.GetFromJsonAsync<PagedResult<AgentWorkflowRunListItemDto>>("/api/agent-workflows?pageSize=100", JsonOptions);

        var ids = result!.Items.Select(i => i.Id).ToList();
        Assert.True(ids.IndexOf(newer.RunId) < ids.IndexOf(older.RunId), "newest first");

        var done = Assert.Single(result.Items, i => i.Id == older.RunId);
        Assert.Equal((2, 2, 2, 42L), (done.StepsDone, done.StepsTotal, done.StepCount, done.TotalDurationMs));
        Assert.Equal(older.PackageName, done.TourPackageName);
        Assert.Equal(older.TravelerName, done.TravelerName);
        Assert.NotNull(done.CompletedAt);

        var running = Assert.Single(result.Items, i => i.Id == newer.RunId);
        Assert.Equal((1, 3, 1, 7L), (running.StepsDone, running.StepsTotal, running.StepCount, running.TotalDurationMs));
        Assert.Equal("Running", running.Status);
    }

    [Fact]
    public async Task List_FiltersByStatus_CaseInsensitively_AndByBooking()
    {
        var awaiting = await SeedRunAsync("AwaitingApproval");
        var failed = await SeedRunAsync("Failed");
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var byStatus = await client.GetFromJsonAsync<PagedResult<AgentWorkflowRunListItemDto>>("/api/agent-workflows?status=awaitingapproval&pageSize=100", JsonOptions);
        var byBooking = await client.GetFromJsonAsync<PagedResult<AgentWorkflowRunListItemDto>>($"/api/agent-workflows?bookingId={failed.BookingId}", JsonOptions);

        Assert.All(byStatus!.Items, i => Assert.Equal("AwaitingApproval", i.Status));
        Assert.Contains(byStatus.Items, i => i.Id == awaiting.RunId);
        Assert.DoesNotContain(byStatus.Items, i => i.Id == failed.RunId);
        Assert.Equal(failed.RunId, Assert.Single(byBooking!.Items).Id);
        Assert.Equal(1, byBooking.TotalCount);
    }

    [Fact]
    public async Task List_Paginates()
    {
        for (var i = 0; i < 3; i++)
        {
            await SeedRunAsync("Completed");
        }

        var client = await ClientForRoleAsync(_factory, "OperationsManager");
        var first = await client.GetFromJsonAsync<PagedResult<AgentWorkflowRunListItemDto>>("/api/agent-workflows?pageSize=2&page=1", JsonOptions);
        var second = await client.GetFromJsonAsync<PagedResult<AgentWorkflowRunListItemDto>>("/api/agent-workflows?pageSize=2&page=2", JsonOptions);

        Assert.Equal(2, first!.Items.Count);
        Assert.True(first.TotalCount >= 3);
        Assert.Empty(first.Items.Select(i => i.Id).Intersect(second!.Items.Select(i => i.Id)));
    }

    [Theory]
    [InlineData("status=bogus")]
    [InlineData("page=0")]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    public async Task List_RejectsInvalidQueries(string query)
    {
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var response = await client.GetAsync($"/api/agent-workflows?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- run detail

    [Fact]
    public async Task RunDetail_ReturnsPlanAndEveryStepWithInputsOutputsToolCallsValidationAndTiming()
    {
        var seeded = await SeedRunAsync(
            "AwaitingApproval",
            plan: """{"steps":[{"step":"match_guide","agent":"GuideMatchingAgent","status":"done"},{"step":"validate","agent":"PricingValidationAgent","status":"pending"}]}""",
            summary: "Looks fine.",
            steps: new[]
            {
                new Step("GuideMatchingAgent", Input: """{"bookingId":"b"}""", Output: """{"guideId":"g","matchScore":0.9}""",
                    Tools: """[{"tool":"guide_availability_read","ms":3}]""", DurationMs: 12),
                new Step("PricingValidationAgent", Output: """{"decision":"NeedsApproval","reasons":["Large group."]}""",
                    Validation: "NeedsApproval", DurationMs: 4),
                new Step("ProposalSummaryAgent", Output: """{"summaryText":"Looks fine.","advisoryFlags":["Large group"]}""")
            });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var detail = await client.GetFromJsonAsync<AgentWorkflowRunDetailDto>($"/api/agent-workflows/runs/{seeded.RunId}", JsonOptions);

        Assert.Equal(seeded.BookingId, detail!.BookingId);
        Assert.Equal("AwaitingApproval", detail.Status);
        Assert.Equal((1, 2), (detail.StepsDone, detail.StepsTotal));
        Assert.Equal("match_guide", detail.Plan!.Value.GetProperty("steps")[0].GetProperty("step").GetString());
        Assert.Equal("Looks fine.", detail.SummaryText);
        Assert.Equal(new[] { "Large group" }, detail.AdvisoryFlags);
        Assert.True(detail.IsLatestForBooking);

        Assert.Equal(3, detail.Steps.Count);
        var guide = detail.Steps[0];
        Assert.Equal("GuideMatchingAgent", guide.AgentName);
        Assert.Equal(0.9, guide.Output!.Value.GetProperty("matchScore").GetDouble());
        Assert.Equal("guide_availability_read", guide.ToolCalls!.Value[0].GetProperty("tool").GetString());
        Assert.Equal(12, guide.DurationMs);
        Assert.Equal("NeedsApproval", detail.Steps[1].ValidationResult);
        Assert.Null(detail.Steps[1].ToolCalls);
    }

    [Fact]
    public async Task RunDetail_RedactsAnythingThatLooksLikeASecret_AndToleratesBadJson()
    {
        var seeded = await SeedRunAsync(
            "Completed",
            steps: new[]
            {
                new Step(
                    "PreferenceExtractionAgent",
                    Input: """{"specialRequests":"vegan","apiKey":"sk-123","nested":{"Password":"hunter2","note":"ok"},"items":[{"authToken":"t"}]}""",
                    Output: "not json at all",
                    Tools: "")
            });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var response = await client.GetAsync($"/api/agent-workflows/runs/{seeded.RunId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("sk-123", body);
        Assert.DoesNotContain("hunter2", body);
        var step = JsonDocument.Parse(body).RootElement.GetProperty("steps")[0];
        Assert.Equal("vegan", step.GetProperty("input").GetProperty("specialRequests").GetString());
        Assert.Equal(JsonRedactor.Placeholder, step.GetProperty("input").GetProperty("apiKey").GetString());
        Assert.Equal(JsonRedactor.Placeholder, step.GetProperty("input").GetProperty("nested").GetProperty("Password").GetString());
        Assert.Equal("ok", step.GetProperty("input").GetProperty("nested").GetProperty("note").GetString());
        Assert.Equal(JsonRedactor.Placeholder, step.GetProperty("input").GetProperty("items")[0].GetProperty("authToken").GetString());
        Assert.Equal(JsonValueKind.Null, step.GetProperty("output").ValueKind);
        Assert.Equal(JsonValueKind.Null, step.GetProperty("toolCalls").ValueKind);
    }

    [Fact]
    public async Task RunDetail_FlagsAnOlderRunAsNotLatest_AndShowsThePendingApproval()
    {
        var first = await SeedRunAsync("Completed", startedAgo: TimeSpan.FromHours(2));
        var second = await SeedRunAsync("AwaitingApproval", bookingId: first.BookingId, startedAgo: TimeSpan.FromMinutes(5));
        Guid approvalId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            var approval = new ApprovalRequest { BookingId = first.BookingId, Type = ApprovalType.BudgetOverride, Status = ApprovalStatus.Pending };
            db.ApprovalRequests.Add(approval);
            await db.SaveChangesAsync();
            approvalId = approval.Id;
        }

        var client = await ClientForRoleAsync(_factory, "OperationsManager");
        var older = await client.GetFromJsonAsync<AgentWorkflowRunDetailDto>($"/api/agent-workflows/runs/{first.RunId}", JsonOptions);
        var newer = await client.GetFromJsonAsync<AgentWorkflowRunDetailDto>($"/api/agent-workflows/runs/{second.RunId}", JsonOptions);

        Assert.False(older!.IsLatestForBooking);
        Assert.True(newer!.IsLatestForBooking);
        Assert.Equal(approvalId, newer.PendingApproval!.Id);
        Assert.Equal(ApprovalType.BudgetOverride, newer.PendingApproval.Type);
    }

    [Fact]
    public async Task RunDetail_UnknownRun_Returns404()
    {
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/agent-workflows/runs/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task TheExistingByBookingEndpoint_StillWorks()
    {
        var seeded = await SeedRunAsync("Completed", steps: new[] { new Step("GuideMatchingAgent") });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var response = await client.GetAsync($"/api/agent-workflows/{seeded.BookingId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<AgentWorkflowDto>(JsonOptions);
        Assert.Equal(seeded.BookingId, dto!.BookingId);
        Assert.Single(dto.Steps);
    }

    // ---------------------------------------------------------------- summary

    [Fact]
    public async Task Summary_ReportsStepsToolCallsTimingsValidationAndTheManagersDecision()
    {
        var seeded = await SeedRunAsync(
            "Completed",
            summary: "Approved after review.",
            steps: new[]
            {
                new Step("GuideMatchingAgent", Tools: """[{"tool":"guide_availability_read"},{"tool":"guide_availability_read"}]""", DurationMs: 10),
                new Step("PricingValidationAgent", Validation: "NeedsApproval", DurationMs: 5),
                new Step("ProposalSummaryAgent", Output: """{"summaryText":"x","advisoryFlags":["Large group"]}""", DurationMs: 3),
                new Step("manager_decision", Input: """{"decision":"Approve","notes":"Fine by me"}""", Output: """{"newStatus":"Confirmed"}""", DurationMs: 0)
            });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var summary = await client.GetFromJsonAsync<AgentWorkflowSummaryDto>($"/api/agent-workflows/{seeded.RunId}/summary", JsonOptions);

        Assert.Equal(seeded.RunId, summary!.RunId);
        Assert.Equal(seeded.BookingId, summary.BookingId);
        Assert.Equal("Completed", summary.Status);
        Assert.Equal(4, summary.StepCount);
        Assert.Equal(18, summary.TotalDurationMs);
        Assert.Equal(2, summary.ToolCallCount);
        Assert.Equal("NeedsApproval", summary.ValidationResult);
        Assert.Equal("Approved after review.", summary.SummaryText);
        Assert.Equal(new[] { "Large group" }, summary.AdvisoryFlags);
        Assert.Equal("Approve", summary.Decision!.Decision);
        Assert.Equal("Fine by me", summary.Decision.Notes);
        Assert.Equal("Confirmed", summary.Decision.NewStatus);
        Assert.Equal(2, summary.Steps[0].ToolCallCount);
        Assert.Equal("PricingValidationAgent", summary.Steps[1].AgentName);
    }

    [Fact]
    public async Task Summary_WithoutADecision_HasNoDecision_AndUnknownRunIs404()
    {
        var seeded = await SeedRunAsync("AwaitingApproval", steps: new[] { new Step("GuideMatchingAgent") });
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var summary = await client.GetFromJsonAsync<AgentWorkflowSummaryDto>($"/api/agent-workflows/{seeded.RunId}/summary", JsonOptions);

        Assert.Null(summary!.Decision);
        Assert.Null(summary.ValidationResult);
        Assert.Equal(0, summary.ToolCallCount);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/agent-workflows/{Guid.NewGuid()}/summary")).StatusCode);
    }

    // ---------------------------------------------------------------- start (re-run)

    [Theory]
    [InlineData(BookingStatus.Requested)]
    [InlineData(BookingStatus.NeedsManualReview)]
    public async Task Start_ReRunsTheWorkflow_ForRequestedOrNeedsManualReview_AndReturnsTheNewRun(BookingStatus status)
    {
        var seeded = await SeedRunAsync("Failed", bookingStatus: status, startedAgo: TimeSpan.FromHours(1));
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var response = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = seeded.BookingId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await response.Content.ReadFromJsonAsync<AgentWorkflowRunDetailDto>(JsonOptions);
        Assert.NotEqual(seeded.RunId, detail!.Id);
        Assert.Equal(seeded.BookingId, detail.BookingId);
        Assert.True(detail.IsLatestForBooking);
        Assert.NotEmpty(detail.Steps);
        Assert.Equal(2, await CountRunsAsync(seeded.BookingId));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var audit = await db.AuditLogs.SingleAsync(a => a.EntityId == seeded.BookingId && a.Action == "AgentWorkflowStarted");
        Assert.NotNull(audit.PerformedBy);
    }

    [Theory]
    [InlineData(BookingStatus.PlanProposed)]
    [InlineData(BookingStatus.PendingApproval)]
    [InlineData(BookingStatus.Confirmed)]
    [InlineData(BookingStatus.Completed)]
    [InlineData(BookingStatus.Cancelled)]
    public async Task Start_Returns409_ForAnyOtherStatus_AndStartsNothing(BookingStatus status)
    {
        var seeded = await SeedRunAsync("Completed", bookingStatus: status);
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var response = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = seeded.BookingId });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(1, await CountRunsAsync(seeded.BookingId));
    }

    [Fact]
    public async Task Start_Returns409_WhileAFreshRunIsStillRunning_ButNotForAStaleOne()
    {
        var running = await SeedRunAsync("Running", bookingStatus: BookingStatus.Requested, startedAgo: TimeSpan.FromMinutes(1));
        var stale = await SeedRunAsync("Running", bookingStatus: BookingStatus.Requested, startedAgo: TimeSpan.FromMinutes(30));
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var blocked = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = running.BookingId });
        var allowed = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = stale.BookingId });

        Assert.Equal(HttpStatusCode.Conflict, blocked.StatusCode);
        Assert.Equal(1, await CountRunsAsync(running.BookingId));
        Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
    }

    [Fact]
    public async Task Start_ValidatesTheRequest()
    {
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = Guid.Empty })).StatusCode);
    }

    // ---------------------------------------------------------------- roles

    [Theory]
    [InlineData("OperationsManager", HttpStatusCode.OK)]
    [InlineData("Admin", HttpStatusCode.OK)]
    [InlineData("FleetCoordinator", HttpStatusCode.OK)]
    [InlineData("TourGuide", HttpStatusCode.Forbidden)]
    [InlineData("Traveler", HttpStatusCode.Forbidden)]
    public async Task ReadEndpoints_AreForStaffOnly(string role, HttpStatusCode expected)
    {
        var seeded = await SeedRunAsync("Completed");
        var client = await ClientForRoleAsync(_factory, role);

        foreach (var url in new[]
                 {
                     "/api/agent-workflows",
                     $"/api/agent-workflows/runs/{seeded.RunId}",
                     $"/api/agent-workflows/{seeded.RunId}/summary"
                 })
        {
            Assert.Equal(expected, (await client.GetAsync(url)).StatusCode);
        }
    }

    [Theory]
    [InlineData("TourGuide")]
    [InlineData("Traveler")]
    public async Task Start_IsForbiddenForNonStaff(string role)
    {
        var seeded = await SeedRunAsync("Failed", bookingStatus: BookingStatus.NeedsManualReview);
        var client = await ClientForRoleAsync(_factory, role);

        var response = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = seeded.BookingId });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(1, await CountRunsAsync(seeded.BookingId));
    }

    [Fact]
    public async Task Anonymous_IsUnauthorized()
    {
        var client = _factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/agent-workflows")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = Guid.NewGuid() })).StatusCode);
    }

    [Theory]
    [InlineData("/api/agent-workflows", "get")]
    [InlineData("/api/agent-workflows/{bookingId}", "get")]
    [InlineData("/api/agent-workflows/runs/{runId}", "get")]
    [InlineData("/api/agent-workflows/{id}/summary", "get")]
    [InlineData("/api/agent-workflows/start", "post")]
    [InlineData("/api/agent-workflows/{id}/approve", "post")]
    [InlineData("/api/approvals/pending", "get")]
    [InlineData("/api/approvals/{id}/decide", "post")]
    [InlineData("/api/reports/dashboard", "get")]
    public async Task Swagger_PublishesTheSessionThreeEndpoints(string path, string method)
    {
        var response = await _factory.CreateClient().GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("paths").GetProperty(path).TryGetProperty(method, out _), $"{method.ToUpperInvariant()} {path} is missing from Swagger");
    }

    // ---------------------------------------------------------------- helpers

    private async Task<int> CountRunsAsync(Guid bookingId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        return await db.AgentWorkflowRuns.CountAsync(r => r.BookingId == bookingId);
    }

    private async Task<SeededRun> SeedRunAsync(
        string runStatus,
        BookingStatus bookingStatus = BookingStatus.PendingApproval,
        Guid? bookingId = null,
        TimeSpan? startedAgo = null,
        string? plan = null,
        string? summary = null,
        Step[]? steps = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        Booking booking;
        if (bookingId is null)
        {
            var traveler = new User
            {
                Name = $"Monitor Traveler {Guid.NewGuid():N}"[..24],
                Email = $"mon-{Guid.NewGuid():N}@example.com",
                ContactNumber = "+14155550100",
                PasswordHash = "irrelevant",
                Role = UserRole.Traveler
            };
            var package = new TourPackage { Name = $"Monitor Package {Guid.NewGuid():N}"[..24], Theme = $"T-{Guid.NewGuid():N}", DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 20 };
            var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m };
            var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
            booking = new Booking
            {
                Traveler = traveler,
                TourPackage = package,
                PackageTier = tier,
                GroupSize = 2,
                StartDate = start,
                EndDate = start.AddDays(3),
                BudgetPerPerson = 500m,
                Status = bookingStatus
            };
            db.AddRange(traveler, package, tier, booking);
        }
        else
        {
            booking = await db.Bookings.Include(b => b.Traveler).Include(b => b.TourPackage).SingleAsync(b => b.Id == bookingId);
        }

        var started = DateTimeOffset.UtcNow - (startedAgo ?? TimeSpan.Zero);
        var run = new AgentWorkflowRun
        {
            Booking = booking,
            Objective = "Match a guide, verify vehicle capacity, price the trip, and validate against business rules.",
            PlanJson = plan,
            Status = runStatus,
            StartedAt = started,
            CompletedAt = runStatus is "Completed" or "Failed" ? started.AddSeconds(2) : null,
            SummaryText = summary
        };
        db.AgentWorkflowRuns.Add(run);

        var logs = new List<AgentStepLog>();
        foreach (var s in steps ?? Array.Empty<Step>())
        {
            var log = new AgentStepLog
            {
                WorkflowRun = run,
                AgentName = s.Agent,
                InputJson = s.Input,
                OutputJson = s.Output,
                ToolCallsJson = s.Tools,
                ValidationResult = s.Validation,
                DurationMs = s.DurationMs
            };
            logs.Add(log);
            db.AgentStepLogs.Add(log);
        }

        await db.SaveChangesAsync();

        // The DbContext stamps CreatedAt on insert; set explicit, increasing times afterwards so the
        // order of the steps is the order they were given in.
        var created = started;
        foreach (var log in logs)
        {
            log.CreatedAt = created = created.AddMilliseconds(10);
        }

        await db.SaveChangesAsync();
        return new SeededRun(run.Id, booking.Id, booking.Traveler.Name, booking.TourPackage.Name);
    }
}
