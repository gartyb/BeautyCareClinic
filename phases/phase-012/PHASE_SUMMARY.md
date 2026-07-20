# Phase 012 — Therapist Management Backend Integration

## Status

Approved — Pending Commit

## Architecture Review

**Verdict:** Approve with required corrections.

**Approved as planned:** `User.IsActive` placement (Domain layer, default `true`) and generic scoping (not therapist-specific) — gating the deactivate action to `Role=Therapist` already scopes the behavior without a narrower column. No index on `(Role, IsActive)` — `Users` is too small a table to benefit; dropped from the plan entirely (was previously "optional"). Backward-compat claim on `GET /api/v1/therapists` verified against current consumers — genuinely non-breaking. No new lock/ADR needed for schedule-edit-vs-booking races — same accepted-risk class as Decision 1 (orphaned appointments), documented not engineered around. Scope sizing for one phase confirmed appropriate — do not split.

**Required corrections (all adopted, reflected in Scope/API Changes below):**
- **RC-1 (API namespace):** Working-hours/capabilities/unavailable-dates CRUD moved from `/users/{userId}/...` to `/therapists/{userId}/...`, living on the `/therapists` controller family (Phase 011's `TherapistAvailabilityController`), not `UsersController`. Reason: `UsersController` is Manager-only at the class level and carries PII; Phase 011 deliberately created a separate `/therapists` surface for both-roles read access — the original plan's `GET /users/{userId}/working-hours` ("any authenticated user") contradicted `UsersController`'s own class-level policy. GET = both roles, POST/PUT/DELETE = Manager-only per-action.
- **RC-2 (no new service layer):** Drop the "repository + service layer" language for the three CRUD families — that's not this project's convention for plain validated CRUD (cf. `NotesController`/`PaymentsController`/`TreatmentsController`: repository + inline controller validation, no service class). `AvailabilityService` stays the only service, extended only with the `IsActive` check — it exists because availability is genuine cross-entity logic, not because CRUD needs a service wrapper.
- **RC-3 (unavailable-date storage convention):** The new `POST .../unavailable-dates` write path must persist `Kind=Utc`, date-only — matching `AvailabilityService`'s existing query convention and `DbSeeder`'s existing writes (the FU-019 legacy pattern). Getting this wrong means new unavailable dates silently fail to block availability — flagged explicitly per the Phase 011 timezone-bug lesson.
- **RC-4 (deactivated-therapist login):** Explicit decision required, not left implicit — see Decision 7 below.
- **RC-5 (dual-context refresh):** `TherapistsContext` and `TherapistDataContext` hold separate state from separate endpoints; this phase must specify that create/update/deactivate/schedule mutations refresh both, or a deactivated therapist lingers in the booking picker until a full reload. See UI Changes.
- **RC-6 (request-shape correction):** `POST /users`'s actual existing shape is `{ fullName, email, password, phone }` — no `role` field (server hardcodes `Role=Therapist` for this creation path), `phone` exists and is currently required by the frontend though optional server-side. Original plan wrongly showed `role` in the body and omitted `phone`. Corrected in Scope below.

**ADR note (not a new ADR):** one clarifying sentence appended to ADR-011-A's scope (see `docs/DATABASE_SCHEMA.md`/`AppointmentsController.cs` comment, to be added during implementation): "Schedule edits (working hours / capabilities / unavailable dates) intentionally do not take the therapist's `User`-row lock and do not retroactively validate existing appointments; narrowing a therapist's availability can leave already-booked appointments outside the new constraints — same accepted-risk class as Decision 1." This keeps ADR-011-A's invariant scope unambiguous without minting a new decision.

**Remaining risks (beyond Risks section below):** a newly created therapist appears in booking pickers immediately but has zero working hours/capabilities configured, so every booking against them fails availability until a manager finishes setup — not a defect, worth a UX hint on `TherapistDetail`, not a blocking requirement. `DELETE /users/{id}`'s FK-restrict path must be confirmed during implementation to surface a clean Hebrew 409, not a raw 500.

## Goal

Close Phase 011's Q4 deferral and FU-008: implement full CRUD management for therapists — creation, working hours, treatment capabilities, unavailable dates — plus soft-deactivation for staff who have left the clinic. Enable a Manager to fully operate the "מטפלות" screen without a developer touching the database.

## Business Value

Operationally critical: therapists must be configurable (working hours, treatment capabilities, vacation days) through the app, and new therapists must be onboarded through the app. Today all of this is seed-only or mock-only, blocking real clinic use. This phase closes the loop on Phase 011's read-only availability exposure (`GET /api/v1/therapists/availability`) by adding the write/management APIs that Phase 011 explicitly deferred (Q4), and closes FU-008 (therapist creation still mock-only in the frontend). Also adds graceful handling of staff turnover via deactivation (not deletion, which would break referential integrity against existing appointments/treatments/notes).

## Scope

### Backend — Therapist Account CRUD

**Creation** (closes FU-008):
- `POST /api/v1/users` — existing endpoint (Phase 007/008), server hardcodes `Role=Therapist` for this path (no `role` in the request body). Actual request shape: `{ fullName, email, password, phone }` (`phone` exists server-side as optional; frontend currently requires it — reconcile during implementation so both agree). Response: created `User`. Wire the frontend to this instead of the current mock.

**Update:**
- `PUT /api/v1/users/{id}` — Manager-only, existing endpoint. Updates `fullName`/`email` only. Cannot change `IsActive` here.

**Deactivation (new — soft-delete):**
- `PUT /api/v1/users/{id}/deactivate` — Manager-only. Sets `IsActive = false`. Does not cascade to appointments/treatments/notes (they remain valid, orphaned).

**Hard delete (unchanged):**
- `DELETE /api/v1/users/{id}` — kept as-is (FK-restrict semantics unchanged). Manager's "no history, truly remove" path, distinct from deactivate.

### Backend — Therapist Working Hours Management (closes Q4)

All under the `/therapists` controller family (RC-1), not `UsersController` — GET is both-roles, writes are Manager-only per-action, consistent with Phase 011's `TherapistAvailabilityController`.

- `POST /api/v1/therapists/{userId}/working-hours` — Manager-only. `{ weekday: 0–6, startTime: "HH:MM"|null, endTime: "HH:MM"|null }`. Both null = day off.
- `PUT /api/v1/therapists/{userId}/working-hours/{weekday}` — Manager-only. Same body/validation. Upserts (replaces existing entry for that weekday).
- `DELETE /api/v1/therapists/{userId}/working-hours/{weekday}` — Manager-only.
- `GET /api/v1/therapists/{userId}/working-hours` — any authenticated user.

Validation: therapist must exist, be `Role=Therapist`, and be `IsActive=true` to edit; `startTime < endTime` when both non-null; one-null-one-not is a 422; no duplicate weekday rows (upsert semantics).

### Backend — Therapist Capability Management (closes Q4)

- `POST /api/v1/therapists/{userId}/capabilities` — Manager-only. `{ treatmentTypeId }`.
- `DELETE /api/v1/therapists/{userId}/capabilities/{treatmentTypeId}` — Manager-only.
- `GET /api/v1/therapists/{userId}/capabilities` — any authenticated user.

Validation: therapist exists/`Role=Therapist`/active; `TreatmentType` exists; no duplicate `(userId, treatmentTypeId)`.

### Backend — Therapist Unavailable Dates Management (closes Q4)

- `POST /api/v1/therapists/{userId}/unavailable-dates` — Manager-only. `{ date: "YYYY-MM-DD" }`. **Must persist `Kind=Utc`, date-only (RC-3)** — matching `AvailabilityService`'s existing query convention and `DbSeeder`'s existing writes; getting this wrong silently breaks availability blocking.
- `DELETE /api/v1/therapists/{userId}/unavailable-dates/{date}` — Manager-only.
- `GET /api/v1/therapists/{userId}/unavailable-dates` — any authenticated user.

Validation: therapist exists/`Role=Therapist`/active; valid date format; no duplicate dates per therapist.

### Backend — Modified Endpoints (deactivation-driven filtering)

- `GET /api/v1/therapists` — now always filters to `IsActive=true` (no query param; booking-safety default).
- `GET /api/v1/therapists/availability?includeInactive=false` — new optional param; `true` includes inactive therapists' schedules (manager edge cases only).
- `GET /api/v1/users?role=Therapist&includeInactive=false` — Manager-only; new optional param.
- `POST /api/v1/customers/{customerId}/appointments` — availability check now also requires therapist `IsActive=true` (422 if not).
- `PUT /api/v1/appointments/{id}` — same check when the therapist is changed during reschedule.

### Frontend — UI Changes

- `TherapistsContext.createTherapist` → wired to `POST /api/v1/users` (currently mock-only; FU-008).
- `TherapistsContext.updateTherapist`/`deleteTherapist` → wired to `PUT`/`DELETE /api/v1/users/{id}`.
- New API modules: `therapistWorkingHoursApi.ts`, `therapistCapabilityApi.ts`, `therapistUnavailableDatesApi.ts` (all call `/api/v1/therapists/{userId}/...` per RC-1).
- **RC-5:** create/update/deactivate (via `TherapistsContext`) and schedule mutations (via `TherapistDataContext`) must each trigger a refresh of *both* contexts — they hold separate state from separate endpoints (`GET /users?role=Therapist` vs `GET /therapists`), and without a coordinated refresh a deactivated therapist lingers in the booking picker until a full page reload. Not a full merge of the two contexts — just coordinated refresh.
- `TherapistModal` (creation) — add password field, Hebrew validation/error toasts.
- `TherapistDetail` (existing screen under `src/features/therapists/`) — wire Working Hours / Capabilities / Unavailable Dates sections to the new APIs (replacing local-state mutation), with loading states and Hebrew error toasts on save.
- Add a "בטל פעילות" (deactivate) action on `TherapistDetail`, Manager-only, visible only when the therapist is active; confirmation dialog before calling the endpoint.
- When viewing an inactive therapist, all edit controls (hours/capabilities/dates) become read-only.
- Booking/reschedule pickers need no frontend change — `GET /api/v1/therapists` already returns active-only, so inactive therapists disappear from selection automatically.
- Historical views (past appointments, Treatment History) keep showing the therapist's snapshotted name; optionally add a "לא פעילה" badge next to it (nice-to-have, not blocking).

## Out of Scope

- Therapist self-service (a therapist editing their own hours/capabilities) — Manager-only for this phase.
- Reactivation endpoint (`PUT /api/v1/users/{id}/reactivate`) — deferred; can be added later if a therapist returns.
- Soft-delete audit trail (who deactivated, when, why).
- Bulk operations (creating/deactivating multiple therapists at once).
- Notifications on creation/deactivation.
- An "orphaned appointments" dashboard/report for appointments left on a deactivated therapist.
- Cascading auto-cancellation of a deactivated therapist's future appointments (see Decision 1).

## User Workflows

**Creating a therapist (Manager):** מטפלות → "מטפלת חדשה" → fill name/email/password → save → `POST /api/v1/users` → appears in the active therapist list.

**Editing working hours / capabilities / unavailable dates (Manager):** מטפלות → select therapist → edit the relevant section → save → corresponding CRUD calls → success toast; errors (e.g. invalid time range) surface as Hebrew toasts inline.

**Deactivating a therapist (Manager):** מטפלות → select therapist → "בטל פעילות" → confirm → `PUT /api/v1/users/{id}/deactivate` → therapist removed from active list and from all future booking pickers; their past appointments/treatments/notes remain fully visible and intact, labeled with their name as before (optionally with a "לא פעילה" marker).

**Attempting to book/reschedule an inactive therapist directly via API:** rejected with 422, Hebrew reason ("המטפלת המבוקשת לא פעילה").

## Database Changes

- New column: `User.IsActive` (boolean, not null, default `true`). Migration adds the column; all existing users default to active.
- No new tables — `TherapistWorkingHours`, `TherapistCapability`, `TherapistUnavailableDate` already exist (seeded in Phase 011).
- No new index — `Users` is too small a table (a handful of managers + therapists) for a `(Role, IsActive)` index to beat a seq-scan; dropped per architecture review, not just deferred.

## Domain Changes

- `User` entity: add `IsActive` property, default `true`.
- `AvailabilityService.CheckAvailabilityAsync` (Phase 011 component): add a therapist-`IsActive` check alongside the existing working-hours/unavailable-date/capability/overlap checks.

## API Changes

Full endpoint list per Scope above. New DTOs: `TherapistWorkingHoursDto`, `TherapistCapabilityDto`, `TherapistUnavailableDateDto` (request/response shapes for the new CRUD), plus `IsActive` added to `UserDto`.

## UI Changes

- `TherapistModal` — password field added for creation.
- `TherapistDetail` — Working Hours / Capabilities / Unavailable Dates sections wired to real APIs; "בטל פעילות" action; read-only mode for inactive therapists.
- Booking/reschedule pickers — no code change needed (filtering happens API-side).
- Optional "לא פעילה" badge in historical views.

## Validation Rules

See per-endpoint validation under each Scope subsection above. Summary: all therapist-schedule mutations require the target to exist, be `Role=Therapist`, and be `IsActive=true`; all such endpoints are Manager-only; all errors surface in Hebrew.

## Main Implementation Components

**Backend:** migration for `User.IsActive`; `UsersController` deactivate action + `includeInactive` filtering; the three CRUD families added to `TherapistAvailabilityController`'s `/therapists` family (RC-1) using **repository + inline controller validation, no new service class** (RC-2 — this project's actual convention for plain CRUD, per `NotesController`/`PaymentsController`/`TreatmentsController`; `AvailabilityService` stays the only service, extended only with the `IsActive` check); DI registration in `Program.cs`.

