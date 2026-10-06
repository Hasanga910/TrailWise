# ADR 0002: React state management (Zustand)

## Status
Accepted

## Context
Design document section 6 asks for "React Context + hooks for auth/session, and either Redux Toolkit or Zustand for booking/approval state", with the decision justified in an ADR. Section 12 lists this ADR as required.

Today the web app is plain React 19: components load data with `useState` + `useEffect` and a typed axios client (`src/api/*`); auth is a React Context (`src/auth`), theme is a Context. There is no cache layer and no state library.

The state that now has to be shared across screens (Session 3) is small and specific:
- the **approval queue** and its per-type counts, read by the approvals page, the Ops navigation badge and the dashboard, and changed by approve / reject / request-revision;
- the **agent workflow monitor**: a filtered, paged run list that is polled while runs are moving, plus the open run for the drill-down.

Both need: a single source of truth outside the component tree, actions that call the API and update state, optimistic-free updates driven by the server (counts must not drift), and easy tests without rendering providers.

## Decision
Use **Zustand** for booking/approval state. One store per domain (`src/stores/approvalsStore.ts`, `src/stores/workflowStore.ts`), each holding data, `loading`/`error` flags and the actions that call `src/api/*`. Keep **React Context for auth/session and theme**, as the design document specifies.

Rules that follow from this decision:
- API access stays in `src/api/*`; stores call it, components call store actions or selectors.
- Selectors are used for derived values (for example `selectPendingTotal` for the nav badge) so components re-render only when what they read changes.
- Server state is the source of truth: after a decision the store refetches counts instead of adjusting them locally.
- Polling lives in a hook (`useWorkflowPolling`) that refreshes only while a run is active and the tab is visible, and stops on unmount.
- Every store has a `reset()` so tests (and logout) start clean.

### Why not Redux Toolkit
- Redux Toolkit earns its cost with large teams, many slices that interact, normalised entity caches, middleware, or RTK Query. We have two small stores and an existing axios client; RTK Query would replace that client for little gain.
- It needs a `<Provider>`, slices, reducers and thunks (or listener middleware) for what is here a handful of async actions: roughly three times the code for the same behaviour.
- Its main extra benefit, strict structure and time-travel devtools, is not needed at this size.

### Why not keep `useState` + props or Context only
- The approval counts are needed in three unrelated places (navigation, queue, dashboard); lifting state or a Context would re-render the whole tree on each change and would still need hand-written loading/error handling per consumer.

## Consequences
- **Small and testable**: about 1 kB, no provider, stores are tested directly with mocked API modules and `reset()`.
- **Less enforced structure** than Redux Toolkit: conventions above (one store per domain, API in `src/api`, `reset()`) are by agreement, not by the library. Reviewers should hold to them.
- **No built-in request cache or deduplication**: the stores handle loading, errors, stale-response guards and polling explicitly. If the number of server-state screens grows a lot, revisit TanStack Query or RTK Query for server state.
- **Consistent with the mobile decision**: the Flutter ADR (Provider vs Riverpod, doc section 12) makes the same trade-off of light, explicit state over a heavier framework.
