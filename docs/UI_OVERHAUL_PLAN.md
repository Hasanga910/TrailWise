# TrailWise UI Overhaul: Session Plan for Claude Code

> **How to use this file.** This plan is split into 10 sessions. Run **one session per Claude Code conversation**, in order.
> At the start of each session, paste the session's **Kickoff prompt** (at the end of each session). Claude Code should:
> 1. Read this whole file and the "Global rules" section.
> 2. Explore the files listed for that session.
> 3. Produce a written plan (plan mode) and wait for approval before editing code.
> 4. Implement, run the checks in "Definition of done", and finish by updating the **Progress log** at the bottom of this file.
>
> Every session must deliver **new functionality**, not just restyled screens. Each session lists both.

---

## 1. Current state (snapshot, read from the code)

| Area | What exists today |
| --- | --- |
| Web stack | React 19, TypeScript, Vite 8, React Router 7, Tailwind CSS v4 (`@theme` tokens in `frontend-web/src/index.css`), axios. Fonts: Inter (body), Plus Jakarta Sans (headings). |
| Web brand tokens | `brand-50…950` teal (#1cad95 at 500), `accent-400…700` amber (#f5a524 at 500). Mostly `slate-*` utilities used directly in pages. |
| Web components | No shared component library. Buttons, inputs, modals, badges and tables are re-written inline in each page. Hand-made SVG icons in `components/admin/icons.tsx`. Per-role layouts (`TravelerLayout`, `OpsLayout`, `FleetLayout`, `GuideLayout`, `AdminLayout`) built on `components/layout/SidebarLayout.tsx`. |
| Web pages | ~19k lines. Largest: `FleetManager.tsx` (1.3k), `OpsPaymentsPage.tsx` (870), `PackagesOverviewPage.tsx` (750), `PackageManager.tsx` (750). Home page has `HeroSlideshow`, `FeatureHighlights`, `AboutSection` with 4 hero photos in `assets/hero/`. |
| Web gaps | No dark mode, no toasts, no skeleton loaders, no charts library, no icon library, no command palette. **Travelers cannot pay, see payment status or leave reviews on web** (mobile only). Package browsing requires login. |
| Mobile stack | Flutter, Material 3 with `ColorScheme.fromSeed(seedColor: Colors.teal)` and default typography. Packages: `http`, `provider`, `flutter_secure_storage`, `file_picker`, `url_launcher`. Role-based bottom nav in `navigation/main_shell.dart` (Traveler / Guide / Driver). |
| Backend hooks already available | Reports: `/api/reports/occupancy`, `/revenue`, `/guide-utilization`, `/audit`, `/audit/export`. Public reviews: `GET /api/packages/{id}/reviews` (anonymous). Location search: `/api/locations/search` (Nominatim). Active discounts: `/api/discounts/active`. Itinerary steps with day, time, activity and location. |
| Unused backend capability | `BookingAddOn` entity exists and the pricing agent already adds add-on costs to the total, but **no API or UI creates add-ons**. |
| CI | Web: `npm ci`, `npm run lint`, `npm test`, `npm run build`. Mobile: `flutter analyze`, `flutter test`. Backend: `dotnet build`, `dotnet test`. 22 web test files, 19 mobile test files. |

---

## 2. Design direction

**Concept: "Calm, premium Sri Lankan travel."** Think a modern travel brand (Airbnb, GetYourGuide, Linear-quality admin) rather than a generic dashboard template.

- **Colour.** Keep the existing teal `brand` as primary and amber `accent` for highlights and calls to action. Add semantic tokens (`success`, `warning`, `danger`, `info`) and surface tokens (`surface`, `surface-raised`, `surface-sunken`, `border`, `text`, `text-muted`) so dark mode is a token swap, not a rewrite. Stop using raw `slate-*` in pages; use tokens.
- **Typography.** Plus Jakarta Sans for display and headings (tight tracking, bold), Inter for UI and body. Define a type scale (display, h1–h4, body-lg, body, caption, overline) as Tailwind utilities.
- **Shape and depth.** Rounded corners (12px cards, 10px inputs, full pills for status), soft layered shadows, 1px hairline borders. Glassmorphism only on the public hero.
- **Imagery.** Large, edge-to-edge travel photos on public and traveler screens; dense, information-first layouts on staff consoles.
- **Motion.** Subtle and fast (150–250ms): page fade/slide, card hover lift, skeleton shimmer, number count-up on KPIs. Respect `prefers-reduced-motion`.
- **Status language.** One consistent colour and icon per booking status, used on web and mobile:

| Status | Colour | Icon idea |
| --- | --- | --- |
| Requested | info (blue) | clock |
| PlanProposed | info | sparkles |
| PendingApproval | warning (amber) | hourglass |
| NeedsManualReview | danger-soft (orange) | alert-triangle |
| Confirmed | brand (teal) | check-circle |
| Completed | success (green) | flag |
| Cancelled | neutral (grey) | x-circle |

---

## 3. Global rules (apply to every session)

1. **Do not break behaviour.** Keep every API contract, route path, role guard and business rule. UI changes must not change what the backend receives unless the session says so.
2. **Keep CI green.** Run `npm run lint`, `npm test`, `npm run build` (web), `flutter analyze`, `flutter test` (mobile), `dotnet build` and `dotnet test` (backend, when touched). Update existing tests when markup changes; add tests for new features.
3. **Reuse the design system** built in Session 1 for everything afterwards. No new one-off buttons, modals or badges in pages.
4. **Accessibility:** WCAG 2.1 AA contrast in light and dark, visible focus rings, labelled inputs, keyboard-operable dialogs and menus, `aria-live` for toasts.
5. **Responsive:** every web screen works from 360px to 1440px+. Staff consoles collapse the sidebar into a drawer on small screens.
6. **Dependencies:** prefer small, well-maintained libraries. Pre-approved for web: `lucide-react` (icons), `motion` (animation), `recharts` (charts), `@tanstack/react-table` (tables), `react-hook-form` + `zod` (forms), `sonner` (toasts), `cmdk` (command palette), `react-leaflet` + `leaflet` (maps, OpenStreetMap tiles), `date-fns`, `react-day-picker`, `react-dropzone`, `@react-pdf/renderer` (PDFs). Pre-approved for mobile: `google_fonts`, `cached_network_image`, `shimmer`, `flutter_map` + `latlong2`, `shared_preferences`, `flutter_local_notifications`, `intl`. Anything else: ask first.
7. **Backend changes** (when a session needs them): new EF Core migration, new endpoints with role guards, xUnit tests, Swagger visible. Follow the existing Controller → Service → DbContext pattern in `backend/src`.
8. **Split big files.** When touching a file over ~500 lines, break it into smaller components as part of the work.
9. **Small commits** per feature with clear messages. Do not push.

---

## 4. Sessions

### Session 1: Web design system and app shell

**Goal:** a reusable foundation every later session builds on, plus three cross-app features.

**Explore first:** `frontend-web/src/index.css`, `components/layout/SidebarLayout.tsx`, all `*Layout.tsx`, `components/admin/icons.tsx`, `components/Avatar.tsx`, `components/Logo.tsx`, a few large pages to catalogue repeated patterns.

**Build (design system, in `src/components/ui/`):**
- Tokens: semantic colours, surfaces, radii, shadows, type scale, light and dark values in `index.css`.
- Components: `Button` (primary, secondary, ghost, danger, sizes, loading), `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `DatePicker`, `Card`, `StatusBadge` (driven by the status table above), `Badge`, `Avatar`, `Modal`, `Drawer`, `Tabs`, `DropdownMenu`, `Tooltip`, `DataTable` (sorting, pagination, empty state), `Skeleton`, `EmptyState` (illustration + action), `PageHeader` (title, breadcrumbs, actions), `StatCard`.
- Replace hand-made icons with `lucide-react`.
- New `AppShell`: collapsible sidebar with icons and section groups, top bar with breadcrumbs, user menu, mobile drawer. All role layouts use it.

**New features:**
- Dark mode with a toggle in the user menu (system / light / dark, remembered per browser).
- Global toast notifications (`sonner`) replacing inline success and error banners.
- Route-level loading skeletons and a friendly 404 / "no access" page (replace `PortalFallbackPage`).
- A `/dev/ui` gallery route (development only) showing every component in both themes.

**Definition of done:** all role portals render inside the new shell; dark mode works on every existing page without unreadable text; CI green; gallery route shows all components.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md`, sections 1–3 and Session 1. Explore the listed files, then plan Session 1 (design system, app shell, dark mode, toasts, skeletons, 404 page, UI gallery). Wait for my approval before coding.

---

### Session 2: Public website, package explorer and authentication

**Goal:** a landing experience that sells tours and lets visitors explore before signing up.

**Redesign:** `HomePage` and `components/home/*`, `LoginPage`, `RegisterPage`, `AuthBrandPanel`.

**New features:**
- **Public package explorer** (`/explore`): search, filter by theme, duration, price range and class; sort by price, duration or rating; grid and list toggle.
- **Package detail page** (`/explore/:packageId`): photo hero, tier comparison table (class, food, AC, price), locations shown on an interactive map (Leaflet + OpenStreetMap), average rating and public reviews (existing anonymous endpoint), "Book this tour" button that sends unauthenticated visitors to register and returns them to the booking form afterwards.
- Home page: animated hero search bar ("Where to? When? How many?") that deep-links into the explorer, featured packages carousel, "why TrailWise" section, testimonials pulled from real reviews, footer with contact details.
- Register: password strength meter, show/hide password, inline validation.

**Backend changes:** allow anonymous `GET /api/packages` and `GET /api/packages/{id}` (keep write endpoints guarded); add optional query params for search, theme, price range and sort; include average rating and review count in the package DTO. Add tests.

**Definition of done:** a logged-out visitor can browse, filter and open any package and see its map and reviews; booking intent survives the register/login round trip; Lighthouse performance and accessibility ≥ 90 on the home page.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 2 (Session 1 is complete). Plan the public site, package explorer, package detail with map and reviews, auth redesign, and the backend changes for anonymous package browsing. Wait for approval.

---

### Session 3: Traveler portal (web)

**Goal:** give travelers on web everything they have on mobile, plus a richer booking experience.

**Redesign:** `TravelerDashboardPage`, `PackagesBrowsePage` (reuse explorer components), `BookingRequestPage`, `MyBookingsPage`, `TravelerProfileSettingsPage`.

**New features:**
- **Multi-step booking wizard:** 1) tier, 2) dates with a calendar and group size, 3) add-ons and preferences, 4) review with a **live price breakdown** (tier × people, catering, add-ons, discount, total) before submitting.
- **Add-ons:** travelers pick optional extras (for example airport pickup, extra night, photography) that feed the existing `BookingAddOn` pricing.
- **Booking detail page** (`/traveler/bookings/:id`) with a **status timeline** (Requested → check → Confirmed → advance paid → tour → completed → paid → reviewed), guide card, vehicle and driver card, itinerary map, and next-action banner.
- **Web payments:** bank details card, drag-and-drop slip upload with preview, amount helper (minimum 50%, remaining balance), live countdown to the payment deadline, payment history with rejection reasons.
- **Web reviews:** star rating and comment once the booking is completed and fully paid.
- **Wishlist:** heart button on packages; "Saved tours" page.
- Dashboard: upcoming trip hero with countdown, quick actions, recent bookings, saved tours.

