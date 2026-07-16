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

## Frontend Structure (Phase 1)

```
src/
  components/    Shared UI components
  features/      Feature modules (customer, order, timer, ...)
  contexts/      React Context providers
  hooks/         Custom hooks
  data/          Mock data (replaced by API calls in Phase 2)
  types/         TypeScript interfaces matching the domain model
```

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

React Context only. Two contexts: `CustomerContext` (active customer) and `ActiveTimerContext` (running timer state). No Redux.

| Context             | Holds                                                        |
| ------------------- | ------------------------------------------------------------ |
| `CustomerContext`   | Currently selected customer and their full data             |
| `ActiveTimerContext`| Timer state: running/paused, elapsed seconds, target series |
