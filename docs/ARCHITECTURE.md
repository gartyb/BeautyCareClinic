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

```
src/
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