**Backend changes:**
- `POST /api/bookings/quote` that runs the same pricing logic as the coordinator without saving, for the live breakdown.
- Add-on catalogue (`AddOnOption` entity with name, description, price, per-person flag; CRUD for Ops/Admin) and accept selected add-ons in `CreateBookingRequest`.
- `Favorite` entity and `GET/POST/DELETE /api/favorites`.
- Tests for each.

**Definition of done:** a traveler can complete the whole journey on web (book, pay advance, see confirmation, pay balance, review) with no mobile app; quote equals the final total the coordinator calculates.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 3 (Sessions 1–2 complete). Plan the traveler portal: booking wizard with live quote, add-ons, booking detail timeline, web payments, web reviews, wishlist, and their backend endpoints. Wait for approval.

---

### Session 4: Operations Manager console

**Goal:** a command centre that makes the daily ops workload obvious at a glance.

**Redesign:** `OpsDashboardPage`, `OpsBookingsPage`, `AgentWorkflowPage`, `OpsPaymentsPage` (split into smaller components), `OpsPackagesPage`, `OpsDiscountsPage`, `OpsReportsPage`, `OpsSupportPage`, `OpsTicketDetailPage`.

**New features:**
- **Dashboard with live KPIs and charts** (`recharts`): bookings by status, revenue over time, occupancy, guide utilisation (existing report endpoints), plus "needs attention" queues: pending approvals, manual reviews, slips awaiting verification, payment deadlines expiring within the hour, open urgent tickets.
- **Bookings data table:** search, filters (status, date range, package, large group), saved filter presets, column chooser, CSV export, row click opens a **booking detail drawer** with approve, reject, cancel, complete and itinerary actions.
- **Bookings calendar view:** month and week view of tours by start date, coloured by status.
- **Agent workflow visualiser:** the six steps as a vertical stepper with timing, inputs and outputs per step, decision reasons highlighted, LLM summary card.
- **Payment review split view:** queue on the left, slip viewer with zoom and rotate on the right, approve or reject with keyboard shortcuts.
- **Add-on catalogue manager** (uses Session 3 backend).
- Support inbox: conversation-style thread, status and priority chips, canned replies.

