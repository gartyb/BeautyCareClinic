# Architecture

## Pattern

Clean Architecture. Dependency direction: outer layers depend on inner layers, never the reverse.

```
┌──────────────────────────────────────────┐
│           Presentation Layer             │  React (frontend) / ASP.NET Controllers
├──────────────────────────────────────────┤
│          Infrastructure Layer            │  EF Core, PostgreSQL, Identity, Storage
├──────────────────────────────────────────┤
│          Application Layer               │  Use cases, DTOs, service interfaces
├──────────────────────────────────────────┤
│            Domain Layer                  │  Entities, value objects, domain rules
└──────────────────────────────────────────┘
```

## Layer Responsibilities

| Layer          | Responsibility                                                              | May Depend On |
| -------------- | --------------------------------------------------------------------------- | ------------- |
| Domain         | Core entities, business rules, domain events, value objects                | Nothing       |
| Application    | Use cases, command/query handlers, interfaces for infrastructure            | Domain        |
| Infrastructure | EF Core DbContext, repositories, identity, file storage, external services  | Application   |
| Presentation   | React components, API controllers, request/response models                  | Application   |

## Key Rules

- Business logic must not appear in controllers, React components, or EF Core configuration.
- Repositories are interfaces in Application, implemented in Infrastructure.
- Application never imports from Infrastructure.
- Domain entities are plain objects with no framework dependencies.

## Frontend Structure (Phase 8)

Frontend project root: `frontend/` (sibling to `backend/`; `package.json`, `vite.config.ts`,
`index.html`, and env files live there — see the "Frontend/Backend Layout" change below).

```
frontend/src/
  api/           HTTP client layer (Phase 8+)
    apiClient.ts   Singleton fetch wrapper with Bearer auth + 401 auto-logout
    apiError.ts    ApiError interface + ApiRequestError class
    tokenManager.ts  localStorage JWT management (authToken, authTokenExpiresAt)
    authApi.ts     /auth/login, /auth/me
    customersApi.ts  CRUD for /customers
    treatmentTypesApi.ts  CRUD for /treatment-types
    usersApi.ts    CRUD for /users
    globalSettingsApi.ts  GET + PUT /global-settings
    index.ts       Re-exports
  components/    Shared UI components
  features/      Feature modules (customer, order, timer, auth, ...)
    auth/          LoginPage (RTL Hebrew, /login route)
  contexts/      React Context providers (see State Management below)
  hooks/         Custom hooks
  data/          Mock data for entities not yet wired to API
  types/         TypeScript interfaces matching the domain model
```

### API Layer Pattern (ADR-008a)

- `apiClient` singleton sends `Authorization: Bearer <token>` on every request.
- On HTTP 401: dispatches `window.dispatchEvent(new Event('auth:unauthorized'))` before throwing.
- `AuthContext` listens for that event and calls `logout()` → clears token → navigates to `/login`.
- Token stored in `localStorage` with expiry timestamp; `/auth/me` is called on page load to rehydrate `currentUser`.
- Environment variable `VITE_API_URL` sets the base URL (see `.env.example`).

## Backend Structure (Phase 7)

```
backend/
  BeautyCareClinic.Domain/         Entities (POCOs), enums
  BeautyCareClinic.Application/    DTOs, service interfaces, ICurrentUserService
  BeautyCareClinic.Infrastructure/ EF Core (AppDbContext), repositories, Identity (AppUser), JwtService, DbSeeder
  BeautyCareClinic.Api/            Controllers, middleware (ExceptionHandling, SecurityHeaders), Program.cs
  BeautyCareClinic.Tests/          xUnit tests (unit + InMemory integration)
```

### Identity Strategy (ADR-004)

`AppUser : IdentityUser<Guid>` lives in Infrastructure only. `Domain.User` is a clean POCO with the same Guid ID. `USER.role` is authoritative for authorization — never AspNetRoles. JWT role claim is read from `Domain.User.role`.

### Security Middleware

- `SecurityHeadersMiddleware` — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- `ExceptionHandlingMiddleware` — structured JSON errors, no internal details to client, traceId included

## Deployment Topology (Phase 013 — interim, see ADR-013-A in `phases/phase-013/PHASE_SUMMARY.md`)

The server (Contabo VPS, Ubuntu 24.04) runs aaPanel with its own nginx (`/www/server/nginx`, **not** the systemd `nginx.service` unit — that one is unused). aaPanel's nginx is the sole public entry point on ports 80/443.

