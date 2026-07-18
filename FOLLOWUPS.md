# FOLLOWUPS

Out-of-scope bugs found during Phase 001 implementation.

## FU-002: defaultTab computed before data loads (minor flicker)

Source: Phase 002 architecture review.
`CustomerCard.tsx` computes `defaultValue` (defaultTab) before the customer's series data
loads. When navigating directly to a customer URL this can cause a brief wrong-tab display.
Fix: defer tab selection until data is confirmed loaded (isLoading guard).
Priority: Low.

## FU-003: Dedicated unit tests for domain/money.ts

Source: Phase 002 architecture review.
`toCents` and `fromCents` lack their own test file. They are exercised indirectly through
paymentService tests but edge cases (NaN guard, rounding, very large values) deserve
explicit coverage in `src/domain/money.test.ts`.
Priority: Medium.

## FU-004: Incomplete orderService test assertion

Source: Phase 002 architecture review.
`src/features/order/orderService.test.ts` does not assert all fields of the created
`CustomerOrder` (e.g. `createdByUserId`, `orderItems` count, series kind mapping).
Extend tests before Phase 3 backend integration.
Priority: Low.

## FU-005: MAX_ORDER_TOTAL_CENTS upper-bound guard

Source: Phase 002 architecture review.
No upper bound prevents absurdly large order totals (e.g. ₪100,000,000) from being
submitted. Add `MAX_ORDER_TOTAL_CENTS` constant in `src/domain/constants.ts` and validate
in `buildNewOrder` before Phase 3 backend integration.
Priority: Low.

## FU-006: docs/system-flows.md is missing

Source: Phase 002 architecture review.
The payment recording and order creation flows are undocumented in the docs folder.
Add `docs/system-flows.md` describing the two happy-path flows and their error cases.
Priority: Low.

## FU-007: SearchResults.tsx still reads from static data imports

Source: Phase 5 implementation.
`src/features/search/SearchResults.tsx` still reads `treatmentSeries`, `appointments`, and
`orders` from static data files instead of from context. This means newly added customers
will show correct names in the list but their series/appointment/balance summary columns
will always reflect the seed data, not live state. Should be migrated to read from context
when CustomerContext is extended to expose cross-customer data or a new aggregate context
is added.
Priority: Medium.

## FU-001: Vitest 2.x / Vite 6.x type incompatibility

Vitest 2.x bundles its own vite (v5.x), which conflicts with top-level vite 6.x plugin types.
As a result, `vitest.config.ts` is not included in `tsconfig.node.json` (types not checked at build time).

Resolution options:
- Upgrade vitest to v3.x (compatible with vite 6)
- Or accept the separate config file workaround

Deferred to: Phase 2 dependency audit.


## FU-008: TherapistsContext createTherapist is still mock-only

Source: Phase 008 implementation.
`TherapistsContext.tsx` uses an in-memory array for therapists and `createTherapist(fullName, email, phone)` only mutates local state. The `UsersController` API exists and is wired for global-settings/customers, but TherapistContext was explicitly kept on mock data for Phase 008. When Phase 009 wires Users to the API, this context must be updated to call `usersApi.createUser` and `getUsers(role='Therapist')`.
Priority: High (blocks Phase 009 Users wire-up).

## FU-009: React act() warnings in tests from async context effects

Source: Phase 008 implementation.
`CustomersContext`, `TreatmentTypesContext`, and `GlobalSettingsContext` all fire async `useEffect` calls on mount which update state. Test components that render these contexts without wrapping assertions in `act()` produce React act() warnings. All 252 tests pass but the warnings add noise. Wrap relevant test helper `renderWithProviders` in `act()` or migrate context tests to use `waitFor()`.
Priority: Low.

## FU-010: ActiveSeriesTab still calls mock-data treatment recording functions

Source: Phase 010 implementation.
`ActiveSeriesTab.tsx` timer ("התחל טיימר") and quantity ("סמן טיפול כבוצע") buttons call
`recordTimerTreatment` and `recordQuantityTreatment` from `CustomerContext`, which operate
on in-memory mock data. `treatmentsApi.create` is implemented and available, but wiring it
requires CustomerContext to be refactored to call the API and then invalidate/re-fetch
`treatments` and `treatmentSeries`. This is blocked by the broader "CustomerContext API
integration" task.
Priority: High (functional gap vs backend).

## FU-011: TreatmentModal.updateTreatmentNote operates on mock data

Source: Phase 010 implementation.
`TreatmentModal.tsx` calls `updateTreatmentNote(treatmentId, text)` from CustomerContext,
which patches in-memory state only. There is no backend endpoint for editing treatment notes
after creation (spec: no PUT on treatments). Treatment-level notes should be passed at
creation time via `CreateTreatmentRequest.notes`. The inline note editor in TreatmentModal
should either be removed or converted to a read-only view. The existing Treatment.Notes
column is writable from the backend at POST time only.
Priority: Medium.

## FU-012: TreatmentHistoryTab missing delete UI

Source: Phase 010 implementation.
The backend DELETE /treatments/{id} endpoint is implemented and returns 204. The frontend
TreatmentHistoryTab displays treatments but has no delete button. To be added in Phase 011
with role-based visibility (author sees delete; other therapist does not).
Priority: Medium.

## FU-013: Loading states and toast notifications not yet implemented

Source: Phase 010 implementation.
NotesTab shows inline error strings (e.g. "שגיאה בשמירת ההערה") but no loading skeleton
while fetching notes/treatments, and no toast notification system. The spec called for
"loading skeletons + error toasts בעברית". Deferred to Phase 011 when a shared
notification context is introduced.
Priority: Medium.

## FU-014: PackageTypesContext was not wired to API (Phase 009 miss)

Source: Phase 009 acceptance criteria — not completed, not marked deferred.
`PackageTypesController` and `packageTypesApi.ts` were implemented in Phase 009, but
`PackageTypesContext` remained in-memory only (seeded from mock data). Changes to package
types (create/update/delete) from the manager screen were not persisted to the DB.
Fixed in Phase 010 session: context now calls `packageTypesApi` for all mutations and loads
from API on mount.
Priority: Fixed.