**Backend changes:** a dashboard summary endpoint (`GET /api/reports/dashboard`) returning the counts for the attention queues in one call; optional server-side filters on the bookings list if not already supported.

**Definition of done:** an Ops Manager can clear every queue from the dashboard without opening more than two screens; charts render in light and dark.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 4 (Sessions 1–3 complete). Plan the Ops console: KPI dashboard with charts and attention queues, bookings table plus drawer and calendar, workflow visualiser, payment split view, add-on manager, support inbox, and the dashboard summary endpoint. Wait for approval.

---

### Session 5: Fleet Coordinator console

**Goal:** make vehicle, driver and guide allocation visual and conflict-proof.

**Redesign:** `FleetOverviewPage`, `FleetVehiclesPage`, `FleetDriversPage`, `FleetGuideAssignmentsPage`, `components/fleet/FleetManager.tsx` (break the 1.3k-line file into components).

**New features:**
- **Allocation board:** kanban columns (Requested, Pending, Needs Review, Confirmed) with booking cards; selecting a card opens the allocation panel with the AI-suggested guide, vehicle and driver and alternatives ranked by fit.
- **Fleet schedule timeline (Gantt):** one row per vehicle and per driver, bars for assignments across the next 30 days, maintenance periods shaded, clashes highlighted in red.
- **Guide availability heatmap:** guides × days grid showing available, unavailable and assigned.
- **Vehicle cards** with photo placeholder, capacity, AC, maintenance status toggle and upcoming trips; **driver cards** with licence, contact and workload this month.
- Fleet KPIs: utilisation % per vehicle, idle vehicles this week, upcoming maintenance.

