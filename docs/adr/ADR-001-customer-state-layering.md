# ADR-001 — Customer State Layering

## Status

Accepted — Phase 001

## Context

The Customer Card screen aggregates a large amount of data (orders, payments, series, treatments, appointments, notes) and requires derived business values (outstanding balance, active series list, completed treatments count). Several approaches were considered for where this logic lives:

- Everything on `CustomerContext` (provider computes and exposes derived values + CRUD methods)
- Redux store with selectors and thunks
- Context for state + component-level computation

The architecture mandates Clean Architecture: business logic must not appear in Presentation layer components. React Context is the only allowed state mechanism.

## Decision

**Context holds data · Selectors hold rules · Services hold mutations**

### Context (`src/contexts/`)
- `CustomerContext` — holds the currently viewed customer's raw aggregate data: `activeCustomer`, `orders`, `treatments`, `appointments`, `notes`, `treatmentSeries`.
- `ActiveTimerContext` — holds timer display state: `isRunning`, `isPaused`, `elapsedSeconds`, `targetSeriesId`.
- Contexts are **read-only** in Phase 1. Mutation methods are added in the phase that first requires them.

### Selectors (`src/features/customer/selectors.ts`)
- Pure functions of the form `(data) => derivedValue`.
- All derived domain values live here: `outstandingBalance(orders)`, `activeSeries(series)`, `completedTreatmentsForSeries(series)` — the `minutesPerTreatment` value is read from the `series` object itself.
- No React imports. Trivially unit-testable.

### Services (`src/data/`)
- Plain TypeScript modules (not React contexts) for data access and mutations.
- Phase 1: `customersService.ts` exposes search and (later) create-customer.
- Phase 2+: each service is replaced by an API client module. The interface stays stable; only the implementation changes.

## Consequences

- `CustomerContext` cannot become a god-object — mutations added only when needed.
- Business rules have exactly one implementation site per rule.
- Phase 2 API swap is isolated to `src/data/` service modules.
- Components import selectors directly — no need to add derived values to context shape.
- `createCustomer` is never on `CustomerContext` (called from Search, before an active customer exists). See ADR-002: Phase 5 introduces `CustomersContext` (plural) that owns the customer list and `createCustomer`.
