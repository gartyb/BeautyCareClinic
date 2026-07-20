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

## FU-010: ActiveSeriesTab still calls mock-data treatment recording functions — RESOLVED

Source: Phase 010 implementation.
`ActiveSeriesTab.tsx` timer ("התחל טיימר") and quantity ("סמן טיפול כבוצע") buttons call
`recordTimerTreatment` and `recordQuantityTreatment` from `CustomerContext`, which operate
on in-memory mock data. `treatmentsApi.create` is implemented and available, but wiring it
requires CustomerContext to be refactored to call the API and then invalidate/re-fetch
`treatments` and `treatmentSeries`. This is blocked by the broader "CustomerContext API
integration" task.
Priority: High (functional gap vs backend).

Resolved in a session prior to v0.11.0 (exact date/session not separately logged): both
`recordTimerTreatment` and `recordQuantityTreatment` in `CustomerContext.tsx` now call
`treatmentsApi.create(...)` followed by `refreshForCustomer(customerId)`. Confirmed by direct
code inspection during Phase 011 proposal prep (2026-07-19) — no further action needed.

## FU-011: TreatmentModal.updateTreatmentNote operates on mock data — RESOLVED v0.11.0

Source: Phase 010 implementation.
`TreatmentModal.tsx` calls `updateTreatmentNote(treatmentId, text)` from CustomerContext,
which patches in-memory state only. There is no backend endpoint for editing treatment notes
after creation (spec: no PUT on treatments). Treatment-level notes should be passed at
creation time via `CreateTreatmentRequest.notes`. The inline note editor in TreatmentModal
should either be removed or converted to a read-only view. The existing Treatment.Notes
column is writable from the backend at POST time only.
Priority: Medium.

Resolved in v0.11.0: added `PUT /api/v1/treatments/{id}` (author-or-manager only, Notes-only
mutation) and a real editable note UI in `TreatmentModal.tsx` backed by `treatmentsApi.update`.
See `phases/phase-010/PHASE_SUMMARY.md`, "Maintenance Release — v0.11.0".

## FU-012: TreatmentHistoryTab missing delete UI — RESOLVED

Source: Phase 010 implementation.
The backend DELETE /treatments/{id} endpoint is implemented and returns 204. The frontend
TreatmentHistoryTab displays treatments but has no delete button. To be added in Phase 011
with role-based visibility (author sees delete; other therapist does not).
Priority: Medium.

Resolved in a session prior to v0.11.0 (exact date/session not separately logged):
`TreatmentHistoryTab.tsx` now renders a delete button (`Trash2` icon) gated to
`authorId === currentUserId || isManager`, calling `treatmentsApi.delete` with a confirm
dialog. Confirmed by direct code inspection during Phase 011 proposal prep (2026-07-19) — no
further action needed.

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

## FU-015: BeautyCareClinic.Tests fails to compile — DateOnly/DateTime mismatch in Phase010Tests — RESOLVED 2026-07-19

Source: found during environment setup (dev-machine install of Node.js/.NET SDK), not tied
to a specific implementation session.
`backend/BeautyCareClinic.Tests/Application/Phase010Tests.cs:592`, test
`TreatmentDto_HasExpectedFields`, constructs a `TreatmentDto` passing
`TreatmentDate: DateOnly.FromDateTime(DateTime.UtcNow)`. The DTO's actual field
(`BeautyCareClinic.Application/DTOs/TreatmentDtos.cs:20`) is `DateTime TreatmentDate`, not
`DateOnly` — the test doesn't match the DTO signature, so the whole Tests project fails to
compile (`dotnet build` on the solution fails; the four non-test projects build fine).
Fix: change the test to pass a `DateTime` (or reconcile whichever type `TreatmentDate` should
actually be, if the DTO itself should have moved to `DateOnly`).
Priority: High (blocks `dotnet build`/`dotnet test` on the whole solution).

Resolved as part of the 2026-07-19 order-creation bug fix follow-up: line 592 changed from
`DateOnly.FromDateTime(DateTime.UtcNow)` to `DateTime.UtcNow`, matching every other
`TreatmentDate` usage already in that file (lines 180, 266, 300, 329, 392, 415-416). Confirmed
`dotnet build BeautyCareClinic.sln` now succeeds with 0 errors across all five projects.