**Backend changes:** an endpoint returning vehicle and driver assignments for a date range in one call (for the timeline), if the existing ones require too many requests.

**Definition of done:** a coordinator can spot and resolve a double-booking from the timeline; the allocation board updates without a full page reload after an action.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 5 (Sessions 1–4 complete). Plan the Fleet console: allocation kanban, schedule Gantt, guide heatmap, vehicle and driver cards, fleet KPIs, splitting FleetManager.tsx. Wait for approval.

---

### Session 6: Tour Guide and Driver portals (web)

**Goal:** focused, task-first portals for people in the field.

**Redesign:** `GuideDashboardPage`, `AssignedToursPage`, `TourDetailPage`, `GuideAvailabilityPage`, `GuideProfilePage`, `DriverDashboardPage`, `DriverProfileSettingsPage`, `components/itinerary/*`.

**New features:**
- **"Today" view** for guides and drivers: current or next trip, meeting time and place, traveler contact buttons (call, WhatsApp, email), itinerary for the day.
- **Itinerary builder:** drag-to-reorder steps, day tabs, location autocomplete (existing `/api/locations/search`), map with numbered stops and route line.
- **Availability calendar:** click-and-drag to mark ranges, month view with assigned tours shown, bulk "unavailable on weekends" option.
- **Printable trip sheet / PDF** for a booking: traveler details, group size, special requests, itinerary, vehicle, driver, emergency contacts.
- Guide public profile card (photo, languages, specialisations, rating from reviews) reused on the traveler booking detail.

**Backend changes:** store latitude and longitude on itinerary steps when chosen from location search (new nullable columns plus migration) so maps do not geocode every time.

**Definition of done:** a guide can plan a multi-day itinerary on a map and print the trip sheet; a driver sees today's job in one glance on a phone-width screen.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 6 (Sessions 1–5 complete). Plan the guide and driver web portals: Today view, drag-and-drop itinerary builder with map, range-select availability calendar, PDF trip sheet, guide profile card, and the itinerary lat/long migration. Wait for approval.

---

### Session 7: Admin console, notifications and global search

**Goal:** platform-wide features that make the system feel like a real product.

