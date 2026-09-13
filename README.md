# TrailWise

Smart Tour Management & Travel Planning System — Person 1 slice (Tour Package & Booking
Management + Coordinator/Planning Agent) and the shared project foundation (DB schema, auth,
API skeleton, web + mobile shells).

## Stack

- **Backend**: ASP.NET Core 8 Web API, EF Core, Npgsql (`backend/`)
- **Database**: PostgreSQL (local via Docker, or a Supabase cloud project)
- **Web**: React + TypeScript + Vite (`frontend-web/`)
- **Mobile**: Flutter (`frontend-mobile/`)

## Prerequisites

- Docker + Docker Compose
- .NET 8 SDK (for running migrations/tests outside Docker)
- Node 20+ (for the React app outside Docker)
- Flutter SDK (mobile app is run natively, not in Docker)

## Running everything with Docker

```bash
cp .env.example .env   # already done for local dev; edit values as needed
docker compose up --build
```

This starts:

- `db` — Postgres on `localhost:${POSTGRES_PORT}` (default 5432)
- `backend` — ASP.NET Core API on `http://localhost:${BACKEND_PORT}` (default 5080), applying EF
  Core migrations and seeding an Admin user + a sample tour package on first boot
- `frontend-web` — React dev server on `http://localhost:${FRONTEND_WEB_PORT}` (default 5173).
  The container runs what was baked into the image at build time (no live-reload volume mount);
  after editing React code, re-run `docker compose up --build frontend-web`, or just run
  `npm run dev` locally against the composed `backend`/`db` for an active frontend dev loop.

Swagger UI: `http://localhost:5080/swagger` (Development environment only).

The seeded Admin account (`ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` in `.env`) is the only way to
create TourGuide / OperationsManager / FleetCoordinator / Admin accounts — via
`POST /api/auth/admin/users`. Travelers self-register through `POST /api/auth/register` or the
React/Flutter register screens.

## Running the Flutter app

Flutter isn't containerized — run it natively against the backend started above:

```bash
cd frontend-mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:5080
```

## Switching the database to Supabase

Replace `CONNECTION_STRING` in `.env` with the connection string from your Supabase project
(Project Settings → Database → Connection string → .NET), then restart the `backend` service. No
code changes are required — the schema and migrations are plain EF Core/Npgsql and work against
any Postgres instance.

## Running things individually (outside Docker)

Backend:

```bash
cd backend
dotnet ef database update --project src/TrailWise.Infrastructure --startup-project src/TrailWise.Api
dotnet run --project src/TrailWise.Api
dotnet test
```

Web:

```bash
cd frontend-web
npm install
npm run dev
npm test
```

Mobile:

```bash
cd frontend-mobile
flutter pub get
flutter test
flutter run --dart-define=API_BASE_URL=http://localhost:5080
```

## Project layout

```
backend/            ASP.NET Core API, EF Core migrations, xUnit tests
frontend-web/        React operations console (Vite + TypeScript)
frontend-mobile/     Flutter traveler/guide app
docker-compose.yml    db + backend + frontend-web
.env.example          Documented environment variables
```

## Status

This is the foundational skeleton: full DB schema, JWT auth (Traveler self-register, Admin creates
other roles), and a thin `GET /api/packages` read endpoint proving the stack end-to-end. Booking
validation, the Coordinator/Planning Agent, and the other three components' business logic are
not yet implemented.
