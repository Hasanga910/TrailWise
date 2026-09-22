# Coordinator / Planning Agent (P1 Agent)

This document describes how the "Coordinator/Planning Agent" works in TrailWise. It is a
snapshot of the current implementation — read the linked source files for the latest state.

## TL;DR

The coordinator is a **deterministic C# orchestrator, not an LLM agent**. It runs a fixed
4-step plan whenever a booking is created, delegates each step to a sub-agent (three of which
are hard-coded mocks today), and hands the results to a pure business-rule function that decides
whether the booking is auto-approved, sent for manual approval, or flagged for manual review.
No LLM, prompt, or external AI API is involved anywhere in this feature.

---

## 1. Trigger

[`BookingsController.Create`](../backend/src/TrailWise.Api/Controllers/BookingsController.cs#L38-L84)
saves a new `Booking` with status `Requested`, then calls `DispatchCoordinatorWorkflow(booking.Id)`.

That method fires the workflow via `_ = Task.Run(...)` on a **freshly created DI scope**, using
`CancellationToken.None` (deliberately — the HTTP request's own token would be cancelled the
moment the response is returned, which would kill the workflow mid-flight).

Key implications:
- **Fire-and-forget.** The API responds with `201 Created` immediately; the client does not wait
  for the workflow to finish.
- **No durable queue.** There's no Hangfire/MassTransit/outbox — if the process crashes mid-run,
  the `AgentWorkflowRun` stays `Running` and the booking stays `Requested` forever. There's no
  retry or recovery mechanism.
- If the background task throws, the `catch` block marks the booking `NeedsManualReview` via
  `MarkBookingNeedsManualReviewAsync` (which itself swallows any failure it hits).

---

## 2. The coordinator's workflow

Core logic: [`CoordinatorAgentService.StartWorkflowAsync`](../backend/src/TrailWise.Infrastructure/Agents/CoordinatorAgentService.cs#L48)

```
Booking created (Requested)
        │
        ▼
Load booking + PackageTier ── missing? ──► log warning, return (no run row created)
        │
        ▼
Build static 4-step plan (AgentWorkflowPlan)
        │
        ▼
Persist AgentWorkflowRun (Status=Running)
        │
        ▼
Step 1: match_guide     → IGuideMatchingAgent.MatchAsync
Step 2: check_vehicle   → IFleetCapacityAgent.MatchAsync
Step 3: calculate_price → IPricingValidationAgent.CalculateAsync
   (each step logged as an AgentStepLog row; plan step marked "done")
        │
        ▼
Step 4: validate → BookingApprovalEvaluator.Evaluate (pure function, no I/O)
        │
        ▼
Map decision → Booking.Status + AgentWorkflowRun.Status, commit in a transaction
```

### 2.1 The plan is static, not generated

[`AgentWorkflowPlan`](../backend/src/TrailWise.Infrastructure/Agents/AgentWorkflowPlan.cs) is
just a list of `AgentWorkflowPlanStep { Step, Agent, Status }`. The coordinator builds the exact
same 4 steps every time — there's no planning/reasoning step that decides *what* to do; "planning"
here just means "track the fixed steps and their pending/done status," which is then serialized to
`PlanJson` on the `AgentWorkflowRun` row so you can see progress if you inspect the DB mid-run.

### 2.2 Step execution helper

[`RunStepAsync<TResult>`](../backend/src/TrailWise.Infrastructure/Agents/CoordinatorAgentService.cs#L188-L215)
is the generic helper used for steps 1–3:
1. Starts a `Stopwatch`.
2. Awaits the sub-agent call.
3. Writes an `AgentStepLog` row: `AgentName`, `InputJson` (serialized request), `OutputJson`
   (serialized result), `DurationMs`.
4. Marks the corresponding plan step `Done` and re-persists `PlanJson`.
5. Saves changes to the DB immediately (so step logs land even if a later step throws).

### 2.3 Security note baked into the code

There's a deliberate, explicitly-commented security decision at
[`CoordinatorAgentService.cs:74-78`](../backend/src/TrailWise.Infrastructure/Agents/CoordinatorAgentService.cs#L74-L78):

> `booking.SpecialRequests` is untrusted free text supplied by the traveler. It must **never**
> be interpolated into `Objective`, `InputJson`, or any other field that could later be fed to
> an LLM prompt/instruction context.

This is a prompt-injection defense put in place *before* any LLM actually exists in the system —
a forward-looking guard for whenever a real LLM-backed sub-agent is added.

### 2.4 Final decision → status mapping

| `BookingApprovalEvaluator.Decision` | `Booking.Status`     | `AgentWorkflowRun.Status` | `CompletedAt` |
|---|---|---|---|
| `Approved` | `Confirmed` | `Completed` | set |
| `NeedsApproval` | `PendingApproval` | `AwaitingApproval` | **left null** (paused, pending a future out-of-scope human-approval step) |
| `ValidationFailed` | `NeedsManualReview` | `Failed` | set |

Persistence for this final step is wrapped in a DB transaction — but only
`if (_db.Database.IsRelational())`, since the in-memory EF Core provider used by the xUnit tests
doesn't support transactions. On exception, the transaction is rolled back and the exception
rethrown.

---

## 3. The approval gate — deterministic, not agentic

[`BookingApprovalEvaluator.Evaluate`](../backend/src/TrailWise.Infrastructure/Agents/BookingApprovalEvaluator.cs#L33)
is a **pure, synchronous, static function** — no DB access, no I/O. The file's own doc comment is
explicit: *"Runs in plain code, never left to an LLM's judgement, per the design doc's Section 8.4
requirement."* (That referenced design doc is not checked into this repo.)

Rules, evaluated in this order:

1. **Hard failures → `ValidationFailed`** (checked first; these override everything else):
   - `TierRequiresAc && !VehicleAcMatch` — the package tier requires air conditioning but the
     matched vehicle doesn't have it.
   - `VehicleConflictCheck` is true (a scheduling conflict was detected), **or**
     `GuideMatchScore < 0.5` (`MinAcceptableGuideMatchScore`).
2. **Otherwise, `NeedsApproval` if either:**
   - `GroupSize > 10` (`LargeGroupThreshold`), or
   - `TotalCost > BudgetPerPerson * GroupSize * 1.15` (`BudgetMarginMultiplier`) — note this is a
     strict `>`, so a cost exactly at the 115% ceiling is still `Approved` (confirmed by a
     boundary test case).
3. **Otherwise, `Approved`.**

Each triggered rule appends a human-readable reason string to `Result.Reasons`, which is what
gets logged as `OutputJson` on the `validate` step.

⚠️ **Known duplication risk:** `LargeGroupThreshold = 10` is hard-coded in *two* places —
here, and again in `TrailWise.Api.Contracts.Bookings.BookingDto.LargeGroupThreshold` — because the
Infrastructure project can't reference the Api project. Both files carry a comment flagging this;
if the threshold ever changes, both must be updated by hand.

---

## 4. The three sub-agents (all mocks today)

All three are explicitly labeled as placeholders for other team members' real implementations —
the naming even attributes ownership ("Person 2", "Person 3", "Person 4"). Swapping in a real
implementation only requires changing the DI registration in
[`DependencyInjection.cs:33-36`](../backend/src/TrailWise.Infrastructure/DependencyInjection.cs#L33-L36) —
`CoordinatorAgentService` itself never needs to change, since it only depends on the interfaces.

| Sub-agent | Interface | Mock behavior |
|---|---|---|
| Guide Matching | `IGuideMatchingAgent` | [`MockGuideMatchingAgent`](../backend/src/TrailWise.Infrastructure/Agents/MockGuideMatchingAgent.cs) always returns a fixed `MatchScore = 0.9` and canned reasoning text. Deliberately deterministic (not randomized) so tests never flake. |
| Fleet & Capacity | `IFleetCapacityAgent` | [`MockFleetCapacityAgent`](../backend/src/TrailWise.Infrastructure/Agents/MockFleetCapacityAgent.cs) always returns `AcMatch=true, SeatConfigMatch=true, ConflictCheck=false` — i.e., "vehicle is always fine." |
| Pricing & Validation | `IPricingValidationAgent` | [`MockPricingValidationAgent`](../backend/src/TrailWise.Infrastructure/Agents/MockPricingValidationAgent.cs) is the **only mock with real logic** — it queries the actual `Booking`/`PackageTier` from the DB and computes `basePricePerPerson * groupSize + (15/person catering surcharge if IncludesFood)`. This makes the coordinator's budget-override rule actually testable against real numbers rather than a stub constant. Its own `ValidationResult = "Calculated"` string is purely informational — the coordinator never branches on it; only `BookingApprovalEvaluator` decides the outcome. |

---

## 5. Persistence model

Two new tables back the workflow:

**`AgentWorkflowRun`** ([entity](../backend/src/TrailWise.Domain/Entities/AgentWorkflowRun.cs))
- `BookingId` (FK), `Objective` (fixed descriptive string), `PlanJson` (serialized `AgentWorkflowPlan`, updated after every step), `Status` (`Running` / `AwaitingApproval` / `Completed` / `Failed`), `StartedAt`, `CompletedAt` (nullable).

**`AgentStepLog`** ([entity](../backend/src/TrailWise.Domain/Entities/AgentStepLog.cs))
- `WorkflowRunId` (FK), `AgentName`, `InputJson`, `OutputJson`, `ToolCallsJson` (defined but **never populated** — a forward-looking placeholder for a future LLM's tool-call trace), `ValidationResult` (only set on the `validate` step), `DurationMs`.

EF Core configurations: [`AgentWorkflowRunConfiguration.cs`](../backend/src/TrailWise.Infrastructure/Persistence/Configurations/AgentWorkflowRunConfiguration.cs), [`AgentStepLogConfiguration.cs`](../backend/src/TrailWise.Infrastructure/Persistence/Configurations/AgentStepLogConfiguration.cs).

**Nothing in the frontend (React) or mobile (Flutter) app reads this data.** Travelers/admins
only ever see the resulting `Booking.Status`. There is no API endpoint that exposes
`AgentWorkflowRun`/`AgentStepLog`, and no "why was this booking flagged?" screen anywhere.

---

## 6. External services / LLM calls

**None.** Every "agent" call in this feature is in-process C#, and only
`MockPricingValidationAgent` touches the database — no HTTP calls, no LLM API, no prompt
templates. (The only actual external HTTP integration in the Infrastructure layer,
`NominatimLocationSearchService` calling OpenStreetMap's Nominatim API, is unrelated — it's for
location search, not the planning agent.)

That said, several design choices strongly suggest the team is scaffolding for a *future*
LLM-based version:
- The `ToolCallsJson` column exists but is unused.
- The prompt-injection guard around `SpecialRequests` (see §2.3) has no purpose *yet* — it only
  matters once something feeds text into an LLM context.
- The naming vocabulary itself ("Coordinator", "Objective", "plan", "steps") mirrors typical
  agent-orchestration frameworks.

> **Update:** a follow-on spec (`TrailWise_LLM_Coordinator_Agent_Architecture`) plans to add two
> real, local-LLM-backed capabilities (Preference Extraction + Proposal Summary) via a
> self-hosted Ollama container, without touching the deterministic `BookingApprovalEvaluator`
> core. See that spec for details. Its Phase 0 (moving all agent files into a dedicated
> `Agents/` folder) has been completed — see §9 below.

---

## 7. Tests

**Backend (xUnit)** — [`backend/tests/TrailWise.Api.Tests/`](../backend/tests/TrailWise.Api.Tests/)
- `CoordinatorAgentServiceTests.cs`:
  - Small group within budget → `Confirmed` / `Completed`.
  - Group size > 10 → `PendingApproval` / `AwaitingApproval`.
  - Total cost over the 115% ceiling → `PendingApproval`.
  - Missing booking → no-op (no `AgentWorkflowRun` row created at all).
  - Asserts exactly 4 `AgentStepLog` rows are written per run, and that `PlanJson` ends with
    every step marked `"status":"done"`.
- `BookingApprovalEvaluatorTests.cs`: a pure table-driven test of the gate logic — approved
  baseline, AC mismatch, vehicle conflict, low guide score, large group, over-budget, and the
  exactly-at-ceiling boundary case (confirmed inclusive → `Approved`).
- `TestDbContextFactory.cs`: shared helper for spinning up an EF Core InMemory `TrailWiseDbContext`
  for these tests.

**Frontend / mobile:** no React Testing Library or Flutter widget test exercises the coordinator
directly today.

---

## 8. Known gaps / things to watch

1. **`NeedsApproval` is currently a dead end.** There is no endpoint or UI to move a booking out
   of `PendingApproval` — the human-approval step is explicitly called out in code comments as
   future, out-of-scope work.
2. **No crash recovery.** The fire-and-forget `Task.Run` has no retry, no durable queue, and no
   reconciliation job — a process crash mid-workflow leaves a run stuck at `Running` indefinitely.
3. **Threshold duplicated** between `BookingApprovalEvaluator.LargeGroupThreshold` and
   `BookingDto.LargeGroupThreshold` (see §3) — must be kept in sync manually.
4. **No observability surface.** Nothing in the frontend or API exposes workflow run/step data,
   so there's no way for an admin to see *why* a booking landed in `PendingApproval` or
   `NeedsManualReview` without querying the database directly. (Planned to be closed by the LLM
   spec's `GET /api/agent-workflows/{bookingId}` endpoint.)
5. **All but pricing are mocks.** Guide matching and fleet capacity always return the same
   "everything's fine" result regardless of the actual booking — real matching/scheduling logic
   doesn't exist yet.

---

## 9. Quick file index

All agent-related code lives in `backend/src/TrailWise.Infrastructure/Agents/` (namespace
`TrailWise.Infrastructure.Agents`), consolidated there from the general-purpose `Services/`
folder so it's cleanly separated from unrelated infrastructure code (auth, location search, etc.,
which remain in `Services/`).

| Concern | Path |
|---|---|
| Orchestrator | `backend/src/TrailWise.Infrastructure/Agents/CoordinatorAgentService.cs` |
| Orchestrator interface | `backend/src/TrailWise.Infrastructure/Agents/ICoordinatorAgentService.cs` |
| Plan model | `backend/src/TrailWise.Infrastructure/Agents/AgentWorkflowPlan.cs` |
| Approval gate | `backend/src/TrailWise.Infrastructure/Agents/BookingApprovalEvaluator.cs` |
| JSON options | `backend/src/TrailWise.Infrastructure/Agents/AgentJsonOptions.cs` |
| Guide mock | `backend/src/TrailWise.Infrastructure/Agents/MockGuideMatchingAgent.cs` (+ `IGuideMatchingAgent.cs`) |
| Fleet mock | `backend/src/TrailWise.Infrastructure/Agents/MockFleetCapacityAgent.cs` (+ `IFleetCapacityAgent.cs`) |
| Pricing mock | `backend/src/TrailWise.Infrastructure/Agents/MockPricingValidationAgent.cs` (+ `IPricingValidationAgent.cs`) |
| DI wiring | `backend/src/TrailWise.Infrastructure/DependencyInjection.cs` |
| Trigger point | `backend/src/TrailWise.Api/Controllers/BookingsController.cs` |
| Run entity | `backend/src/TrailWise.Domain/Entities/AgentWorkflowRun.cs` |
| Step log entity | `backend/src/TrailWise.Domain/Entities/AgentStepLog.cs` |
| Tests | `backend/tests/TrailWise.Api.Tests/CoordinatorAgentServiceTests.cs`, `BookingApprovalEvaluatorTests.cs` |

---

## 10. Roadmap — real LLM-backed capabilities (in progress)

A follow-on spec adds two genuine, local-LLM-backed capabilities on top of this deterministic
core, using a free self-hosted model via Ollama (no API key, no per-call cost):

1. **Preference Extraction Agent** — reads `Booking.SpecialRequests` and extracts structured
   dietary/accessibility/other notes. Advisory only; cannot change `Booking.Status`. Includes an
   explicit prompt-injection defense (treats the traveler's text as data to extract from, never
   as instructions).
2. **Proposal Summary & Advisory Agent** — after the deterministic decision is committed, writes
   a plain-English explanation of the booking proposal for Operations Manager review, exposed via
   a new `GET /api/agent-workflows/{bookingId}` endpoint. Runs strictly after the status is
   already committed; failures never affect the booking outcome.

`BookingApprovalEvaluator` itself is explicitly **not** touched by this roadmap — it remains
pure, deterministic, zero-I/O.

**Progress:**
- [x] **Phase 0** — Reorganized all agent-related files from `Services/` into a dedicated
      `Agents/` folder (namespace `TrailWise.Infrastructure.Agents`), as a pure move with no
      behavior change. Verified: `dotnet build` clean, all 60 existing tests pass unmodified,
      `git diff --stat` shows renames (not delete+add).
- [ ] Phase A — Local LLM client infrastructure (Ollama docker-compose service, `ILocalLlmClient`,
      config/kill-switch).
- [ ] Phase B — Preference Extraction Agent.
- [ ] Phase C — Proposal Summary & Advisory Agent + `GET /api/agent-workflows/{bookingId}`.
- [ ] Phase D — Guardrail/fallback tests + updated step-count assertions.