**Redesign:** `AdminOverviewPage`, `UserManagementIndexPage`, `StaffRolePage`, `PackagesOverviewPage`, `PackageManagementPage`, `AdminProfileSettingsPage`.

**New features:**
- **In-app notification centre** for every role: bell icon with unread count, dropdown and full page; notifications for booking status changes, payment approved or rejected, guide assigned, new support reply, deadline reminders. Mark as read, mark all read.
- **Global command palette** (Ctrl/Cmd + K): jump to any page, search bookings by ID or traveler name, packages, staff and tickets (results filtered by role).
- **User management:** one searchable, filterable table of all users across roles, create-staff modal, role badges, deactivate instead of delete.
- **Audit log explorer:** filter by entity, action, user and date; expandable JSON details; export (existing endpoints).
- **Admin overview:** system health (API up, database reachable, LLM enabled, SMS configured), user counts by role, bookings this month, recent audit events.
- **Package management:** photo gallery (multiple images, reorder, set cover) instead of a single photo.

**Backend changes:** `Notification` entity, a service that creates notifications at the points where SMS or audit logs are already written, `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`; a search endpoint for the palette; `IsActive` flag on users (login blocked when false); `PackagePhoto` entity for galleries; a health endpoint. Tests for each.

**Definition of done:** approving a payment as Ops makes a notification appear for the traveler within a refresh; Ctrl+K finds a booking by partial traveler name; deactivated users cannot log in.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 7 (Sessions 1–6 complete). Plan the Admin console, notification centre (backend + UI), command palette, user management with deactivate, audit explorer, system health, package photo gallery. Wait for approval.

---

### Session 8: Mobile app design system and traveler experience

**Goal:** bring the Flutter app to the same visual standard and feature level as the web traveler portal.

**Explore first:** `frontend-mobile/lib/main.dart`, `navigation/main_shell.dart`, `home/`, `packages/`, `bookings/`, `support/`, `auth/`.

**Build:** a `lib/theme/` folder with a custom Material 3 theme matching web tokens (brand teal, amber accent, semantic colours), Plus Jakarta Sans and Inter via `google_fonts`, light and dark themes, shared widgets (`AppButton`, `StatusChip`, `TourCard`, `SectionHeader`, `EmptyState`, `SkeletonList`, `PriceBreakdown`).

**New features:**
- First-launch onboarding carousel (3 slides) and a redesigned login and register.
- Home: greeting, upcoming trip card with countdown, featured packages carousel, saved tours.
- Package detail with a collapsing photo header, tier selector, map of locations (`flutter_map`), reviews.
- Booking wizard matching web (live quote, add-ons) and booking detail with the status timeline.
- Payment screen redesign: step-by-step instructions, slip picker with preview, countdown ring.
- **Local notification reminders** for the advance-payment and balance deadlines (`flutter_local_notifications`).
- Wishlist synced with the Session 3 favourites endpoint.
- Pull-to-refresh and skeletons everywhere; dark mode following the system.

**Definition of done:** every traveler screen uses the new theme and widgets; payment reminders fire on a device; `flutter analyze` and `flutter test` pass.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 8 (Sessions 1–7 complete). Plan the Flutter theme and widget library and the traveler experience: onboarding, home, package detail with map, booking wizard, payment redesign, deadline reminders, wishlist, dark mode. Wait for approval.

---

### Session 9: Mobile app for guides and drivers

**Goal:** a reliable field tool that works with one hand and a weak signal.

**Redesign:** `guides/*`, `drivers/*`, `bookings/itinerary_screen.dart`, `bookings/transport_info_card.dart`, `bookings/guide_info_card.dart`.

**New features:**
- **Tour-day mode:** a full-screen view for the active tour with big Start tour and End tour buttons (confirmation slide-to-act), elapsed time, current itinerary step highlighted, next step countdown.
- **Itinerary timeline with map** and "Open in Google Maps" for each stop.
- **One-tap contact** for traveler, guide, driver and office (call, SMS, WhatsApp) via `url_launcher`.
- **Offline cache** of assigned tours and itineraries (`shared_preferences`) with a "last synced" label and automatic refresh when back online.
- **Driver checklist** before departure (vehicle checked, fuel, documents) stored locally per trip.
- Guide notes with quick templates and a character counter.