**Frontend:** new `*Api.ts` modules for the three management resources; `TherapistsContext`/`TherapistDataContext` wired to real endpoints (replacing all remaining mock/local-state mutations); `TherapistModal`/`TherapistDetail` UI wiring with loading/error states.

## Testing Strategy

**Backend:** unit tests for validation logic (time-range, date format, duplicate prevention, active-check gating); Postgres integration tests (matching the `*ControllerPostgresTests.cs` convention) for full CRUD cycles on all three management resources, for deactivation's effect on filtering (`GET /api/v1/therapists` excludes, `?includeInactive=true` includes), for booking/reschedule rejecting an inactive therapist, for login rejecting an inactive therapist (Decision 6), and for `DELETE /users/{id}`'s FK-restrict path returning a clean Hebrew 409.

**Frontend:** unit tests for the new API client modules; component tests for `TherapistDetail`'s three management sections and the deactivate flow; confirm booking pickers exclude inactive therapists once the API returns active-only.

## Risks

- **Seed data / real GUIDs:** Phase 011's seeded `TherapistWorkingHours`/`TherapistCapability` rows are already keyed to real `User.Id`s (confirmed in Phase 011), so no re-seeding/backfill concern here — only the new `IsActive` column needs a default-true backfill for existing rows.
- **Batch frontend saves:** editing multiple working-hours rows or capabilities at once means multiple sequential/parallel API calls from one UI save action — needs a clear loading state and partial-failure handling (report which specific day/capability failed, not just a generic error).
- **Deactivation and appointments:** see Decision 1 below — deliberately not auto-cancelling future appointments is a real risk (a manager could deactivate a therapist and leave customers with unstaffed future appointments unless they separately check); documented, not solved by tooling in this phase.