## FU-016: Frontend `tsc -b` fails — unused `currentUser` param in RecordPaymentModal

Source: found while verifying the "customer search shows error on first login" bug fix
(unrelated pre-existing issue, confirmed present on `main` before this session's changes via
`git stash` + `npx tsc -b`).
`src/features/payment/RecordPaymentModal.tsx:18` destructures `currentUser` from
`RecordPaymentModalProps` but never reads it in the component body, which trips
`noUnusedParameters` in `tsconfig` and fails `npm run build` (`tsc -b && vite build`).
`vitest`/`vite dev` are unaffected since they don't run the full project type-check.
Fix: either use `currentUser` (e.g. to attribute the payment to the recording user, if that's
a real requirement) or drop it from the destructure/prop type if it's genuinely unused.
Priority: Medium (blocks `npm run build`, does not block dev server or tests).

## FU-017: No backend regression test for order creation covering TreatmentSeries.CustomerId — RESOLVED 2026-07-19

Source: 2026-07-19 bug fix — POST /api/v1/customers/{customerId}/orders always returned 500.
Root cause was a migration-authoring gap: `TreatmentSeries.CustomerId` was added to the domain
entity, Fluent config, and EF model snapshot in the Phase 010 commit (ce37844), but the actual
Phase 010 migration file (`20260717160005_Phase010TreatmentNotes.cs`) never contained the
corresponding `AddColumn`/`CreateIndex`/`AddForeignKey` operations for it — so the DB table
never got the column even though EF's migration history and model snapshot both claimed it was
already applied. Fixed via a new migration,
`backend/BeautyCareClinic.Infrastructure/Migrations/20260719085129_AddTreatmentSeriesCustomerId.cs`.
An integration/regression test for `CustomerOrdersController.Create` that exercises a real
`TreatmentSeries` insert (e.g. via `WebApplicationFactory` + a real/test Postgres) would have
caught this immediately, since the Fluent/entity model already matched — only the physical
schema was wrong. Adding that test is currently blocked by FU-015 (the whole
`BeautyCareClinic.Tests` project fails to compile due to an unrelated `DateOnly`/`DateTime`
mismatch in `Phase010Tests.cs:592`), so no such test could be added without also fixing FU-015
first (out of scope for this bug fix, per explicit instruction).
Priority: High (this exact class of bug — model/snapshot updated without a matching migration —
has no automated guard right now; recommend fixing FU-015 first, then adding this test).

Resolved as part of the 2026-07-19 order-creation bug fix follow-up (after FU-015 was fixed):
added `backend/BeautyCareClinic.Tests/Integration/CustomerOrdersControllerPostgresTests.cs`.
This test opens a real Npgsql-backed `AppDbContext` (via the `ConnectionStrings__DefaultConnection`
env var, matching the existing `DesignTimeDbContextFactory` convention), calls
`Database.MigrateAsync()` to apply real migrations, invokes `CustomerOrdersController.Create`
directly with real repositories, and asserts both a 201 `CreatedAtActionResult` and — read back
from Postgres via a fresh untracked query — that the persisted `TreatmentSeries` row has the
correct `CustomerId`. Verified this test genuinely catches the original bug class: temporarily
removed the new migration's `.cs`/`.Designer.cs` files from the build and reverted the DB to the
pre-fix schema, re-ran the test, and it failed with
`Npgsql.PostgresException 42703: column "CustomerId" of relation "TreatmentSeries" does not
exist` — the same underlying error as the original production bug. Restored the migration files
and DB state, re-ran the full suite: 130/130 passing (129 pre-existing + this one).

## FU-018: `docs/API_SPECIFICATION.md` order item example uses wrong field name for the series link

