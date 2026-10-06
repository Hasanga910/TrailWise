# ADR 0003: Workflow state schema and the ApprovalRequest table

## Status
Accepted

## Context
Design document section 4 persists the agentic workflow in two tables: `AgentWorkflowRuns` (Id, BookingId, Objective, PlanJson, Status, StartedAt, CompletedAt) and `AgentStepLogs` (Id, WorkflowRunId, AgentName, InputJson, OutputJson, ToolCallsJson, ValidationResult, DurationMs). Section 12 asks for an ADR on the workflow-state schema. The document's table list has no table for approvals, and `Bookings.Status` has only Requested, PlanProposed, PendingApproval, Confirmed, Completed and Cancelled.

Section 5 and section 8.3 nevertheless require endpoints and behaviour that need persisted approval state:
- `GET /api/approvals/pending` and `POST /api/approvals/{id}/decide` address an **approval by its own id**;
- there are **three approval types** (large group / custom itinerary, budget override, cancellation / refund exception), and the Operations Manager sees the type, the reasons, and the decision (approve, reject, request revision) with who and when;
- a **cancellation / refund exception** arises from the traveler's action, not from a workflow run: there may be no run waiting, and the booking has to be held somewhere while a human decides.

## Decision
Keep the two document tables as specified and add one table, `ApprovalRequests`:

| Column | Purpose |
| --- | --- |
| `Id`, `BookingId` (FK, cascade) | the approval's own id (used by the endpoints) and its booking |
| `Type` | `LargeGroupOrCustomItinerary`, `BudgetOverride` or `RefundException` (stored as text) |
| `Status` | `Pending`, `Approved`, `Rejected`, `RevisionRequested`, `Superseded` |
| `PreviousBookingStatus` | the status to restore when a revision is requested on a cancellation |
| `ReasonsJson` | why the deterministic rules required approval |
| `RequesterNote` | the traveler's cancellation reason (refund exceptions) |
| `RequestedAt`, `DecidedBy`, `DecidedAt`, `DecisionNote` | who decided, when, and the manager's note |
| `CreatedAt`, `UpdatedAt` | audit fields, as for every table (doc section 4) |

Supporting decisions:
- A **filtered unique index** on `BookingId` where `Status = 'Pending'` allows at most one open request per booking, so a booking can never be decided twice concurrently. An index on (`Status`, `Type`) serves the queue and its counts.
- A booking waiting for approval keeps using the existing status `PendingApproval`; the **type lives in `ApprovalRequests`**, so `Booking.Status` is unchanged. A revision request moves the booking to `PlanProposed` (a document status) and stores the manager's note on the booking as `RevisionNote`, which the traveler sees.
- A new workflow run **supersedes** any still-open request for the booking (status `Superseded`), so a re-run replaces rather than duplicates.
- Evidence shown to the manager (guide reasoning, vehicle, pricing breakdown, validation results) is **not copied** into `ApprovalRequests`; it is read from the latest run's `AgentStepLogs`, which stay the single audit record.
- `AgentStepLogs.ToolCallsJson` holds the tool calls actually made (tool name from the section 8.4 allow-list, a short id-only input summary, result summary, duration). The JSON is redacted of secret-looking keys before it is stored, and again when it is read.
- The manager's decision is appended to the run as a `manager_decision` step, so the run's execution summary (section 8.2 step 8) contains the decision.
- Every decision is written to `AuditLogs` in the same transaction as the state change.

## Consequences
- **One schema addition beyond section 4**, justified above. It is additive: no existing column or table changes except the nullable `Bookings.RevisionNote`. Existing bookings that were already `PendingApproval` get a request through an idempotent backfill at startup.
- **Alternatives rejected**: deriving the type from the booking at read time cannot represent a pending refund request or its decision history; adding more `Booking.Status` values would change a document-defined enumeration and every client that reads it.
- **Approvals are queryable** by status and type, with counts, without parsing JSON.
- **Cost**: a second place that records "waiting for a human" (booking status and approval request). They are changed together in one transaction, and tests assert they cannot disagree (decisions, cancellation of a pending booking, re-runs).