- **Public hostname:** `169-58-26-157.sslip.io` (free wildcard-DNS-to-IP service — no domain purchased). If the server's public IP ever changes, this hostname, its certificate, and any bookmarks must all be updated together.
- **Vhost config:** `/www/server/panel/vhost/nginx/beautycare.conf` — port 80 redirects to 443 (except `/.well-known/acme-challenge/`, needed for cert renewal); port 443 terminates TLS and reverse-proxies:
  - `/` → `http://127.0.0.1:5174` (the Vite dev server — includes WebSocket upgrade headers for Vite HMR; Vite's own `server.proxy` then forwards `/api` to the backend, so browser API calls are same-origin).
  - `/swagger` → `http://127.0.0.1:5000` directly, gated by HTTP Basic Auth (`/www/beautycare-secrets/swagger_htpasswd` — deliberately outside any web-servable root, so no vhost could ever accidentally serve the hash file itself) — lets Postman/Swagger UI reach the backend for testing without exposing port 5000 itself.
- **TLS certificate:** Let's Encrypt via `certbot` (webroot method, webroot `/www/wwwroot/acme-challenge`), auto-renewed by `certbot.timer` with a deploy-hook (`/etc/letsencrypt/renewal-hooks/deploy/reload-aapanel-nginx.sh`) that reloads aaPanel's nginx specifically (not the unused systemd unit).
- **HSTS:** shipped with a short `max-age=300` for the initial burn-in period (RC-3) — deliberately **not yet raised** to a long-lived value; raise it in `beautycare.conf` once the deployment has run stably for a few days.
- **Firewall (ufw):** only `22` (SSH), `80`, `443` are externally reachable. The Vite (5174) and Kestrel (5000) ports are no longer directly reachable from outside — verified from a genuinely external client, not from the server itself (same-host tests are misleading here: traffic to the server's own public IP from itself is delivered via loopback and does not reflect real firewall behavior).
- **Postgres:** container `beautycare-postgres` publishes `127.0.0.1:5432:5432` only (not `0.0.0.0`) — Docker's own iptables rules for published ports bypass ufw's default-deny, so the fix had to be at the Docker layer, not just the firewall. Configuration captured in `docker-compose.yml` (see `.env.docker.example`) so it survives a container recreation.
- **Frontend/backend remain in dev mode** (`vite` dev server, `dotnet run` with `ASPNETCORE_ENVIRONMENT=Development`) — this phase changed only the network path to reach them, not their runtime mode. A production-build migration is a candidate for a future phase.
- **Frontend/backend layout:** the frontend project root moved from the repo root into `frontend/` (2026-07-26) — `package.json`, `vite.config.ts`, `index.html`, and Vite's env files now live under `frontend/`, mirroring `backend/`. The Vite dev server must be started with `frontend/` as its working directory (`cd frontend && npm run dev`); all internal paths (proxy target `http://localhost:5000`, port `5174`) are unchanged.

## State Management

React Context only. No Redux.

| Context                 | Holds                                                        | Data source (Phase 8) |
| ----------------------- | ------------------------------------------------------------ | --------------------- |
| `AuthContext`           | `currentUser`, `isInitializing`, `login`, `logout`          | `/auth/me` via API    |
| `CustomersContext`      | Customer list, CRUD, `isLoading`, `error`, `refetch`        | `/customers` via API  |
| `TreatmentTypesContext` | TreatmentType list, CRUD, `isLoading`, `error`              | `/treatment-types` via API |
| `GlobalSettingsContext` | `defaultMaxPaymentCount`, `calendarStartHour/EndHour`, `isLoading`, `error` | `/global-settings` via API |
| `CustomerContext`       | Currently selected customer and their full data             | Mock data (Phase 9+)  |
| `ActiveTimerContext`    | Timer state: running/paused, elapsed seconds, target series | In-memory             |
| `AppointmentsContext`   | All appointments, create/cancel/reschedule                  | Mock data (Phase 9+)  |
| `PackageTypesContext`   | PackageType list, CRUD                                      | Mock data (Phase 9+)  |
| `TherapistsContext`     | Therapist (User) list, CRUD                                 | Mock data (Phase 9+)  |
| `TherapistDataContext`  | WorkingHours, UnavailableDates, Capabilities                | Mock data (Phase 9+)  |
