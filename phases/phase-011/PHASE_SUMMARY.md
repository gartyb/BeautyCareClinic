# Phase 011 — Appointments Backend Integration

## Status

Approved — Pending Commit

## Architecture Review

**Verdict:** Approve with two required corrections; one ADR warranted.

**Approved as planned:** domain model already supports the plan with no new tables/fields; "therapist = `User` with `Role=Therapist`" is confirmed correct and consistent (no separate Therapist table exists anywhere in the backend); controller/DTO/routing conventions match `Treatments`/`Payments`/`Notes` exactly; permission model introduces no new IDOR gap beyond the already-accepted CR-029 all-customers-visible model; `AppointmentStatus`/`UserRole` enums already support the Q2-resolved scope.

**Required Correction #1 — Q4 + Q7 leave the availability check with no data to read.** `DbSeeder.cs` seeds zero `TherapistWorkingHours`/`TherapistCapability`/`TherapistUnavailableDate` rows, and the frontend's mock availability data (`therapistWorkingHours.ts`, `therapistCapabilities.ts`) is keyed to fake IDs (`'user-therapist-1'`), not real `User.Id` GUIDs. Combined with Q7 (calendar picker switches to real Users now), no therapist would ever appear available — the picker and the availability data live in two different ID spaces, and the backend has nothing to validate against regardless. **Resolution (adopted):** `DbSeeder` will seed `TherapistWorkingHours`/`TherapistCapability` rows keyed to the real seeded therapist `User.Id`s, and the backend will expose this data read-only (e.g. embedded in the `GET /api/v1/users?role=Therapist` response, or a small dedicated read endpoint) — no write/management API, which keeps Q4's deferral intact.

**Required Correction #2 — the row-lock precedent (Q3) doesn't generalize to a range-overlap check as literally copied.** The existing lock pattern (`PaymentsController`/`TreatmentsController`) guards a single known row's mutable counter; double-booking is an overlap check across a set of rows where the conflicting row may not exist yet — locking the rows a query happens to find does not block a concurrent phantom insert under READ COMMITTED. **Resolution (adopted, see ADR-011-A below):** lock the therapist's `User` row (`SELECT "Id" FROM "Users" WHERE "Id" = {userId} FOR UPDATE`) as a serialization mutex before the overlap check + insert, not the Appointment rows themselves. A reschedule that changes therapist locks both old and new `User` rows in ascending-GUID order and excludes the appointment being moved from its own overlap check.

