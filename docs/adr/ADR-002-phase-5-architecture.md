# ADR-002 — Phase 5 Architecture (New Customer + Manager Admin Screens)

## Status

Proposed — awaiting approval before Phase 5 implementation.

## Context

Phase 5 introduces four features: a "New Customer" modal from `/search`, and three manager-only admin screens (`/packages`, `/therapists`, `/settings`). The proposed plan had three architectural collisions that must be resolved:

1. **ADR-001 explicitly forbids `createCustomer` on `CustomerContext`** (`createCustomer` is called from Search, before an active customer exists). The original plan placed it there — violation.
2. **`DEFAULT_MAX_PAYMENT_COUNT`** is a hardcoded constant. Phase 5 makes it editable via Global Settings, requiring a context to hold the live value and making the constant obsolete.
3. **Provider ordering:** `CustomerContext` (which needs `defaultMaxPaymentCount` for order creation) and the new `GlobalSettingsContext` must be mounted in the right order.

## Decision

### D1 — Customer list state lives in a new `CustomersContext` (plural)

Create `src/contexts/CustomersContext.tsx` that owns the full in-memory customer list and exposes `customers` and `createCustomer(fullName, phone, email?)`. `CustomerContext` (singular) continues to hold only the active-customer aggregate and reads the list via `useCustomers()` to resolve `activeCustomer`. `SearchScreen` also consumes `useCustomers()` instead of importing the mock array directly.

**Resolves:** ADR-001 `createCustomer` invariant. Mock array in `src/data/customers.ts` becomes seed-only (no runtime imports outside the context initializer).

### D2 — `GlobalSettingsContext` is mounted at root, above all other providers

Provider order in `main.tsx`: `BrowserRouter` → `GlobalSettingsProvider` → `CustomersProvider` → `CustomerProvider` → `ActiveTimerProvider` → `App`.

`CustomerContext.addOrder` and `NewOrderModal` read `defaultMaxPaymentCount` via `useGlobalSettings()`. `orderService.buildNewOrder` gains a required `defaultMaxPaymentCount: number` parameter (explicit; keeps service pure). `DEFAULT_MAX_PAYMENT_COUNT` constant is deleted in the same commit — no transitional dual-source period.

### D3 — Admin screen state uses local `useState` (no shared AdminContext)

`PackagesScreen` and `TherapistDetail` each own local `useState` arrays seeded from mock data on mount. Rationale: manager-only; no cross-screen readers in Phase 5; replaced by fetch/mutate in the backend phase. Shared context would be premature abstraction. Business logic stays in pure `packageTypeService` / `therapistDataService` modules.

### D4 — Manager-only routes wrapped in `<RoleGuard>` with redirect fallback

`RoleGuard` gains an optional `fallback?: React.ReactNode` prop (default `null`, preserves existing call sites). In `App.tsx`, `/packages`, `/therapists`, and `/settings` are wrapped with `<RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>`. Sidebar hiding is UX only; route guard is the load-bearing control.

### D5 — Therapist detail as sub-route `/therapists/:userId`

Keep plan as written. Bookmarkable, consistent with `/customers/:id` precedent, no layout complications.

## Alternatives Considered

- **`createCustomer` on `CustomerContext`** — rejected: violates ADR-001.
- **`SearchScreen` local copy of customers** — rejected: `CustomerContext` also resolves `activeCustomer` from the list; two sources would diverge after create-and-navigate.
- **`GlobalSettingsContext` wrapping only manager routes** — rejected: `NewOrderModal` is available to therapists and needs the default value.
- **Passing settings via prop drilling** — rejected for context signature; `addOrder` callers should not also supply a settings value.
- **Shared `AdminContext`** — rejected (see D3).

## New Invariants

- **I1:** The customer list is owned by `CustomersContext`. No module imports `data/customers.ts` at runtime.
- **I2:** `defaultMaxPaymentCount` is never read from a module constant. All consumers use `useGlobalSettings()`.
- **I3:** Manager-only routes must be wrapped in `<RoleGuard>` with a redirect fallback. Sidebar hiding alone is not sufficient.
- **I4:** Pure services (`customerService`, `packageTypeService`, `therapistDataService`, `settingsService`) never import React or context. Inputs are explicit; outputs are new immutable values.

## Flagged Spec Change

Phase 5 plan placed `createCustomer` in `CustomerContext`. **This violates ADR-001.** Corrected: `CustomersContext` (new) owns the customer list and `createCustomer`. See `PHASE_SUMMARY.md` implementation section.

## Additional Risks

| Risk | Mitigation |
|---|---|
| **R1 — Provider stack in tests** | Introduce a shared `renderWithProviders` helper in `src/test/` before Phase 5 tests are written. |
| **R2 — Delete PackageType referenced by existing series** | Hard-delete allowed at mock level (no cross-checks in list-only screen). Add comment: backend phase must enforce referential integrity or soft-delete. |
| **R3 — `CustomerSummary` vs `Customer`** | `CustomersContext` exposes `Customer[]`; `SearchScreen` widens to `Customer[]` (safe: `Customer extends CustomerSummary`). |
| **R4 — `createCustomer` id generation** | Must use `newId` from `src/domain/id.ts`, not an inline generator. |
| **R5 — Overnight shifts** | `startTime < endTime` rule excludes overnight shifts. Acceptable for a beauty clinic; document explicitly. |

## Implementation Conditions

1. Introduce `CustomersContext` before wiring the New Customer modal.
2. Delete `DEFAULT_MAX_PAYMENT_COUNT` in the same commit as `GlobalSettingsContext` — no dual-source period.
3. `buildNewOrder` requires explicit `defaultMaxPaymentCount: number` parameter; update caller and all tests.
4. `RoleGuard` fallback prop is additive; default `null` preserves all existing call sites.
5. All four new services follow the `noteService` template: pure `build*` functions, `DomainError` for rule violations, injected `newId` and `today` for testability.
6. Update `docs/ARCHITECTURE.md` state-management table before Phase 5 is marked complete.

## Affected Files (additions to plan)

| Path | Change |
|---|---|
| `src/contexts/CustomersContext.tsx` | NEW — owns customer list; exposes `createCustomer` |
| `src/contexts/GlobalSettingsContext.tsx` | NEW — owns `defaultMaxPaymentCount` |
| `src/contexts/CustomerContext.tsx` | Read list via `useCustomers()`; read settings via `useGlobalSettings()` in `addOrder` |
| `src/main.tsx` | Provider order: GlobalSettingsProvider → CustomersProvider → CustomerProvider → ActiveTimerProvider |
| `src/components/shared/RoleGuard.tsx` | Add optional `fallback?: React.ReactNode` prop |
| `src/features/order/orderService.ts` | Remove constant import; require `defaultMaxPaymentCount` parameter |
| `src/features/order/orderService.test.ts` | Pass `defaultMaxPaymentCount` explicitly in all tests |
| `src/features/order/NewOrderModal.tsx` | Read default via `useGlobalSettings()` |
| `src/domain/constants.ts` | Remove `DEFAULT_MAX_PAYMENT_COUNT` (delete file if empty) |
| `src/test/renderWithProviders.tsx` | NEW — shared test helper wrapping all 4 providers |
| `docs/ARCHITECTURE.md` | Update state-management table to list 4 contexts |