**Definition of done:** guide can open today's tour and its itinerary in airplane mode after one online sync; start and end tour still enforce the existing payment rule.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 9 (Sessions 1–8 complete). Plan the guide and driver mobile experience: tour-day mode, itinerary timeline with maps, one-tap contact, offline cache, driver checklist, notes templates. Wait for approval.

---

### Session 10: Polish, performance and quality pass

**Goal:** make the whole product feel finished and prove it works.

**Work:**
- Consistency sweep: every screen uses design-system components and tokens; no leftover raw `slate-*` styling or inline one-off components.
- Accessibility audit (axe in tests, keyboard-only walkthrough, screen reader labels), fixing all serious issues.
- Performance: lazy-load each role portal's routes, code-split charts and maps, compress and responsive-size hero images (WebP/AVIF), target Lighthouse ≥ 90 on home, explorer and traveler dashboard.
- **End-to-end smoke tests** with Playwright covering: register traveler → book → ops approve → upload slip → approve payment → complete → review.
- Micro-interactions: success animations on booking submitted and payment approved, confetti on first completed trip (respecting reduced motion).
- Update `README.md` with screenshots of each portal (light and dark) and a short "Design system" section.

**Definition of done:** all CI jobs green, Playwright smoke passes against `docker compose up`, README updated.

**Kickoff prompt:**
> Read `docs/UI_OVERHAUL_PLAN.md` sections 1–3 and Session 10 (Sessions 1–9 complete). Plan the final polish: consistency sweep, accessibility audit, performance and code splitting, Playwright end-to-end smoke tests, micro-interactions, README screenshots. Wait for approval.

---

## 5. New features at a glance

| Session | New features added to the system | Backend work |
| --- | --- | --- |
| 1 | Dark mode, toasts, skeletons, 404/no-access page, UI gallery | None |
| 2 | Public package explorer, package detail with map and reviews, hero search, booking intent across sign-up | Anonymous package reads, search/sort params, rating in DTO |
| 3 | Booking wizard with live quote, add-ons, booking timeline, web payments, web reviews, wishlist | Quote endpoint, add-on catalogue, favourites |
| 4 | KPI dashboard and attention queues, bookings table/drawer/calendar, workflow visualiser, payment split view, add-on manager | Dashboard summary endpoint |
| 5 | Allocation kanban, fleet Gantt, guide heatmap, fleet KPIs | Assignments-by-range endpoint (if needed) |
| 6 | Today view, map itinerary builder, range availability, PDF trip sheet | Itinerary lat/long |
| 7 | Notification centre, command palette, user deactivation, audit explorer, system health, photo gallery | Notifications, search, IsActive, PackagePhoto, health |
| 8 | Mobile theme, onboarding, mobile wizard, deadline reminders, wishlist sync | None (reuses 3) |
| 9 | Tour-day mode, offline cache, one-tap contact, driver checklist | None |
| 10 | E2E tests, accessibility and performance, micro-interactions | None |

---

## 6. Progress log

Claude Code: append one entry at the end of each session.