## Dependencies

Phase 011 backend conventions (controllers, DTOs, repositories, `ICurrentUserService`, auth guards); Phase 011's `AvailabilityService`; existing seeded `TherapistWorkingHours`/`TherapistCapability`/`TherapistUnavailableDate` data; Postgres for integration tests.

## Open Questions — Resolved

**Decision 1 — Future appointments when a therapist is deactivated.** Resolved: left as-is (orphaned but historically valid, no auto-cancel, no automatic flagging). Rationale: auto-cancel would require customer-facing notification flows (out of scope); flagging would require new infrastructure; leaving it to manager judgment is the smallest, safest change. Accepted as a documented risk, not a defect.

**Decision 2 — Visibility of inactive therapists in read views.** Resolved: visible in historical records (past appointments, Treatment History, Notes) with their name as already snapshotted, optionally with a "לא פעילה" marker; hidden from all forward-looking selection (booking picker, reschedule-therapist picker, working-hours/capability edit screens default to active therapists). Rationale: preserves audit trail while preventing new bookings against someone no longer at the clinic.

**Decision 3 — `GET /api/v1/therapists/availability` filtering.** Resolved: active-only by default, `?includeInactive=true` as a manager escape hatch (e.g. reviewing a departed therapist's historical schedule). Not a breaking change — no `IsActive` concept existed before this phase, so today's callers already only see "active" (the only kind that existed).

**Decision 4 — Therapist self-service vs. Manager-only.** Resolved: Manager-only for this phase. The existing "מטפלות" screen is already Manager-gated (per `PROJECT_STATUS.md`'s documented permission model: "Only managers can access therapist management..."), so this preserves the existing access model rather than introducing a new one. Therapist self-service is a plausible future phase, not this one.

**Decision 5 — Hard-delete vs. soft-delete for therapist accounts.** Resolved: both exist, serving different purposes. `PUT .../deactivate` (new) is the primary path for a therapist who left with real history. `DELETE /api/v1/users/{id}` (unchanged) stays a true hard-delete, still blocked by FK-restrict if the therapist has any appointments/treatments/notes — useful only for a genuine mistake/duplicate account with no history.

**Decision 6 (RC-4) — Deactivated-therapist login.** Resolved: `AuthController.Login` rejects authentication when the domain `User.IsActive == false`, even though the Identity (`AppUser`) record still exists and the password is still valid. Rationale: `IsActive=false` means "no longer at the clinic" — a departed therapist retaining a working JWT until natural 24h expiry is a real access-control gap, not just a booking-UX concern; blocking login is the safer default and a small, contained addition to the existing login path (same 401 shape as an unknown/wrong-password login, to avoid a distinct signal that would leak account-status information — consistent with CR-022's login-timing concern, though CR-022 itself stays out of scope here).

## Acceptance Criteria

### Backend
- [x] `User.IsActive` added via migration, default `true`, existing rows backfilled to `true`.
- [x] `PUT /api/v1/users/{id}/deactivate` — Manager-only, 422 for non-Therapist or already-inactive target, 200 with `isActive:false` on success.
- [x] Working-hours CRUD (`POST`/`PUT`/`DELETE`/`GET` under `/therapists/{userId}/working-hours`, RC-1) implemented with full validation, no new service class (RC-2).
- [x] Capability CRUD (`POST`/`DELETE`/`GET` under `/therapists/{userId}/capabilities`, RC-1) implemented with full validation.
- [x] Unavailable-date CRUD (`POST`/`DELETE`/`GET` under `/therapists/{userId}/unavailable-dates`, RC-1) implemented with full validation; writes use `Kind=Utc` date-only (RC-3).
- [x] `GET /api/v1/therapists` filters to active-only.
- [x] `GET /api/v1/therapists/availability` supports `?includeInactive`.
- [x] `GET /api/v1/users?role=Therapist` supports `?includeInactive` (Manager-only).
- [x] `POST /api/v1/users` request shape corrected to `{ fullName, email, password, phone }`, no `role` field (RC-6).
- [x] Appointment create/reschedule reject an inactive therapist with 422 + Hebrew reason.
- [x] `AuthController.Login` rejects an inactive therapist's login (Decision 6 / RC-4), same 401 shape as unknown-user/wrong-password.
- [x] Existing appointments/treatments/notes remain fully queryable regardless of the linked therapist's active status.
- [x] All new/modified endpoints Manager-only where specified (GET on `/therapists/{userId}/...` is both-roles per RC-1), all validation errors in Hebrew.
- [x] `DELETE /api/v1/users/{id}` FK-restrict violation confirmed to return a clean Hebrew 409, not a raw 500.

### Frontend
- [x] `TherapistsContext.createTherapist`/`updateTherapist`/`deleteTherapist` wired to the real API (FU-008 closed).
- [x] `TherapistDetail`'s working-hours/capabilities/unavailable-dates sections wired to the real API, with loading and Hebrew error states.
- [x] "בטל פעילות" action added, Manager-only, visible only for active therapists.
- [x] Inactive-therapist detail view is read-only.
- [x] Booking/reschedule pickers verified to exclude inactive therapists (via the API filter — no frontend logic needed, but must be tested).
- [x] `TherapistsContext` and `TherapistDataContext` both refresh after create/update/deactivate/schedule mutations (RC-5) — no stale picker after deactivation without a full reload.
- [x] `tsc -b --noEmit` — no new errors beyond the pre-existing, unrelated FU-016.

### Testing
- [x] Backend unit tests for all new validation rules.
- [x] Backend Postgres integration tests for full CRUD cycles on all three management resources, deactivation's filtering effects, and booking/reschedule rejection of inactive therapists.
- [x] Frontend unit tests for the new API client modules.
- [x] Frontend component tests for the `TherapistDetail` management sections, `TherapistModal` creation flow, and deactivate flow.

### Docs
- [x] `docs/DOMAIN_MODEL.md` — therapist management rules, `IsActive`, deactivation semantics, orphaned-appointment note.
- [x] `docs/API_SPECIFICATION.md` — all new/modified endpoints.
- [x] `docs/DATABASE_SCHEMA.md` — `User.is_active` column.
- [x] `docs/WORKFLOWS.md` — therapist creation, schedule/capability management, and deactivation workflows.

## Implemented

- `User.IsActive` (migration + backfill), `PUT /api/v1/users/{id}/deactivate`, `?includeInactive` filtering on `GET /users`/`GET /therapists/availability`, active-only default on `GET /therapists`.
- Full CRUD for working hours, capabilities, and unavailable dates under `/api/v1/therapists/{userId}/...` (RC-1), repository + inline controller validation (RC-2, no new service class), `AvailabilityService` extended with the therapist-`IsActive` check (`AvailabilityCheckResult.IsValidationFailure` distinguishing 422 validation failures from 409 scheduling conflicts — a real ambiguity in the approved plan, resolved and documented inline).
- Unavailable-date writes use `Kind=Utc`, date-only (RC-3), matching `AvailabilityService`'s existing query convention.
- `POST /api/v1/users` request shape corrected to match reality (RC-6): `{ fullName, email, password, phone }`, no `role` field.
- `AuthController.Login` rejects a deactivated therapist with the same 401 shape as wrong-password/unknown-email (Decision 6 / RC-4).
- Frontend: `TherapistsContext.createTherapist`/`updateTherapist`/`deleteTherapist`/`deactivateTherapist` wired to the real API; new `therapistWorkingHoursApi.ts`/`therapistCapabilityApi.ts`/`therapistUnavailableDatesApi.ts`; `TherapistModal` gained a password field; `TherapistDetail` wired to all three management resources with loading/Hebrew-error states, a "בטל פעילות" action, and read-only rendering for inactive therapists; `TherapistsContext`/`TherapistDataContext` cross-refresh via `therapistRefreshBus.ts` (RC-5).

### Bugs found via manual testing and fixed within this phase (not part of the original approved scope, but the same class of defect the plan's own Testing Strategy was meant to catch)

- **`TherapistDetail` blank on fresh page load.** The Contact Info and Working Hours sections stayed empty on a direct/fresh navigation to a therapist's detail page — the seeding effect fired once on mount but never retried once `TherapistsContext`'s async fetch resolved. Fixed with a ref-guarded re-seed (same pattern as the `BookAppointmentModal` fix from Phase 011's validation).
- **Working hours appearing not to save (user-reported).** A second, more subtle instance of the same bug class: the first fix above only waited for `TherapistsContext`'s `therapist` to resolve, not for the *separate* `TherapistDataContext`'s `workingHours` fetch. Since the two contexts load independently, `therapist` could resolve first, seeding the form with a still-empty `workingHours` array and permanently locking in "all days off" — even though the save itself always succeeded correctly server-side (verified directly against the DB via `curl` during investigation: the reported "not saving" was 100% a frontend read/race bug, zero data loss). Fixed by additionally gating the seed on `TherapistDataContext.isLoading`.

## Deferred or Not Implemented

Per the plan's original Out of Scope: reactivation endpoint (`PUT /api/v1/users/{id}/reactivate`), therapist self-service, soft-delete audit trail, bulk operations, notifications on creation/deactivation, an orphaned-appointments dashboard/report, cascading auto-cancellation of a deactivated therapist's future appointments. All still explicitly out of scope, unchanged.

`FU-020` (new, logged during implementation): `UsersController.Create`/`Update`'s pre-existing (Phase 007/008) validation error messages are in English, inconsistent with the rest of the API's Hebrew errors. Previously unreachable in practice since `TherapistsContext` never called the real endpoint; this phase is what makes it user-visible for the first time (e.g. a duplicate-email error while creating a therapist). Flagged, not fixed — out of this phase's approved scope.

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Backend (xUnit, incl. Postgres integration) | 232 | 0 | Full `BeautyCareClinic.Tests` suite, run independently against live Postgres |
| Frontend (Vitest) | 339 | 0 | 30 test files, full suite, run independently |
| Frontend type-check (`tsc -b --noEmit`) | — | 1 pre-existing | `RecordPaymentModal.tsx` unused `currentUser` (FU-016), unrelated, not new |

## Manual Validation

Extensive live browser testing (not just automated suites) against the running app, covering every RC/Decision item directly:

- Working hours and capabilities edited live, confirmed real `POST`/`PUT` calls to the correct `/therapists/{id}/...` routes (RC-1), confirmed persistence across a full reload.
- New therapist created with the password field (RC-6); appeared in both the management list and the booking picker immediately, no reload needed (RC-5 cross-refresh confirmed via network log).
- Deactivation flow: confirmation dialog → "לא פעילה" badge → read-only detail view → excluded from `GET /api/v1/therapists` (confirmed via direct response inspection).
- Login blocked for a deactivated therapist, generic 401 message matching an unknown-email/wrong-password failure (Decision 6 / RC-4).
- User independently found the working-hours "not saving" bug through their own testing; reproduced, root-caused (via direct `curl`/DB inspection proving no data was actually lost), fixed, and re-verified against the user's exact scenario.
- User validated the fix and approved the phase.

## Code Review

No separate code-reviewer pass was run for this phase's two live-testing bug fixes (the `TherapistDetail` seeding race and its follow-up) — both were investigated and fixed directly against live, reproducible evidence (network inspection, direct API/DB queries) rather than static review, consistent with how the equivalent Phase 011 stale-fetch bugs were handled. The original implementation (all CRUD endpoints, deactivation, login gate) was built directly against the architecture-reviewed plan with RC-1 through RC-6 implemented and independently spot-checked in code by the calling session before manual validation began.

## Security Review

Not separately re-run for this phase. The login-gate addition (Decision 6/RC-4) was reasoned through explicitly during architecture review and implemented exactly as specified (same 401 shape, no account-status disclosure) — spot-checked directly in code. No other security-sensitive surface was introduced beyond what the architecture review already covered.

## Documentation Updated

- `docs/DOMAIN_MODEL.md`, `docs/API_SPECIFICATION.md`, `docs/DATABASE_SCHEMA.md`, `docs/WORKFLOWS.md` — updated per the Acceptance Criteria → Docs checklist.
- `CHANGE_REQUESTS.md` — FU-020 logged (see FOLLOWUPS.md).
- `PROJECT_STATUS.md` — synchronized (see separate update).

## Version

- Version: v0.13.0 (proposed — new backward-compatible feature, Minor per project versioning guidelines)
- Commit: pending
- Tag: pending

## Lessons Learned

- A component that reads from two independent, asynchronously-loading contexts must gate its one-time seeding effect on *both* contexts having settled, not just the one that happens to resolve first in testing. The bug was invisible during initial development/review because both contexts were usually already warm from prior navigation; it only surfaced on a genuinely fresh load — exactly the scenario a real user hits on their first visit each session.
- When investigating a "data isn't saving" report, verify the actual persisted state (DB/API) before assuming the write path is broken — here the write path was correct throughout, and confirming that early (via direct `curl` and DB inspection) immediately narrowed the investigation to the read/render side, saving significant time versus re-auditing the save logic.
- Architecture review can surface a genuine internal contradiction in its own approved plan (here: RC-2's "no new service, minimal surface" vs. the Acceptance Criteria's explicit 422 requirement, which the pre-existing service-layer pattern would have produced as 409) — worth resolving deliberately and documenting the resolution inline, rather than silently picking one interpretation.

## Deferred Requests

- FU-020 — English validation messages in `UsersController.Create`/`Update` (newly user-visible via this phase; not fixed, out of scope).
- Reactivation endpoint, self-service, audit trail, bulk ops, notifications, orphaned-appointments dashboard — all remain deferred per the plan's Out of Scope.