Source: found while implementing CR-031 (2026-07-19).
The `GET /api/v1/orders/{id}` example response JSON (`docs/API_SPECIFICATION.md`, "Orders"
section) shows `"treatmentSeriesId": "<uuid>"` inside each order item. The real
`OrderItemDto` field (`backend/BeautyCareClinic.Application/DTOs/OrderDtos.cs`) is `SeriesId`,
which serializes as `seriesId`, not `treatmentSeriesId` — confirmed live via
`GET /api/v1/customers/{id}/orders` against the running dev backend, which returns `seriesId`.
`treatmentSeriesId` appears to be a leftover from an earlier frontend-only field name (see
`src/types/Order.ts`'s legacy `treatmentSeriesId` compatibility field) that never matched the
actual backend DTO. Left uncorrected here since fixing unrelated doc drift is out of scope for
CR-031 — only `packageNumber` was added to that same example line.
Priority: Low (documentation accuracy only; the real API and frontend types are already
correct/consistent — the frontend maps `seriesId ?? treatmentSeriesId` defensively).

## FU-019: TreatmentDate/PaymentDate/NoteDate "today" comparisons use raw `DateTime.UtcNow`, not Israel local time

Source: found during Phase 011 (Appointments) backend implementation, 2026-07-19/20.
`TreatmentsController.Create`, `PaymentsController.Create`, and `NotesController.Create`/`Update`
all derive "today" via `DateOnly.FromDateTime(DateTime.UtcNow)` and reject a supplied date if it's
later than that. Since the app's actual local timezone is Israel (UTC+2/UTC+3 DST), there's a
window each day — the hours between local midnight and UTC midnight — where `DateTime.UtcNow`
is still "yesterday" in UTC while it's already "today" in Israel. In that window, a
treatment/payment/note dated for the actual current Israel day gets rejected as "in the future"
(422), even though it isn't.
This is a day-granularity version of the same class of issue Phase 011 had to solve properly for
Appointments (which compare at minute granularity, not just day granularity, and so needed a real
`TimeZoneInfo`-based Israel-local "now" — see `AppointmentsController.GetIsraelLocalNow()` and
`docs/DATABASE_SCHEMA.md`'s Phase 011 Design Notes for the pattern). Fixing Treatments/Payments/
Notes the same way is straightforward (reuse or extract the same Israel-local-now helper) but was
explicitly out of scope for the Phase 011 backend pass — flagged here rather than fixed inline.
Priority: Low (narrow daily window, day-granularity rejection only, not a data-corruption risk —
worst case is a legitimate same-day entry briefly rejected with a clear Hebrew validation message,
correctable by retrying; not silent data corruption like the DateTimeKind bugs fixed in v0.11.0).

Update (2026-07-20, code-review follow-up pass): a minute-granularity instance of this same bug
class was found and FIXED in this pass — `src/features/customer/selectors.ts`'s
`previousAppointment`/`nextAppointment` were comparing `Appointment.startTime` (naive Israel-local,
no `Z`) against `new Date().toISOString()` (UTC-suffixed), misclassifying appointments occurring
within the Israel/UTC offset window as past/future. Fixed by reusing `appointmentService.ts`'s
`localNow()` helper (now exported) instead. See `src/features/customer/selectors.test.ts`'s "near
the UTC/Israel-local boundary" test cases for the regression coverage. The backend
Treatment/Payment/Note instances cataloged above remain open — this update covers only the
frontend `selectors.ts` occurrence.

## FU-020: `UsersController.Create`/`Update` validation messages are in English, now user-visible

Source: found while implementing Phase 012 (Therapist Management Backend Integration), 2026-07-20.
`UsersController.Create`/`Update`'s inline validation (`"FullName is required."`,
`"Email is required."`, `"Email is not valid."`, `"Password is required."`, `"A user with this
email already exists."`, `"Email is already in use by another user."`) is in English, unlike
every other controller in this codebase, which returns Hebrew validation/conflict messages. This
predates Phase 012 (the endpoints are from Phase 007/008), but was never user-visible until this
phase: `TherapistsContext.createTherapist`/`updateTherapist` were 100% local/mock before Phase 012
and never actually called `POST`/`PUT /api/v1/users`. Now that `TherapistModal`/`TherapistDetail`
call the real API, a genuine server-side validation failure (e.g. duplicate email) surfaces this
English text directly in the Hebrew UI. Not fixed in Phase 012 — `UsersController` was intentionally
left untouched outside the two additions the approved plan specified (`includeInactive` filter,
`PUT .../deactivate`); translating its pre-existing validation messages is a broader consistency
fix outside that scope.
Priority: Medium (real UX inconsistency, now reachable via a normal Manager workflow — duplicate
email during therapist creation — not just a theoretical gap).