| Session | Date | Status | Summary of what shipped | Follow-ups |
| --- | --- | --- | --- | --- |
| 1 | 2026-10-05 | Complete | Design system and shell: semantic light/dark tokens and type scale; `ThemeProvider` (system/light/dark, no-flash script); `components/ui` library (Button, IconButton, fields, DatePicker, Card, Badge/StatusBadge, Avatar, Modal, Drawer, Tabs, DropdownMenu, Tooltip, DataTable, Skeleton, EmptyState, PageHeader/Breadcrumbs, StatCard, Toaster/notify); `AppShell` for all role layouts (lucide icons, sections, breadcrumbs, account menu, mobile drawer); guide and driver pages inside shells (`DriverLayout`, role-aware `/guides/availability`); lazy routes with skeleton fallbacks; 404 and `/no-access` pages; dev-only `/dev/ui` gallery. Completion pass: `RequireRole` now sends wrong-role users to `/no-access` (RequireRole plus 4 other role-guard tests updated); every page swept off raw `slate-*`/`bg-white`/soft status colours onto theme tokens (white-on-brand buttons moved to brand-700 for AA contrast); action banners replaced by toasts (errors persist until dismissed), while load failures with retry, field validation (including password confirmation) and in-modal errors stay inline with `role="alert"`; `noRawColors.test.ts` guards against regressions with a documented allowlist (modal scrims, hero indicator dot). Tests: 29 files, 206 passing. | Hand-rolled modals, buttons, inputs and tables are still not on `ui` primitives (Session 10 consistency sweep). Big files unsplit (`FleetManager.tsx` 1.3k lines: Session 5). `motion` installed but unused. No global `slate-*` dark fallback was added, so there is no temporary debt to remove. Dark mode and layouts were checked by tests, contrast math and build only, not by eye: do a manual dark-mode walkthrough per role. Possibly flaky under load: `GuideAvailabilityPage.test.tsx` failed once in a full run and passed on rerun. |
| 2 | 2026-10-05 | Complete | **Backend:** anonymous `GET /api/packages`, `/api/packages/{id}` and new `/api/packages/facets`; optional filters (`q`, `theme`, days, price, `classType`, food, AC, `guests`, `minRating`) and `sort`/`dir`, with the old natural order kept when `sort` is omitted so existing callers (mobile, traveler pages) are unchanged; `startingPrice` and per-location `latitude`/`longitude` added to the DTO; public `GET /api/reviews/featured`; `PublicReadLimiter` rate limit (generic 429 body); package locations geocoded on create/update (Sri Lanka only, throttled to 1 request/second, time-boxed, never blocks saving, no guessing), optional manual `locationCoordinates` that geocoding never overwrites (no migration needed), and a batched `POST /api/packages/geocode-missing` backfill. **Web:** public layout; `/explore` with URL-synced filters, grid/list view and facets; `/explore/:packageId` with class comparison, lazy Leaflet/OpenStreetMap map, reviews with rating breakdown, current offers and a booking card; booking intent survives sign-up and login (`ProtectedRoute` passes `from`, `returnTo` sanitising helper plus sessionStorage backup, booking form prefills `tier`, `guests`, `start`); traveler-first home page (hero search, top-rated carousel, why/how sections incl. the smart booking check, real testimonials); redesigned login/register on react-hook-form + zod with show/hide password, strength meter and inline validation; contact details in one file (`src/config/contact.ts`); package forms show a 'Not on map' note and keep coordinates on edit. **Quality:** flaky `GuideAvailabilityPage` test fixed (pinned `Date`, awaited outcomes, 5s async timeout; 20 looped runs and 5 full runs green); fixed a Session 1 bug where `Input`/`Select`/`Textarea` labels did not follow a custom `id`. Lighthouse on the production build against a stub API with realistic data: home page mobile 92 performance / 100 accessibility, desktop 100 / 100 (with the API unreachable, mobile performance was 88). Web: 39 test files, 311 passing. Backend: 616 tests, 612 passing. | **Needs doing:** (1) Rebuild the Docker backend image (`docker compose up --build backend`): the running container is the old build, so anonymous browsing and the new endpoints do not exist there yet. (2) Run the geocode backfill once on real data (POST `/api/packages/geocode-missing`, repeat with `skip=nextSkip` until `remaining` is 0). (3) Replace the placeholder footer contact details in `src/config/contact.ts`. (4) Add the web origin to `Cors:AllowedOrigins` in deployment and configure forwarded headers if the API sits behind a proxy (the public rate limiter keys on client IP). **Follow-ups:** TODO add one more Sri Lankan hero photo (the Lisbon photo was removed, so the slideshow has 3 slides). 4 backend tests fail on the untouched baseline too (`BookingsSortingTests.GetMine_WithSortByStatus_SortsCorrectly`, `FleetEndpointsTests.VehicleAvailability_ChecksMaintenanceAndOverlap` and `GetAssignmentByBookingId_TravelerCanRetrieveTheirAssignment`, `BookingLifecycleEndpointsTests.Decide_Approve_FromNeedsManualReview_WithoutAssignedGuide...`): they depend on test order or shared seeded data and need their own fix. The home page is bundled eagerly and its entrance uses CSS keyframes instead of `motion` (kept off the critical path for the performance target), so `motion` is still unused. Hero images are WebP at two widths (`sharp-cli` via npx, not a dependency). Map editing for locations is deferred to Session 6; map tiles load from public OpenStreetMap servers (fine for launch traffic, revisit with a tile provider if usage grows). Prices on the public pages use `$` to match the existing portals; confirm the intended currency. |
| 3 | | Not started | | |
| 4 | | Not started | | |
| 5 | | Not started | | |
| 6 | | Not started | | |
| 7 | | Not started | | |
| 8 | | Not started | | |
| 9 | | Not started | | |
| 10 | | Not started | | |
