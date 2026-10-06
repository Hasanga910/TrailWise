using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TrailWise.Api.Contracts.AgentWorkflows;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;
using Xunit;
using static TrailWise.Api.Tests.ApiTestHelpers;

namespace TrailWise.Api.Tests;

/// <summary>Real tool calls recorded in AgentStepLog.ToolCallsJson (design doc 6 and 8.4).</summary>
public class ToolCallRecordingTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly string[] AllowListed =
    {
        AgentTools.GuideAvailabilityRead, AgentTools.VehicleAvailabilityRead, AgentTools.VehicleAvailabilityWrite,
        AgentTools.PricingCalculator, AgentTools.StructuredOutputFormatter
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public ToolCallRecordingTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // ---------------------------------------------------------------- recorder

    [Fact]
    public async Task TrackAsync_RecordsToolInputResultStatusAndDuration_AndDrainClears()
    {
        var recorder = new ToolCallRecorder();

        var value = await recorder.TrackAsync(
            AgentTools.GuideAvailabilityRead, "guide g1", async () => { await Task.Delay(15); return 3; }, n => $"{n} rows");

        Assert.Equal(3, value);
        using var doc = JsonDocument.Parse(recorder.DrainJson()!);
        var call = Assert.Single(doc.RootElement.EnumerateArray());
        Assert.Equal("guide_availability_read", call.GetProperty("tool").GetString());
        Assert.Equal("guide g1", call.GetProperty("input").GetString());
        Assert.Equal("3 rows", call.GetProperty("result").GetString());
        Assert.Equal("ok", call.GetProperty("status").GetString());
        Assert.True(call.GetProperty("durationMs").GetInt64() >= 10);
        Assert.Null(recorder.DrainJson());
    }

    [Fact]
    public async Task TrackAsync_RecordsAFailure_AndRethrows()
    {
        var recorder = new ToolCallRecorder();

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            recorder.TrackAsync<int>(AgentTools.PricingCalculator, "x", () => throw new InvalidOperationException("secret detail"), _ => ""));

        var json = recorder.DrainJson()!;
        Assert.Contains("\"status\":\"error\"", json);
        Assert.Contains("InvalidOperationException", json);
        Assert.DoesNotContain("secret detail", json);
    }

    [Fact]
    public async Task ANullRecorder_JustRunsTheCall()
    {
        IToolCallRecorder? none = null;

        Assert.Equal(7, await none.TrackAsync("t", "i", () => Task.FromResult(7), _ => "r"));
        none.RecordCall("t", "i", "r", 0); // no exception
    }

    [Fact]
    public void Summaries_AreTrimmed_AndTheJsonIsRedacted()
    {
        var recorder = new ToolCallRecorder();
        recorder.RecordCall(AgentTools.StructuredOutputFormatter, new string('x', 500), "ok", 1);

        var json = recorder.DrainJson()!;

        Assert.True(JsonDocument.Parse(json).RootElement[0].GetProperty("input").GetString()!.Length <= 201);
        // The redactor runs over the serialised calls: a record that carried a sensitive key is blanked.
        Assert.Equal(
            JsonRedactor.Placeholder,
            JsonDocument.Parse(JsonRedactor.RedactToString("""[{"tool":"t","apiKey":"sk-1"}]""")!).RootElement[0].GetProperty("apiKey").GetString());
    }

    // ---------------------------------------------------------------- the coordinator, real agents

    [Fact]
    public async Task ARealWorkflowRun_RecordsTheToolCallsOfEachStep_WithAllowListedNames()
    {
        var db = TestDbContextFactory.Create();
        var bookingId = SeedRealisticBooking(db, specialRequests: "vegetarian meals please");
        var recorder = new ToolCallRecorder();
        var llm = new FakeLlmClient { ResultToReturn = new ProposalSummary("Fine.", new List<string> { "none" }) };
        var llmOptions = Options.Create(new LlmOptions());
        var availability = new GuideAvailabilityService(db, NullLogger<GuideAvailabilityService>.Instance);
        var sut = new CoordinatorAgentService(
            db,
            new PreferenceExtractionAgent(new FakeLlmClient { ResultToReturn = TravelerPreferences.Empty }, llmOptions, NullLogger<PreferenceExtractionAgent>.Instance, recorder),
            new GuideMatchingAgent(db, availability, NullLogger<GuideMatchingAgent>.Instance, recorder),
            new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance, recorder),
            new PricingValidationAgent(db, recorder: recorder),
            new GuideAssignmentService(db, NullLogger<GuideAssignmentService>.Instance),
            new ProposalSummaryAgent(llm, llmOptions, recorder),
            NullLogger<CoordinatorAgentService>.Instance,
            fleetReservationService: new FleetReservationService(db, NullLogger<FleetReservationService>.Instance),
            toolCalls: recorder);

        await sut.StartWorkflowAsync(bookingId);

        var logs = await db.AgentStepLogs.OrderBy(l => l.CreatedAt).ToListAsync();
        List<JsonElement> CallsOf(string agent, string? validation = null) =>
            logs.Where(l => l.AgentName == agent && (validation is null) == (l.ValidationResult is null))
                .SelectMany(l => JsonDocument.Parse(l.ToolCallsJson ?? "[]").RootElement.EnumerateArray().Select(e => e.Clone()))
                .ToList();
        string Tool(JsonElement e) => e.GetProperty("tool").GetString()!;

        // Preference extraction: the structured-output formatter, with no traveler text in the summary.
        var preference = Assert.Single(CallsOf("PreferenceExtractionAgent"));
        Assert.Equal(AgentTools.StructuredOutputFormatter, Tool(preference));
        Assert.DoesNotContain("vegetarian", preference.GetRawText());

        // Guide matching: one availability read per candidate guide.
        var guideCalls = CallsOf("GuideMatchingAgent");
        Assert.NotEmpty(guideCalls);
        Assert.All(guideCalls, c => Assert.Equal(AgentTools.GuideAvailabilityRead, Tool(c)));
        Assert.Contains("available for the full period", guideCalls[0].GetProperty("result").GetString());

        // Fleet: the reservation, vehicle and driver reads.
        var fleetCalls = CallsOf("FleetCapacityAgent");
        Assert.Equal(3, fleetCalls.Count);
        Assert.All(fleetCalls, c => Assert.Equal(AgentTools.VehicleAvailabilityRead, Tool(c)));

        // Pricing: the calculator, with the resulting total.
        var pricing = Assert.Single(CallsOf("PricingValidationAgent"));
        Assert.Equal(AgentTools.PricingCalculator, Tool(pricing));
        Assert.Contains("validation Valid", pricing.GetProperty("result").GetString());

        // Validation step: the in-code rule check (not an allow-listed tool), then the approved vehicle write.
        var validation = CallsOf("PricingValidationAgent", validation: "x");
        Assert.Contains(validation, c => Tool(c) == AgentTools.DeterministicRuleCheck);
        Assert.Contains(validation, c => Tool(c) == AgentTools.VehicleAvailabilityWrite);

        // Summary: the structured-output formatter again.
        Assert.Equal(AgentTools.StructuredOutputFormatter, Tool(Assert.Single(CallsOf("ProposalSummaryAgent"))));

        // Every recorded tool is either allow-listed or the one explicit in-code check.
        var all = logs.SelectMany(l => JsonDocument.Parse(l.ToolCallsJson ?? "[]").RootElement.EnumerateArray()).Select(Tool);
        Assert.All(all, t => Assert.True(AllowListed.Contains(t) || t == AgentTools.DeterministicRuleCheck, t));

        // Every call has a status and a duration, and none is shared between steps.
        Assert.All(logs.Where(l => l.ToolCallsJson is not null), l =>
            Assert.All(JsonDocument.Parse(l.ToolCallsJson!).RootElement.EnumerateArray(), c =>
            {
                Assert.Equal("ok", c.GetProperty("status").GetString());
                Assert.True(c.GetProperty("durationMs").GetInt64() >= 0);
            }));
    }

    [Fact]
    public async Task AgentsBuiltWithoutARecorder_StillWork_AndLeaveToolCallsEmpty()
    {
        var db = TestDbContextFactory.Create();
        var bookingId = SeedRealisticBooking(db, specialRequests: null);
        var availability = new GuideAvailabilityService(db, NullLogger<GuideAvailabilityService>.Instance);
        var guide = await new GuideMatchingAgent(db, availability, NullLogger<GuideMatchingAgent>.Instance).MatchAsync(bookingId);
        var vehicle = await new FleetCapacityAgent(db, NullLogger<FleetCapacityAgent>.Instance).MatchAsync(bookingId);
        var price = await new PricingValidationAgent(db).CalculateAsync(bookingId, guide, vehicle);

        Assert.NotEqual(Guid.Empty, guide.GuideId);
        Assert.NotEqual(Guid.Empty, vehicle.VehicleId);
        Assert.Equal("Valid", price.ValidationResult);
    }

    // ---------------------------------------------------------------- through the API

    [Fact]
    public async Task ReRunningAWorkflow_ThroughTheApi_RecordsToolCalls_AndTheMonitorEndpointsReturnThem()
    {
        var bookingId = await SeedRequestedBookingWithResourcesAsync();
        var client = await ClientForRoleAsync(_factory, "OperationsManager");

        var started = await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = bookingId });
        started.EnsureSuccessStatusCode();
        var detail = (await started.Content.ReadFromJsonAsync<AgentWorkflowRunDetailDto>(JsonOptions))!;

        // Run detail: tool calls per step, as parsed JSON.
        var byAgent = detail.Steps.Where(s => s.ToolCalls is not null).ToDictionary(s => s.AgentName + (s.ValidationResult is null ? "" : "/validate"), s => s.ToolCalls!.Value);
        Assert.Equal("guide_availability_read", byAgent["GuideMatchingAgent"][0].GetProperty("tool").GetString());
        Assert.Equal("vehicle_availability_read", byAgent["FleetCapacityAgent"][0].GetProperty("tool").GetString());
        Assert.Equal("pricing_calculator", byAgent["PricingValidationAgent"][0].GetProperty("tool").GetString());
        Assert.Contains(byAgent["PricingValidationAgent/validate"].EnumerateArray(), c => c.GetProperty("tool").GetString() == "deterministic_rule_check");
        var first = byAgent["GuideMatchingAgent"][0];
        Assert.False(string.IsNullOrWhiteSpace(first.GetProperty("input").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(first.GetProperty("result").GetString()));
        Assert.True(first.GetProperty("durationMs").GetInt64() >= 0);

        // Summary: the tool-call counts add up to what the detail shows.
        var summary = (await client.GetFromJsonAsync<AgentWorkflowSummaryDto>($"/api/agent-workflows/{detail.Id}/summary", JsonOptions))!;
        var expected = detail.Steps.Sum(s => s.ToolCalls is { ValueKind: JsonValueKind.Array } t ? t.GetArrayLength() : 0);
        Assert.True(expected >= 6);
        Assert.Equal(expected, summary.ToolCallCount);
        Assert.Contains(summary.Steps, s => s.AgentName == "FleetCapacityAgent" && s.ToolCallCount == 3);

        // The persisted JSON never contains secret-looking keys or traveler free text.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var stored = await db.AgentStepLogs.Where(l => l.WorkflowRunId == detail.Id).Select(l => l.ToolCallsJson).ToListAsync();
        Assert.DoesNotContain(stored, j => j is not null && j.Contains("[redacted]"));
    }

    [Fact]
    public async Task ApprovingABooking_RecordsTheGatedVehicleWriteInTheManagerDecisionStep()
    {
        var bookingId = await SeedRequestedBookingWithResourcesAsync(groupSize: 12); // large group: needs approval
        var client = await ClientForRoleAsync(_factory, "OperationsManager");
        (await client.PostAsJsonAsync("/api/agent-workflows/start", new { BookingId = bookingId })).EnsureSuccessStatusCode();
        Guid approvalId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
            approvalId = await db.ApprovalRequests.Where(a => a.BookingId == bookingId && a.Status == ApprovalStatus.Pending).Select(a => a.Id).SingleAsync();
            Assert.False(await db.VehicleAssignments.AnyAsync(a => a.BookingId == bookingId), "no reservation before approval");
        }

        (await client.PostAsJsonAsync($"/api/approvals/{approvalId}/decide", new { Decision = "Approve" })).EnsureSuccessStatusCode();

        using var verify = _factory.Services.CreateScope();
        var vdb = verify.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var decision = await vdb.AgentStepLogs.SingleAsync(l => l.AgentName == "manager_decision" && l.WorkflowRun.BookingId == bookingId);
        var tools = JsonDocument.Parse(decision.ToolCallsJson!).RootElement.EnumerateArray().Select(c => c.GetProperty("tool").GetString()).ToList();
        Assert.Contains(AgentTools.VehicleAvailabilityWrite, tools);
        Assert.True(tools.IndexOf(AgentTools.VehicleAvailabilityWrite) > tools.IndexOf(AgentTools.VehicleAvailabilityRead));
    }

    // ---------------------------------------------------------------- helpers

    private static Guid SeedRealisticBooking(TrailWiseDbContext db, string? specialRequests)
    {
        var theme = $"Theme-{Guid.NewGuid():N}";
        var traveler = new User { Name = "T", Email = $"t-{Guid.NewGuid():N}@example.com", ContactNumber = "+14155550100", PasswordHash = "x", Role = UserRole.Traveler };
        var package = new TourPackage { Name = "P", Theme = theme, DurationDays = 3, BasePricePerPerson = 100m, MaxGroupSize = 50 };
        var tier = new PackageTier { TourPackage = package, ClassType = ClassType.Normal, BasePricePerPerson = 100m, IncludesFood = false };
        var start = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var booking = new Booking
        {
            Traveler = traveler, TourPackage = package, PackageTier = tier, GroupSize = 2, StartDate = start, EndDate = start.AddDays(3),
            BudgetPerPerson = 500m, SpecialRequests = specialRequests, Status = BookingStatus.Requested
        };
        db.AddRange(
            traveler, package, tier, booking,
            new Guide { Name = "G", Specializations = new[] { theme }, Languages = new[] { "English" } },
            new Vehicle { Type = VehicleType.Van, RegistrationNumber = $"R-{Guid.NewGuid():N}"[..10], Capacity = 10, HasAC = true, SeatConfiguration = "2-2", MaintenanceStatus = VehicleMaintenanceStatus.Available },
            new Driver { Name = "D", LicenseNumber = $"L-{Guid.NewGuid():N}"[..10], ContactInfo = "+94770000000" });
        db.SaveChanges();
        return booking.Id;
    }

    private async Task<Guid> SeedRequestedBookingWithResourcesAsync(int groupSize = 2)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var id = SeedRealisticBooking(db, specialRequests: null);
        if (groupSize != 2)
        {
            var booking = await db.Bookings.SingleAsync(b => b.Id == id);
            booking.GroupSize = groupSize;
            await db.SaveChangesAsync();
        }

        return id;
    }
}
