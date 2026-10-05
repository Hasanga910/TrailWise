# TrailWise Improvement Plan v2 (aligned to the Project Design Document)

> **Source of truth:** `docs/TrailWise_AI_Project_Design_Document.pdf` (SE3090 Assignment 1). Every session below implements something that document asks for. **Do not add features that are not in the design document** unless the user explicitly approves them.
>
> **How to use this file.** Run **one session per Claude Code conversation**, in order. At the start of each session, paste that session's **Kickoff prompt**. Claude Code should:
> 1. Read this file (sections 1–3 and the session) and the relevant parts of the design document.
> 2. Explore the listed files and produce a written plan (plan mode). Wait for approval before editing code.
> 3. Implement step by step. **Never run `git commit`.** After each step, stage the changes, give the user a commit message (summary line plus bullets), and wait for "committed".
> 4. Run the checks in "Definition of done" and update the **Progress log** at the bottom.

---

## 1. What the design document requires (summary)

| Area | Design document requirement | Doc section |
| --- | --- | --- |
| Roles | Traveler, Tour Guide, Operations Manager, Fleet Coordinator, plus Admin (cross-cutting) | §2 |
| React (operations console) | Dashboard (upcoming tours, pending-approval count, guide and vehicle utilisation); searchable/filterable/**paginated** booking list; package catalogue with **tier configuration**; guide and vehicle **availability calendars** incl. AC/seat configuration; **approval queue with three approval types**; **agent workflow monitor** (plan, steps, tool calls, validation, execution summary); itinerary builder/editor; reports (occupancy chart, revenue by package, guide utilisation, exportable audit report); state management with Redux Toolkit **or** Zustand, justified in an ADR | §6 |
| Flutter (traveler and guide app) | Login with secure storage; tour browsing and custom request form (dates, group size, budget, theme, language, tier class with/without food); **document upload (ID/passport) via camera or file picker**; **GPS/maps** for meeting-point directions and **live tour location**; booking status tracking; itinerary viewer; **push notifications**; guide view (assigned tours, attendance/completion marking, notes); loading, empty and offline error states; Provider or Riverpod justified in an ADR | §7 |
| Approval types | 1) Large-group / custom itinerary, 2) Budget-override quotation, 3) **Cancellation / refund exception**. Ops Manager can **approve, reject or request revision** | §8.2–8.3 |
| Agentic AI | Coordinator, Guide Matching, Fleet & Capacity, Pricing & Validation agents; persisted runs and step logs; deterministic checks; prompt-injection resistance; safe failure to NeedsManualReview | §8 |
| Third-party | **Maps API** (route planning, meeting points, live location), **Weather API** (forecast feeding itinerary risk), ~~**Payment gateway sandbox** (e.g. Stripe test mode)~~ (**out of scope**: payment gateway out of scope for this campus project; existing bank-slip flow kept as is; a documented deviation from §9). All calls through the backend, keys in environment variables, timeouts and graceful fallback | §9 |
| Endpoints | Includes `GET /api/approvals/pending`, `POST /api/approvals/{id}/decide`, agent-workflow endpoints, payment and reporting endpoints | §5 |
| Data | Entities per §4, incl. `BookingAddOn` (optional extras e.g. private transport upgrade, extra activity), `Payment` status Pending/DepositPaid/FullyPaid/Refunded | §4 |
| Reporting | Occupancy rate, guide utilisation, revenue by package, **cancellation rate** | §1.1, §6 |
| Testing | Backend unit/integration/auth; DB migration, constraint and transaction-rollback tests; React approval-queue (all three types) and protected-route tests; Flutter widget tests (request form, itinerary viewer); E2E of the full §8.2 workflow; agent golden cases incl. prompt injection; performance (k6 or similar) | §11 |
| Documentation | ADRs: React state management, Flutter state management, agent orchestration, workflow-state schema, deployment platform, maps/weather selection and fallback | §12 |

**Already done (Sessions 1–2):** design system, app shell, dark mode, toasts (all roles); public site, package explorer with map and reviews, auth redesign. The public explorer goes slightly beyond the document (React is described as the operations console) but supports "travelers browsing" and stays. No further traveler-web features are added; traveler features go to Flutter, as the document specifies.

**Out of scope (not in the document, do not build):** wishlist/favourites, currency conversion (prices stay in USD), command palette, in-app web notification centre, PDF trip sheets, offline caching beyond error states, onboarding carousels, new Driver-role features (the Driver role exists in code and keeps working as is).

---

## 2. Design direction (unchanged)

Keep the Session 1 design system: teal `brand` + amber `accent`, semantic tokens, light/dark, Plus Jakarta Sans + Inter, `components/ui` primitives, `notify` toasts, the status colour table. Flutter gets a matching theme in Session 6.

---

## 3. Global rules (every session)

1. **Scope:** only what the design document asks for (section 1). If something seems missing or a choice is needed, ask the user instead of inventing scope.
2. **Git:** never run `git commit`. Stage per step, give a commit message, wait for "committed". Never push.
3. **Behaviour:** keep existing API contracts and role guards unless the session changes them; DTO changes are additive so the Flutter app keeps working.
4. **CI green:** `npm run lint`, `npm test`, `npm run build` (web); `flutter analyze`, `flutter test` (mobile); `dotnet build`, `dotnet test` (backend). The `noRawColors` guard stays green.
5. **Backend changes:** EF Core migration, role guards, ProblemDetails errors, xUnit tests, Swagger visible.
6. **Third-party services:** called only from the backend, keys in environment variables (`.env.example` documented, never committed), timeouts, retry limits and a graceful fallback (doc §9).
7. **Currency:** USD everywhere. No conversion.
8. **UI quality:** reuse `components/ui`, WCAG AA, responsive 360–1440px, light and dark.
9. **Big files:** split files over ~500 lines when you touch them.

---

## 4. Sessions

### Session 3: Approval queue, agent workflow monitor and Ops dashboard (React + backend)

**Why:** this is the heart of the assessed workflow (doc §6, §8.2 steps 6–8, §8.3). The document requires three approval types with evidence and approve / reject / request-revision decisions.

**Backend:**
- `GET /api/approvals/pending` returning items typed as `LargeGroupOrCustomItinerary`, `BudgetOverride` or `RefundException`, each with its evidence: guide match reasoning, vehicle assignment, full pricing breakdown, validation results (from `AgentWorkflowRuns`/`AgentStepLogs`).
- `POST /api/approvals/{id}/decide` with `Approve`, `Reject` or `RequestRevision` (revision requires a note; the booking moves to `PlanProposed` with the note visible to the traveler).
- **Cancellation / refund exception** (new): a traveler cancelling inside the cancellation window (configurable, e.g. 7 days before start) with an approved payment can request a refund. This creates a `RefundException` approval. Approve marks the payment `Refunded` and the booking `Cancelled`; reject cancels without refund. Write audit log entries for every decision. (`Refunded` is a status change only: there is no payment gateway, so the money itself is returned by staff outside the system; the existing bank-slip payment code is not changed.)
- Approve still confirms the booking in one transaction with guide assignment, vehicle reservation and the audit log (doc §4 transactions).
- Tests for all three types and all three decisions, role guards (Ops Manager only, Admin as cross-cutting), and transaction rollback when a reservation conflicts.

**React:**
- **Approval queue** page: tabs for the three approval types with counts, evidence panel per item, approve / reject / request revision with a required note for reject and revision.
- **Agent workflow monitor**: list of workflow runs with live status (polling), drill-down showing the plan, each step with agent, inputs/outputs, tool calls, timings, validation result, and the execution summary.
- **Ops dashboard**: upcoming tours, pending-approval count by type, guide and vehicle utilisation at a glance.
- **State management:** introduce Redux Toolkit **or** Zustand for booking/approval state, as the doc requires; write the ADR (`docs/adr/`) justifying the choice.

**Definition of done:** each of the three approval types can be triggered, reviewed with evidence, and approved, rejected or sent for revision from React; tests cover the approval queue for all three types (doc §11).

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 3) and the design document `docs/TrailWise_AI_Project_Design_Document.pdf` sections 5, 6 and 8. Stay strictly within the design document. Plan Session 3: approvals endpoints with the three approval types (including the new cancellation/refund exception) and approve/reject/request-revision, the React approval queue, the agent workflow monitor, the Ops dashboard, and the Redux Toolkit vs Zustand choice with its ADR. Do not run git commit: after each step, stage the changes and give me a commit message. Wait for my approval before coding.

---

### Session 4: Packages, bookings, add-ons and reports (React + backend)

**Why:** doc §6 package and booking management, §4 `BookingAddOn`, §6 reports, §1.1 cancellation rate.

- **Package catalogue with tier configuration:** create/edit packages and tiers (class type, food included, AC required, tier price) in one clear screen.
- **Booking list:** server-side search, filters (status, date range, package, large group) and **pagination** (`PagedResult` exists), with a booking detail drawer.
- **Booking add-ons (`BookingAddOn`):** a small predefined list of optional extras using the doc's examples (private transport upgrade, extra activity), selectable when a booking is requested, priced into the quotation by the Pricing & Validation agent (already sums add-ons). Backend accepts add-ons on booking creation; Ops can view them on the booking.
- **Reports:** occupancy chart, revenue by package, guide utilisation, **cancellation rate**, and the exportable audit report, using charts from the design system.

**Definition of done:** booking list paginates server-side; a booking with add-ons shows them in the pricing breakdown; all report charts render in light and dark.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 4) and the design document sections 4, 5 and 6. Stay strictly within the design document. Plan Session 4: package catalogue with tier configuration, server-side searchable/filterable/paginated booking list, booking add-ons (doc examples only), and the reports (occupancy, revenue by package, guide utilisation, cancellation rate, exportable audit). Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

### Session 5: Availability calendars, fleet review and itinerary builder with maps and weather (React + backend)

**Why:** doc §6 calendars and itinerary builder, §9 maps and weather APIs, Fleet Coordinator permissions in §2.

- **Guide availability calendar** (month view) and **vehicle availability calendar** showing AC and seat configuration, maintenance status and assignments.
- **Fleet review:** Fleet Coordinator views and adjusts AI-proposed vehicle assignments and flags vehicles for maintenance, with overlap checks.
- **Itinerary builder/editor** for confirmed bookings: day-by-day steps with location, time and activity.
- **Maps API** (OpenRouteService or Google Maps free tier) via a backend proxy: route between itinerary stops shown on the map.
- **Weather API** (OpenWeatherMap free tier) via a backend proxy: forecast for each itinerary day, outdoor-risk note shown in the itinerary; graceful fallback (skip the check) if unavailable.
- ADR: maps/weather API selection and fallback strategy (doc §12).

**Definition of done:** an itinerary shows its route and weather; with the weather service disabled the itinerary still works and says the forecast is unavailable.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 5) and the design document sections 2, 6 and 9. Stay strictly within the design document. Plan Session 5: guide and vehicle availability calendars, fleet review/adjust of AI-proposed assignments, the itinerary builder with a maps route and weather forecast through backend proxies with fallback, and the maps/weather ADR. Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

### Session 6: Flutter design system and traveler app

**Why:** doc §7 traveler features.

- Flutter theme and shared widgets matching the web design system (colours, typography, status chips, loading/empty/error states).
- Tour browsing and the **custom request form**: dates (date picker), group size, budget, theme, language preference, tier (class, with/without food), add-ons from Session 4.
- **Document upload (ID/passport)** via camera or file picker: backend `BookingDocument` storage (private, size/type validated), viewable by Ops on the booking.
- **Booking status tracking** with a status timeline, revision notes from Session 3, and the refund-exception request from Session 3.
- **Itinerary viewer** (with the Session 5 route and weather), payment status screen, review submission.
- Loading, empty ("no tours booked") and offline error states on every screen.
- ADR: Provider vs Riverpod (doc §12); keep the current choice unless there is a reason to change.

**Definition of done:** a traveler can request a tour, upload an ID, track status through confirmation, view the itinerary, see payment status and leave a review in the app; widget tests for the request form and itinerary viewer (doc §11).

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 6) and the design document section 7. Stay strictly within the design document. Plan Session 6: Flutter theme and widgets, tour browsing and custom request form, ID/passport document upload (with backend storage), booking status tracking, itinerary viewer, payment status, review submission, responsive states, and the Flutter state-management ADR. Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

### Session 7: Flutter guide app, GPS/maps and push notifications

**Why:** doc §7 guide view, GPS/maps and push notifications.

- Guide side: assigned tours, **attendance/completion marking**, tour notes, availability.
- **Meeting-point directions:** open the meeting point in the device's maps app.
- **Live tour location:** during an active tour the guide's app shares its location to the backend (permission prompt, only while the tour is in progress); the traveler sees it on a map.
- **Push notifications** (Firebase Cloud Messaging free tier) for booking status changes, approval decisions and payment updates; device token registration endpoint in the backend.

**Definition of done:** a guide can mark attendance and completion; a traveler sees the guide's live location during an active tour; a status change triggers a push notification on a test device.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 7) and the design document section 7. Stay strictly within the design document. Plan Session 7: Flutter guide view with attendance/completion marking and notes, meeting-point directions, live tour location sharing (backend + map), and push notifications via Firebase Cloud Messaging. Tell me what Firebase setup I need to do myself. Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

### Session 8: Payment gateway sandbox (REMOVED, do not run)

> **Status: removed.** Reason: payment gateway out of scope for this campus project; existing bank-slip flow kept as is. (Decision recorded during Session 3. The team also considered switching to in-person-only payments and decided against any new payment work: the existing payment code stays exactly as it is.) Note that the design document section 9 still lists a payment gateway sandbox, so this is a documented deviation from the document.

The original scope is kept below for reference only.

~~**Why:** doc §9 lists a payment gateway sandbox (e.g. Stripe test mode) for deposit and full payment. The current code uses bank-transfer slips and has deprecated card payments.~~

~~- **Decision first (ask the user):** add Stripe test mode alongside bank slips, or replace bank slips. The design document only requires the sandbox.~~
~~- Backend creates the payment session/intent, a webhook updates `Payment` status (DepositPaid / FullyPaid), refunds from Session 3 use the gateway in sandbox mode. Keys in environment variables; no card data stored (doc §8.4).~~
~~- Flutter and Ops screens show gateway payments alongside existing ones.~~

**Kickoff prompt:** none (session removed).

---

### Session 9: Testing plan from the design document

**Why:** doc §11.

- Backend: unit tests per service (e.g. budget-override threshold), controller/API integration and auth tests.
- Database: migration tests, constraint tests (cannot confirm a booking with an unresolved vehicle conflict), transaction rollback tests.
- React: approval queue (all three types), protected routes, API integration with mocked backend.
- Flutter: widget tests for the request form and itinerary viewer, navigation tests.
- **End-to-end:** the full §8.2 workflow from request to Confirmed (Playwright for web plus API).
- **Agent evaluation golden cases:** clean auto-confirm, large group requiring approval, budget override, injected fake "instruction" text in special requests (prompt-injection resistance), unmatchable request (safe failure).
- **Performance:** concurrent booking requests, API response times, agent workflow latency (k6).

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 9) and the design document section 11. Plan the test work so every item in section 11 is covered, reusing existing tests where they already cover an item. Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

### Session 10: ADRs, deployment and final polish

**Why:** doc §10, §12, §13 week 8–9.

- ADRs for every topic in doc §12 (some written in earlier sessions; complete the rest: agent orchestration method, workflow-state schema, cloud deployment platform).
- Deployment on a free tier: API + PostgreSQL, static React hosting, Flutter APK build. CORS for the deployed React origin.
- GitHub Actions: build and backend tests on every PR to main (doc §10).
- Final UI consistency and accessibility pass; README with screenshots of each role.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` (sections 1–3 and Session 10) and the design document sections 10, 12 and 13. Plan the remaining ADRs, free-tier deployment, CI on PRs to main, and the final polish and README. Do not run git commit: stage each step and give me a commit message. Wait for my approval before coding.

---

## 5. Progress log

Claude Code: append one entry per session.

| Session | Date | Status | Summary of what shipped | Follow-ups |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-05 | Complete | Design system and shell: semantic light/dark tokens and type scale; `ThemeProvider` (system/light/dark, no-flash script); `components/ui` library (Button, IconButton, fields, DatePicker, Card, Badge/StatusBadge, Avatar, Modal, Drawer, Tabs, DropdownMenu, Tooltip, DataTable, Skeleton, EmptyState, PageHeader/Breadcrumbs, StatCard, Toaster/notify); `AppShell` for all role layouts (lucide icons, sections, breadcrumbs, account menu, mobile drawer); guide and driver pages inside shells (`DriverLayout`, role-aware `/guides/availability`); lazy routes with skeleton fallbacks; 404 and `/no-access` pages; dev-only `/dev/ui` gallery. Completion pass: `RequireRole` now sends wrong-role users to `/no-access` (RequireRole plus 4 other role-guard tests updated); every page swept off raw `slate-*`/`bg-white`/soft status colours onto theme tokens (white-on-brand buttons moved to brand-700 for AA contrast); action banners replaced by toasts (errors persist until dismissed), while load failures with retry, field validation (including password confirmation) and in-modal errors stay inline with `role="alert"`; `noRawColors.test.ts` guards against regressions with a documented allowlist (modal scrims, hero indicator dot). Tests: 29 files, 206 passing. | Hand-rolled modals, buttons, inputs and tables are still not on `ui` primitives (Session 10 consistency sweep). Big files unsplit (`FleetManager.tsx` 1.3k lines: Session 5). `motion` installed but unused. No global `slate-*` dark fallback was added, so there is no temporary debt to remove. Dark mode and layouts were checked by tests, contrast math and build only, not by eye: do a manual dark-mode walkthrough per role. Possibly flaky under load: `GuideAvailabilityPage.test.tsx` failed once in a full run and passed on rerun. |
| 2 | 2026-10-05 | Complete | **Backend:** anonymous `GET /api/packages`, `/api/packages/{id}` and new `/api/packages/facets`; optional filters (`q`, `theme`, days, price, `classType`, food, AC, `guests`, `minRating`) and `sort`/`dir`, with the old natural order kept when `sort` is omitted so existing callers (mobile, traveler pages) are unchanged; `startingPrice` and per-location `latitude`/`longitude` added to the DTO; public `GET /api/reviews/featured`; `PublicReadLimiter` rate limit (generic 429 body); package locations geocoded on create/update (Sri Lanka only, throttled to 1 request/second, time-boxed, never blocks saving, no guessing), optional manual `locationCoordinates` that geocoding never overwrites (no migration needed), and a batched `POST /api/packages/geocode-missing` backfill. **Web:** public layout; `/explore` with URL-synced filters, grid/list view and facets; `/explore/:packageId` with class comparison, lazy Leaflet/OpenStreetMap map, reviews with rating breakdown, current offers and a booking card; booking intent survives sign-up and login (`ProtectedRoute` passes `from`, `returnTo` sanitising helper plus sessionStorage backup, booking form prefills `tier`, `guests`, `start`); traveler-first home page (hero search, top-rated carousel, why/how sections incl. the smart booking check, real testimonials); redesigned login/register on react-hook-form + zod with show/hide password, strength meter and inline validation; contact details in one file (`src/config/contact.ts`); package forms show a 'Not on map' note and keep coordinates on edit. **Quality:** flaky `GuideAvailabilityPage` test fixed (pinned `Date`, awaited outcomes, 5s async timeout; 20 looped runs and 5 full runs green); fixed a Session 1 bug where `Input`/`Select`/`Textarea` labels did not follow a custom `id`. Lighthouse on the production build against a stub API with realistic data: home page mobile 92 performance / 100 accessibility, desktop 100 / 100 (with the API unreachable, mobile performance was 88). Web: 39 test files, 311 passing. Backend: 616 tests, 612 passing. | **Needs doing:** (1) Rebuild the Docker backend image (`docker compose up --build backend`): the running container is the old build, so anonymous browsing and the new endpoints do not exist there yet. (2) Run the geocode backfill once on real data (POST `/api/packages/geocode-missing`, repeat with `skip=nextSkip` until `remaining` is 0). (3) Replace the placeholder footer contact details in `src/config/contact.ts`. (4) Add the web origin to `Cors:AllowedOrigins` in deployment and configure forwarded headers if the API sits behind a proxy (the public rate limiter keys on client IP). **Follow-ups:** TODO add one more Sri Lankan hero photo (the Lisbon photo was removed, so the slideshow has 3 slides). 4 backend tests fail on the untouched baseline too (`BookingsSortingTests.GetMine_WithSortByStatus_SortsCorrectly`, `FleetEndpointsTests.VehicleAvailability_ChecksMaintenanceAndOverlap` and `GetAssignmentByBookingId_TravelerCanRetrieveTheirAssignment`, `BookingLifecycleEndpointsTests.Decide_Approve_FromNeedsManualReview_WithoutAssignedGuide...`): they depend on test order or shared seeded data and need their own fix. The home page is bundled eagerly and its entrance uses CSS keyframes instead of `motion` (kept off the critical path for the performance target), so `motion` is still unused. Hero images are WebP at two widths (`sharp-cli` via npx, not a dependency). Map editing for locations is deferred to Session 6; map tiles load from public OpenStreetMap servers (fine for launch traffic, revisit with a tile provider if usage grows). Prices on the public pages use `$` to match the existing portals; confirm the intended currency. |
| 3 | 2026-10-05 | In progress | Decision recorded: in-person-only payments were considered and rejected by the team; no new payment work in this project and the existing payment code (bank slips, deadlines, expiry job, Ops verification, Flutter pay screen) is kept exactly as is. Session 8 (payment gateway) removed: payment gateway out of scope for this campus project; existing bank-slip flow kept as is. Steps done so far: baseline test fixes, guide auto-assign rules on approval, guide release and cancellation reason on cancel, approvals queue API (`ApprovalRequest`, pending list with evidence, decide), Drivers model/migration alignment, driver-assignments privacy fix. The final summary is added when the session is complete. | Cancellation / refund exception, workflow monitor and dashboard endpoints, React approval queue, workflow monitor and Ops dashboard, state management ADR. |
| 4 | | Not started | | |
| 5 | | Not started | | |
| 6 | | Not started | | |
| 7 | | Not started | | |
| 8 | | Not started | | |
| 9 | | Not started | | |
| 10 | | Not started | | |