**Approved changes to the plan:**
- Add availability-data seeding (Correction #1) as in-scope for this phase — it's required for the feature to be testable/usable at all, not new scope creep.
- Add a small read-only endpoint (or embed in an existing one) exposing therapist working-hours/capability data to the frontend, keyed by real `User.Id`.
- Availability-checking logic lives in a focused Application-layer service (not inline in the controller, per this project's Clean Architecture rule), unit-testable.
- Past-time validation must compare against the same naive-local (Israel, UTC+2) reference the stored times use — comparing against raw `DateTime.UtcNow` directly would misclassify appointments in the next ~2 hours (the same bug class as this session's Payment/Note DateTime-Kind fixes).
- Weekday mapping (frontend `getDay()` is Sunday=0) must be ported faithfully to the backend's day-of-week check.
- Confirmed: the `therapistId` → `userId` rename ripples through `appointmentService.ts`, `SummaryRow.tsx`, `SearchResults.tsx`, and all calendar components — and, more significantly, `AppointmentsContext`'s currently-synchronous methods (`createAppointment`, etc.) become async once backed by a real API, so every caller needs `await` + loading/error handling. This is the largest frontend edit in the phase, not the field rename itself.

**ADR-011-A — Double-Booking Prevented by Locking the Therapist's User Row.** Status: Accepted for Phase 011. Locks the therapist's `User` row as a mutex (not because it's mutated) before the overlap check + insert, serializing bookings per therapist. Trade-off: correctness depends on every write path taking this lock — a future insert path that bypasses the controller would be unprotected (a Postgres `EXCLUDE USING gist` constraint would be belt-and-suspenders, deferred as unnecessary for this phase's scope). New invariant for future code: any code inserting/moving an `Appointment` MUST first `FOR UPDATE`-lock the target therapist's `User` row within the same transaction.

**Remaining risks:** the sync→async `AppointmentsContext` conversion touches more call sites than initially scoped — implementer-tester should budget for this. Otherwise no new risks beyond what the plan already listed.

## Goal

Connect the existing appointment-calendar screen (built in Phase 006, fully functional frontend with mock data) to a real backend, following the same integration pattern already established for Treatments, Payments, Notes, and Orders in Phases 007–010. Enable therapists to book, reschedule, and cancel appointments with real persistence and availability checking.

## Business Value

Indirect support for the Customer Card priority. Appointments are primarily an operations/scheduling concern, not a core Customer Card data element — but a therapist typically confirms an appointment slot before recording a treatment, so this closes a real operational gap. Appointments are currently a fully functional UI experience that silently loses all data on page refresh, which blocks real clinic use of the calendar.

## Scope

### Backend — 6 core endpoints

**Appointments CRUD**
- `GET /api/v1/appointments` — list all (Auth)
- `GET /api/v1/customers/{customerId}/appointments` — list by customer (Auth)
- `GET /api/v1/appointments/{id}` — single (Auth)
- `POST /api/v1/customers/{customerId}/appointments` — create (Auth)
- `PUT /api/v1/appointments/{id}` — reschedule (start/end time, therapist) (Author / Manager)
- `DELETE /api/v1/appointments/{id}` — cancel (Author / Manager)

### Backend — Business Logic

**Availability validation (Create and Update):**
- Therapist must have working hours covering the requested date/time
- Therapist must not have an unavailable-date entry blocking that date
- Therapist must not have an existing Scheduled/Completed appointment overlapping the slot
- Therapist must have capability for the requested treatment type
- Appointment start time must not be in the past

**Status:**
- Created as `Scheduled`
- Phase 011 MVP: the only transition is `Scheduled → Cancelled` via DELETE (see Open Question Q2)

**Permissions:**
- Create: any authenticated user
- Read: any authenticated user (matches the existing all-customers-visible access model)
- Update / Delete: appointment's author (the therapist it was booked for/by) or a Manager — same pattern as `NotesController`/`TreatmentsController`

**Concurrency:**
- Prevent double-booking a therapist for an overlapping slot (see Open Question Q3 for constraint-vs-lock choice)

## Out of Scope

- Treatment Photos backend (separate, already-identified gap — not bundled into this phase)
- Therapist working-hours / unavailable-dates / capability management APIs (`TherapistWorkingHours`, `TherapistUnavailableDate`, `TherapistCapability` stay mock/seed data for this phase)
- Appointment status values beyond Scheduled/Cancelled (Completed/NoShow, and any auto-linking to a Treatment record)
- Editing/rescheduling past or non-Scheduled appointments, for any role including Manager
- Notifications/reminders (SMS/email)
- Soft-delete / audit trail on cancellation
- DateTimeOffset migration (CR-019) — this phase follows the existing `DateTimeKind.Utc` convention only
- CORS / HTTPS / HSTS / CSP hardening (CR-013, CR-014, CR-004)

## User Workflows

**Booking:** open the calendar → "קבע תור חדש" (or from the Customer Card) → select treatment type, therapist, date/time → POST → appointment appears on the calendar; validation errors surface as a Hebrew toast (e.g. slot unavailable, therapist not qualified).

**Rescheduling:** click an appointment → "עדכן" → change date/time/therapist → PUT → calendar updates; blocked (409) for past or non-Scheduled appointments, and hidden from the UI entirely for therapists who aren't the author (unless Manager).

**Cancelling:** click an appointment → "בטל" → confirm → DELETE → appointment removed from the calendar.

## Database Changes

No new tables — `Appointment`, `TherapistWorkingHours`, `TherapistUnavailableDate`, `TherapistCapability` already exist in the schema from earlier phases but have never been backed by an API.

Possible additions (final choice depends on Q3):
- Unique constraint or index supporting double-booking prevention on `(UserId, StartTime, EndTime)`
- Index on `(CustomerId, StartTime)` and `(UserId, StartTime)` for query performance

## Domain Changes

`Appointment` entity likely needs no new fields (`Id`, `CustomerId`, `TreatmentTypeId`, `UserId`, `StartTime`, `EndTime`, `Status`, `CreatedAt` — confirm exact current fields during implementation). EF configuration needs the same treatment as Phase 010 entities: explicit navigations, `DateTimeKind.Utc` on every date/time write path (this session fixed two production bugs caused by skipping this — see `TreatmentsController.Create` for the correct pattern to copy).

## API Changes

New `AppointmentDtos.cs`: `CreateAppointmentRequest`, `UpdateAppointmentRequest`, `AppointmentDto` (including a snapshotted `UserFullName`, matching the `PerformedByFullName`/`RecordedByFullName`/`WrittenByFullName` pattern already used for Treatment/Payment/Note). 6 endpoints as listed under Scope.

## UI Changes

- `src/types/Appointment.ts` — align field names with the backend DTO (see Q1)
- `src/api/appointmentsApi.ts` — new module, mirrors `treatmentsApi.ts`
- `src/contexts/AppointmentsContext.tsx` — replace mock-array mutations with real API calls + refetch
- Existing calendar components (locate exact files during implementation — book/reschedule modals, calendar grid) wired to the API instead of local state, with loading and Hebrew error states added
- Calendar's therapist picker switched from the mock therapist list to real `User` records with `Role = Therapist` (via the existing Users API)

## Validation Rules

**Create/Reschedule:** `endTime > startTime`; `startTime` not in the past; `customerId`/`treatmentTypeId`/`userId` must exist (404 otherwise); `userId` must resolve to a Therapist; full availability check (working hours / unavailable dates / overlap / capability) → 409 on conflict, with a Hebrew reason.

**Reschedule/Delete:** 403 for a non-author, non-Manager caller; 409 if the appointment isn't in a state that allows the action (e.g. already cancelled, or — if Q2 resolves to include Completed — already completed).

## Main Implementation Components

**Backend:** `AppointmentsController`, `IAppointmentRepository`/`AppointmentRepository`, `AppointmentDtos.cs`, an availability-checking component (service or inline in the controller — decide based on complexity once the real working-hours/capability data shape is confirmed), `AppDbContext` EF config, DI registration in `Program.cs`.

**Frontend:** `appointmentsApi.ts`, `Appointment.ts` type update, `AppointmentsContext.tsx` API wiring, existing calendar UI components updated for API + loading/error states.

## Testing Strategy

**Backend:** unit tests for availability logic, permission checks, and validation edge cases; Postgres integration tests (following this session's established `*ControllerPostgresTests.cs` pattern — real controller calls, not logic re-implemented in the test) for create/reschedule/cancel and for the double-booking prevention mechanism specifically (proven the same way prior fixes in this project were: temporarily break the guard, confirm the test catches it, restore).

**Frontend:** unit tests for `appointmentsApi.ts`; component tests for the booking/reschedule/cancel flows and permission-gated UI, following the `OrdersTab.test.tsx`/`TreatmentModal.test.tsx` conventions from v0.11.0.

## Risks

- **Availability logic complexity** — porting frontend mock-validation logic to the backend faithfully; mitigate with thorough test coverage comparing old vs. new behavior.
- **Double-booking race** — two concurrent bookings for the same therapist/slot; needs an explicit concurrency decision (Q3).
- **Timezone ambiguity** — pre-existing project-wide issue (CR-019); this phase should follow the existing `DateTimeKind.Utc` convention consistently rather than attempting to fix CR-019 itself.
- **Therapist availability data staying mock** (if Q4 is deferred) — means therapists still can't self-manage their own working hours/capabilities after this phase; acceptable if explicitly scoped out, confusing if not documented.
- **User deletion cascade** — if a therapist `User` is deleted, existing FK behavior (`ON DELETE RESTRICT`, consistent with other Customer/User-referencing FKs in this schema) should already prevent orphaned appointments; confirm during implementation.

## Dependencies

Phases 007–010 backend conventions (controllers, repositories, DTOs, `ICurrentUserService`, exception handling, row-locking pattern); Phase 006 frontend calendar UI; real Postgres for integration tests (already available in this environment).

## Open Questions — Resolved

Decisions confirmed by the user (2026-07-19):

- **Q1 — Frontend field naming.** Resolved: rename `therapistId` → `userId` in the frontend, matching the backend and every other Phase 007-010 integration.
- **Q2 — Status scope.** Resolved: `Scheduled`/`Cancelled` only for this phase. Completing an appointment and recording a treatment remain two separate, unlinked actions; `Completed`/`NoShow` and any Appointment→Treatment link are deferred to a future phase.
- **Q3 — Double-booking prevention mechanism.** Resolved: `SELECT ... FOR UPDATE` row-level lock, matching the existing project convention (ADR-010-A), not a DB unique constraint.
- **Q4 — Therapist availability APIs.** Resolved: deferred. `TherapistWorkingHours`/`TherapistUnavailableDate`/`TherapistCapability` stay mock/seed data for this phase; the Appointment API's availability checks read against that mock data.
- **Q5 — Timezone documentation.** Resolved: appointment times are naive local time (Israel, UTC+2), no DST-aware conversion — same convention as `TreatmentDate`/`PaymentDate`/`NoteDate`.
- **Q6 — Past-appointment editing.** Resolved (default, low-stakes): blocked regardless of role — a past or non-Scheduled appointment cannot be rescheduled, by anyone, including a Manager. Correcting a data-entry mistake on a past appointment is out of scope for this phase.
- **Q7 — Calendar therapist list source.** Resolved: switch the calendar's therapist picker to real `User` records (`Role = Therapist`) now, even though working-hours/capability data itself stays mock per Q4.

## Acceptance Criteria

### Backend
- [x] All 6 endpoints implemented per the Scope section, with `[Authorize]` and the author-or-manager guard on Update/Delete
- [x] Full availability validation on Create and Update, with Hebrew 409 messages
- [x] `userId`/`customerId`/`treatmentTypeId` existence validated, 404 otherwise
- [x] `endTime > startTime`, `startTime` not in the past enforced
- [x] Double-booking prevention verified under real concurrent requests (ADR-011-A, `Create_ConcurrentOverlappingRequestsForSameSlot_OnlyOneSucceeds`)
- [x] `UserFullName` snapshotted at creation, matching the existing Payment/Treatment/Note pattern
- [x] All date/time writes use `DateTimeKind.Unspecified` into `timestamp without time zone` `StartTime`/`EndTime` columns — **superseded during manual validation**: the original criterion here said `DateTimeKind.Utc` (matching the then-existing project convention), but that convention was itself the root cause of a real +3h display bug found during user testing (see Lessons Learned). Fixed to genuinely naive-local storage instead of following the old convention forward.

### Frontend
- [x] `AppointmentsContext` fully wired to the real API — no more mock-array mutations
- [x] Loading and Hebrew error states on all calendar actions
- [x] Reschedule/cancel controls hidden for non-author, non-Manager users
- [x] `tsc -b --noEmit` — no new errors beyond the known pre-existing FU-016

### Testing
- [x] Backend: unit tests for availability/permission/validation logic + Postgres integration tests for all 6 endpoints and the double-booking guarantee, proven genuine (break-then-restore)
- [x] Frontend: `appointmentsApi.ts` unit tests + component tests for booking/reschedule/cancel and permission gating

### Docs
- [x] `docs/API_SPECIFICATION.md`, `docs/DATABASE_SCHEMA.md`, `docs/WORKFLOWS.md`, `docs/DOMAIN_MODEL.md` updated to reflect the new endpoints, workflows, and the naive-local timestamp convention

## Implemented

- 6 REST endpoints (`AppointmentsController`) — list all, list by customer, get by id, create, reschedule (PUT), cancel (DELETE) — plus a read-only `GET /api/v1/therapists/availability` (`TherapistAvailabilityController`) exposing seeded working-hours/capability/unavailable-date data.
- `AvailabilityService` (Application/Infrastructure) — working hours ∩ unavailable dates ∩ therapist capability ∩ no overlapping Scheduled/Completed appointment, ported faithfully from the frontend's pre-existing mock-validation logic.
- ADR-011-A double-booking prevention: `SELECT ... FOR UPDATE` lock on the target therapist's `User` row as a serialization mutex before the overlap check + insert; reschedule-with-therapist-change locks both old and new rows in ascending-GUID order.
- `DbSeeder` seeds real `TherapistWorkingHours`/`TherapistCapability` rows keyed to actual seeded therapist `User.Id`s (Required Correction #1 from architecture review).
- Frontend: `AppointmentsContext`/`appointmentsApi.ts` fully async, calendar + Customer Card booking/reschedule/cancel flows wired to the real API with Hebrew loading/error states; `therapistId` → `userId` rename completed throughout.
- Business rule (added during this session, at explicit user request, not originally in the approved plan): a customer may only book an appointment for a `TreatmentType` they hold an active `TreatmentSeries` for. Documented in `docs/DOMAIN_MODEL.md`/`docs/WORKFLOWS.md`; enforced client-side only today — server-side enforcement deferred as **CR-032**.
- Bug fix (found via manual browser testing with the user, this session): `BookAppointmentModal` cached a customer's active-series fetch and never re-ran it on reopen (the modal is permanently mounted, only `open` toggles) — a customer who bought a package while the modal was closed still saw "no active packages" until a full page reload. Fixed by keying the fetch effect on `open` too (with a same-commit-reopen guard to avoid a wasted request in the non-prefilled/calendar-entry flow).
- Bug fix (found via manual browser testing with the user, this session, higher severity): appointment times booked for e.g. "12:00" displayed at "15:00" (a UTC+3 shift). Root cause: `StartTime`/`EndTime` were mislabeled `DateTimeKind.Utc` (not converted, just relabeled) before persisting into a Npgsql-default `timestamp with time zone` column — Postgres stored/returned a genuine UTC instant, and the JSON `Z` suffix caused the frontend to correctly-per-JS-semantics localize it to the browser's Israel timezone. Fixed by making storage genuinely match the already-documented naive-local contract: `timestamp without time zone` column (explicit `HasColumnType`, migration using `AT TIME ZONE 'UTC'` for a deterministic, session-timezone-independent cast) + `DateTimeKind.Unspecified` throughout the write/compare path.
- Several additional fixes from an earlier code-review/security-review pass this same day (2026-07-20, see `PROGRESS.txt`): a matching timezone-comparison bug in `src/features/customer/selectors.ts` (`previousAppointment`/`nextAppointment`), a guaranteed-403 `TherapistsContext` fetch for Therapist-role users, narrowed exception handling in `GetIsraelLocalNow()`, removal of 5 tests that re-implemented controller logic instead of calling it, and doc comments on two unused repository methods.

## Deferred or Not Implemented

- Server-side enforcement of the active-package booking rule — **CR-032** (client-only today; a direct API call can bypass it).
- `TherapistWorkingHours`/`TherapistUnavailableDate`/`TherapistCapability` management APIs — stayed seed-only, per the originally-resolved Q4.
- Appointment status values beyond Scheduled/Cancelled, and any Appointment→Treatment link — per the originally-resolved Q2.
- `DateTimeOffset`/true-timezone-aware storage project-wide (CR-019) — this phase moved `Appointment.StartTime`/`EndTime` specifically to a consistent, correct naive-local convention, but did not adopt real timezone-aware storage; `Treatment.TreatmentDate`/`Payment.PaymentDate`/`Note.NoteDate`/`TherapistUnavailableDate.UnavailableDate` still carry the same underlying Kind-mismatch pattern at day granularity (FU-019, low priority, unchanged by this phase).

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Backend (xUnit, incl. Postgres integration) | 200 | 0 | Full `BeautyCareClinic.Tests` suite, run against live Postgres |
| Frontend (Vitest) | 306 | 0 | 24 test files, full suite |
| Frontend type-check (`tsc -b --noEmit`) | — | 1 pre-existing | `RecordPaymentModal.tsx` unused `currentUser` (FU-016), unrelated to this phase, not a new error |

## Manual Validation

- User booked appointments end-to-end from both the Customer Card and the Appointment Calendar screen; confirmed correct calendar-grid placement, therapist column, duration block, and immediate (no-reload) sync between the two entry points.
- User found and reported the "12:00 shows as 15:00" timezone bug directly while testing; reproduced, root-caused, fixed, and the user re-validated the exact scenario (booked 12:00 via the calendar, confirmed no shift) before approving.
- Final approval: user confirmed testing complete and approved commit + merge to `main`.

## Code Review

- Stale-fetch fix (`BookAppointmentModal`): 3 minor (P2/P3) findings — a wasted network call on reopen in the non-prefilled flow, `seriesLoading` not reset on close-mid-fetch, and a test-tightening suggestion. All fixed.
- Timezone fix (`AppointmentsController`/`AvailabilityService`/migration): 2 P1 findings (stale doc comments in `AppointmentDtos.cs` and `docs/DATABASE_SCHEMA.md` still describing the old, buggy `DateTimeKind.Utc` convention as current) and 1 P2 (missing regression test for the reschedule/Update path — only Create had one). All fixed.
- Earlier same-day pass (per `PROGRESS.txt`): architect-review + security-review completed on the initial Appointments backend implementation, with 5 P1–P3 findings all resolved (see PROGRESS.txt for detail — not reproduced here per the "concise conclusions" rule).

## Security Review

Completed in the earlier same-day pass referenced above (per `PROGRESS.txt`); no unresolved findings. This session's two follow-up fixes were both correctness/data-integrity bugs (stale UI state, timezone mislabeling), not security-sensitive, so a fresh security-reviewer pass was not re-run for them.

## Documentation Updated

- `docs/DOMAIN_MODEL.md` — active-package booking eligibility rule; naive-local Appointment convention already documented, refined during the timezone fix.
- `docs/WORKFLOWS.md` — booking workflow step 2 now describes the active-package restriction.
- `docs/API_SPECIFICATION.md` — `POST /customers/{customerId}/appointments` "Known gap" note for CR-032.
- `docs/DATABASE_SCHEMA.md` — corrected `Appointment.StartTime`/`EndTime`/`CreatedAt` Kind/column-type description.
- `backend/BeautyCareClinic.Application/DTOs/AppointmentDtos.cs` — XML doc comment corrected to match the fixed `Unspecified` behavior.
- `CHANGE_REQUESTS.md` — CR-032 opened.
- `PROJECT_STATUS.md` — synchronized (see separate update).

## Version

- Version: v0.12.0 (proposed — new backward-compatible feature, Minor per project versioning guidelines)
- Commit: pending
- Tag: pending

## Lessons Learned

- A frontend component that stays permanently mounted (visibility toggled by a prop, not conditional rendering) needs its data-fetching effects to depend on that visibility prop too, not just on the "what to fetch" id — otherwise reopening after external state changes (e.g. a purchase in another modal) serves stale data.
- "Naive local time" as a storage convention is only safe if enforced at every layer, including the database column type. Relabeling a `DateTime`'s `.Kind` without converting it, then persisting into a timezone-aware (`timestamptz`) column, silently corrupts the serialized value the moment it round-trips through a driver that takes `Kind` literally (Npgsql) — even though the in-memory digits never visibly change, which is why a naive `.Hour`-only regression test would not have caught it. The regression test needed to assert on `Kind` and on the actual serialized JSON shape, not just the numeric value.
- When an existing phase's approved acceptance criteria encode a convention that a later finding proves buggy (here: "all date/time writes use `DateTimeKind.Utc`"), fixing the bug means deliberately superseding that criterion rather than satisfying it — worth flagging explicitly in the phase summary rather than silently diverging from the approved plan.

## Deferred Requests

- CR-032 — server-side enforcement of active-package booking eligibility.
- FU-019 — day-granularity Kind-mismatch pattern in `Treatment`/`Payment`/`Note`/`TherapistUnavailableDate` dates (pre-existing, unrelated entities, out of scope for this phase).
- CR-019 — `DateTimeOffset`/full timezone-aware storage project-wide (remains deferred; this phase fixed Appointment-specific naive-local correctness only).
