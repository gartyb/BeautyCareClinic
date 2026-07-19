# Phase 010 — Treatment Recording & Notes

## Status

Completed

## Goal

חיבור רישום ביצוע טיפולים (טיימר וכמותי) ומודול הערות לב-Backend. סגירת כל המידע ה-mock הנותר ב-Customer Card — Treatment History ו-Notes עוברים ל-API אמיתי.

## Planned

### Backend — 9 endpoints חדשים

**Treatment** (4 endpoints)
- `GET /api/v1/customers/{customerId}/treatments` — היסטוריה לפי לקוח (Auth)
- `GET /api/v1/treatments/{id}` — יחיד (Auth)
- `POST /api/v1/customers/{customerId}/treatments` — יצירה + עדכון Series באטומיות (Auth)
- `DELETE /api/v1/treatments/{id}` — מחיקה + ביטול עדכון Series (Author / Manager)

**Note** (5 endpoints)
- `GET /api/v1/customers/{customerId}/notes` — רשימה לפי לקוח (Auth)
- `GET /api/v1/notes/{id}` — יחיד (Auth)
- `POST /api/v1/customers/{customerId}/notes` — יצירה (Auth)
- `PUT /api/v1/notes/{id}` — עריכה (Author / Manager)
- `DELETE /api/v1/notes/{id}` — מחיקה (Author / Manager)

### Backend — Business Logic

**רישום טיפול:**
- טיימר: `TreatmentSeries.UsedMinutes += durationMinutes`, מוגבל ב-`TotalMinutes`
- כמותי: `TreatmentSeries.CompletedTreatments += 1`, מוגבל ב-`TotalTreatments`
- `TreatmentSeriesId` — nullable (תמיכה בטיפול standalone)
- `userId` — מ-JWT בלבד (`ICurrentUserService`), לא מהלקוח
- הכל בטרנזקציה אחת

**מחיקת טיפול:**
- ביטול עדכון ה-Series (decrement, clamp ≥ 0)
- רק author או Manager
- בטרנזקציה אחת

**הערות:**
- יצירה: `userId` מ-JWT
- עריכה/מחיקה: author או Manager בלבד

### Backend — מה לא חדש

- אין טבלאות חדשות — `Treatment`, `Note` קיימים בדומיין ובמיגרציות
- אין שינוי Domain entities
- migration חדשה רק אם מיפויים חסרים ב-AppDbContext

### Frontend — Wire-up

- `treatmentsApi.ts`, `notesApi.ts` — modules חדשים
- `src/types/Treatment.ts`, `src/types/Note.ts` — התאמה ל-API (הסרת mock fields)
- `TreatmentHistoryTab.tsx` — API במקום mock
- `ActiveSeriesTab.tsx` — חיבור timer/quantity לـ POST
- `NotesTab.tsx` — חדש, CRUD מלא
- `NoteModal.tsx` — חדש, Add/Edit
- `RecordTreatmentModal.tsx` — עדכון/חדש

## Out of Scope

- Treatment Photos — Phase 011
- Appointments backend — Phase 011
- DateTime → DateTimeOffset (CR-019) — Phase 011+
- Soft-delete / audit trail on delete — Phase 011+

## Open Questions

- Q1 (סגורה): Standalone treatments — כלול, nullable `treatmentSeriesId`
- Q2 (סגורה): Note author avatar — לא, שם + תאריך בלבד
- Q3 (סגורה): Note attachment on treatment — לא, Notes tab נפרד
- Q4 (סגורה): Timezone — DATE type, UTC+2 implicit, אין המרה

## Acceptance Criteria

### Backend — Treatments
- [ ] `GET /customers/{id}/treatments` מחזיר ממוין לפי תאריך DESC
- [ ] `POST` יוצר Treatment + מעדכן Series באטומיות
- [ ] טיימר: `UsedMinutes` מצטבר, מוגבל ב-`TotalMinutes`
- [ ] כמותי: `CompletedTreatments` מצטבר, מוגבל ב-`TotalTreatments`
- [ ] Standalone (null seriesId): נוצר ללא עדכון Series
- [ ] `durationMinutes ≤ 0` → 422
- [ ] `treatmentDate > today` → 422
- [ ] `DELETE` מחזיר Series אחורה (decrement)
- [ ] `DELETE` על ידי therapist אחר → 403
- [ ] `DELETE` על ידי Manager → 204

### Backend — Notes
- [ ] `GET /customers/{id}/notes` ממוין לפי תאריך DESC
- [ ] `POST` יוצר עם `userId` מ-JWT
- [ ] `content` ריק / > 5000 תווים → 422
- [ ] `noteDate > today` → 422
- [ ] `treatmentTypeId` אופציונלי; אם קיים — חייב להיות תקין (404)
- [ ] `PUT` — author/manager בלבד (403 אחרת)
- [ ] `DELETE` — author/manager בלבד (403 אחרת)

### Frontend — Treatments
- [ ] Treatment list מגיע מ-API (לא mock)
- [ ] Timer recording: elapsed → durationMinutes → POST
- [ ] Quantity marking: POST → Series progress מתעדכן
- [ ] Success: treatment מופיע בהיסטוריה
- [ ] Error: toast בעברית
- [ ] Delete: confirm dialog → DELETE → Series reversals
- [ ] Therapist לא רואה כפתור מחיקה על treatments של therapist אחר

### Frontend — Notes
- [ ] Notes tab מגיע מ-API (לא mock)
- [ ] הוספה/עריכה/מחיקה עובדים דרך API
- [ ] Edit/Delete מוסתרים מ-therapist על הערות של אחרים
- [ ] שם author + תאריך מוצגים
- [ ] Loading skeletons + error toasts בעברית

### UI & Build
- [ ] `tsc --noEmit` ללא שגיאות
- [ ] `npm run build` ללא שגיאות
- [ ] כל UI חדש RTL + עברית

### Testing
- [ ] ≥ 12 backend unit tests לטיפולים + הערות
- [ ] ≥ 8 frontend unit tests ל-API modules + services

## Architecture Review

**סטטוס:** הושלם — ממתין לאישור משתמש

### מה אושר

- צורת endpoints תואמת Phase 008–009 (`/api/v1/customers/{id}/…` + `/api/v1/{resource}/{id}`)
- `userId` מ-JWT בלבד (`ICurrentUserService`) — עקבי עם Phase 009 Payments
- עסקה אחת ל-Treatment create/delete + Series update — תואם `CustomerOrdersController.Create`
- Clamp-not-error על Series over-cap — עקבי עם frontend
- `ExceptionHandlingMiddleware` reuse — ממשיך convention קיים
- אין migration חדשה לטבלאות (Treatment/Note קיימים) — רק לאורך Content

### תיקונים נדרשים (RC)

**RC-1 — `Note.Content` חסר הגבלת אורך ב-EF/DB**
DB מגדיר `text` ללא `HasMaxLength`. ה-5000 cap נאכף רק בcontroller.
**החלטה:** הוסף `.HasMaxLength(5000).IsRequired()` ב-`AppDbContext.OnModelCreating` + migration קטנה `Phase010NoteContent`.

**RC-2 — Race condition על Series — חובה `SELECT FOR UPDATE`**
שני therapists מקליטים טיפול על אותה Series במקביל → lost update. "טרנזקציה אחת" לא מספיקה ללא row-level lock.
**החלטה:** אותו pattern של Phase 009 Payment: `SqlQueryRaw<Guid>("SELECT \"Id\" FROM \"TreatmentSeries\" WHERE \"Id\" = {0} FOR UPDATE", treatmentSeriesId)` לפני קריאת ה-Series. לא נדרש ב-standalone (null seriesId).

**RC-3 — Author/Manager permission pattern חדש — חייב convention מוגדר**
אין controller קיים שמממש "author or Manager". ייווצר duplicate across 4 endpoints.
**החלטה:** Helper על `ICurrentUserService` או controller base:
```csharp
if (entity.UserId != currentUserId && !isManager) return Forbid(); // 403, לא 404
```
לא `IAuthorizationRequirement` — over-engineering.

**RC-4 — Frontend types מתנגשות עם backend DTOs**
`src/types/Treatment.ts` משתמש ב-`therapistId`, `notes`. `src/types/Note.ts` משתמש ב-`authorUserId`, `text`, `createdDate`. Backend יחזיר `userId`, `content`, `noteDate`.
**החלטה:** עדכן frontend types ל-backend-shape: `userId`, `content`, `noteDate`. `Treatment.notes` (string legacy) — ראה שאלת מוצר Q1.

**RC-5 — Treatment History צריך גם series שהסתיימו**
`TreatmentSeriesController` מחזיר רק active series. History tab צריך גם completed series.
**החלטה:** Treatment DTO יכלול `packageTypeName` (JOIN אחד) כך שה-tab לא תלוי ב-series list. לא מוסיפים endpoint חדש ל-series.

**RC-6 — DTO לא יקבל `userId` מהלקוח**
`CreateTreatmentRequest` / `CreateNoteRequest` לא יכולים להכיל `userId`.
**החלטה:** DTO במפורש ללא שדה `userId`. תמיד server-derived.

**RC-7 — `noteDate` / `treatmentDate` — DateOnly, לא DateTime**
"Today" UTC vs Israel time בעיה בחצות. Phase 009 Payment כבר פותר עם `DateOnly.FromDateTime(DateTime.UtcNow)`.
**החלטה:** שניהם `DateOnly` בDTO + comparison. אותו pattern כמו `PaymentDate` ב-Phase 009.

**RC-8 — Standalone treatment delete: אין series לעדכן**
**החלטה:** אם `TreatmentSeriesId == null` — מחק treatment בלי עדכון series. תועד בקוד.

### ADRs נדרשים

- **ADR-010-A** — Row-level lock כ-convention: כל read-modify-write על aggregate root (`CustomerOrders`, `TreatmentSeries`) מחייב `SELECT FOR UPDATE`. מונע lost update עם Read Committed.
- **ADR-010-B** — Author-or-Manager pattern: 403 inside action לאחר load entity, helper method, לא `IAuthorizationRequirement`.

### החלטות מוצר (אושרו ע"י המשתמש)

- **Q1 (RC-4) — Notes דו-רמתי:** קיימות הערות ברמת Treatment (שדה `notes` על Treatment) וגם ברמת Customer (entity `Note` נפרד). שניהם נשמרים.
  - `Treatment.Notes` — עמודת טקסט nullable על Treatment (backend + DB)
  - `Note` entity — entity נפרד עם CRUD מלא, כפי שתוכנן
- **Q2 (R3) — Snapshot שם:** כן. `PerformedByFullName` על Treatment ו-`WrittenByFullName` על Note — אותו pattern כמו `RecordedByFullName` על Payment.

### סיכום שינויים לסקופ

תוספות:
- Migration `Phase010TreatmentNotes`:
  - `Note.Content` MaxLength(5000) (RC-1)
  - Treatment: עמודות `Notes` (text, nullable) + `PerformedByFullName` (string)
  - Note: עמודה `WrittenByFullName` (string)
- `SELECT FOR UPDATE` על TreatmentSeries בcreate + delete (RC-2)
- Helper `EnsureAuthorOrManager` ב-ICurrentUserService (RC-3)
- `packageTypeName` ב-TreatmentDto (RC-5)
- DTO ללא `userId` מהלקוח (RC-6)
- DateOnly לתאריכים (RC-7)

## Implemented

### Backend

- `Treatment.cs` — `Notes` (nullable text), `PerformedByFullName` (snapshot string)
- `Note.cs` — `WrittenByFullName` (snapshot string)
- `AppDbContext.cs` — EF mappings for new columns; `Note.Content` MaxLength(5000)
- Migration `Phase010TreatmentNotes` — adds 3 new columns; alters Content to varchar(5000)
- `ITreatmentRepository` + `TreatmentRepository` — CRUD with TreatmentType eager load
- `INoteRepository` + `NoteRepository` — CRUD with TreatmentType eager load
- `TreatmentDtos.cs` — `CreateTreatmentRequest`, `TreatmentDto`
- `NoteDtos.cs` — `CreateNoteRequest`, `UpdateNoteRequest`, `NoteDto`
- `TreatmentsController` — 4 endpoints: GET list, GET by id, POST (with SELECT FOR UPDATE + series update), DELETE (with series reversal + author/manager guard)
- `NotesController` — 5 endpoints: GET list, GET by id, POST, PUT, DELETE (author/manager guard on PUT/DELETE)
- `Program.cs` — DI registrations for both repositories
- `Phase010Tests.cs` — 21 backend unit tests

### Frontend

- `src/types/Treatment.ts` — backward-compatible: added `userId`, `performedByFullName`, `treatmentTypeName`
- `src/types/Note.ts` — backward-compatible: added `content`, `userId`, `writtenByFullName`, `noteDate`, `treatmentTypeName`
- `src/api/treatmentsApi.ts` — new API module
- `src/api/notesApi.ts` — new API module
- `src/api/index.ts` — exports for new API modules and request types
- `src/features/customer/tabs/TreatmentHistoryTab.tsx` — `getTherapistName` helper supports both mock and API data
- `src/features/customer/tabs/NotesTab.tsx` — full rewrite with CRUD, role-based visibility, Hebrew error messages
- `src/features/treatment/apiTreatmentTests.test.ts` — 20 frontend unit tests

## Deferred or Not Implemented

- `ActiveSeriesTab.tsx` — timer/quantity buttons still call mock-data functions in `CustomerContext` (`recordTimerTreatment`, `recordQuantityTreatment`). Real API call via `treatmentsApi.create` deferred pending CustomerContext API integration (Phase 011 or separate CR).
- `TreatmentModal.tsx` — `updateTreatmentNote` still operates on in-memory mock data. Treatment notes via API deferred.
- Treatment delete in `TreatmentHistoryTab` — UI delete button not yet wired (Phase 011).
- Loading skeletons and toast error notifications — deferred (Phase 011).

## Database Changes

אין טבלאות חדשות — entities קיימים. migration אם מיפויים חסרים.

## API Changes

9 endpoints חדשים — ראה Planned.

## UI Changes

---

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Backend (xUnit) | 105 | 0 | 21 new in Phase010Tests.cs |
| Frontend (Vitest) | 274 | 0 | 20 new in apiTreatmentTests.test.ts |

## Manual Validation

- בדיקה ידנית בוצעה על ידי המשתמש
- Phase אושר

## Code Review

- בוצע במהלך implementation
- FU-010 עד FU-013 תועדו ב-FOLLOWUPS.md — מתוכננים ל-Phase 011

## Security Review

- RC-2 (race condition על Series) — יושם עם SELECT FOR UPDATE
- RC-3 (Author/Manager pattern) — יושם כ-helper
- RC-6 (DTO ללא userId) — יושם
- FU-014 (PackageTypesContext) — תוקן במסגרת Phase 010

## Documentation Updated

- `docs/API_SPECIFICATION.md` — 9 endpoints חדשים
- `docs/DATABASE_SCHEMA.md` — Treatment columns + Note columns
- `PROJECT_STATUS.md`

## Version

- Version: v0.10.0
- Tag: v0.10.0

## Lessons Learned

- `SELECT FOR UPDATE` נדרש על כל read-modify-write של aggregate root — נוסף כ-ADR-010-A
- Author-or-Manager pattern חוזר ב-4 endpoints — helper method מוסיף בהירות וממנע דוקו

## Deferred Requests

- FU-010: ActiveSeriesTab — timer/quantity buttons עדיין mock
- FU-011: TreatmentModal — updateTreatmentNote עדיין mock
- FU-012: TreatmentHistoryTab — חסר כפתור מחיקה
- FU-013: Loading skeletons + toast notifications

## Maintenance Patch — v0.10.1 (bug fix, within Phase 010 lineage)

**Status:** Implemented, tested, validated by the user in the browser, committed and tagged.

### Bug

On first login, the customer search screen ("חיפוש לקוחה") showed a stuck error banner
("שגיאה בטעינת הנתונים. נסה שוב.") even though the backend had valid data and the API worked
correctly. Root cause: `CustomersProvider`, `TreatmentTypesProvider`, `PackageTypesProvider`,
and `GlobalSettingsProvider` each fired their initial data fetch unconditionally on mount
(`useEffect(() => { fetchX(); }, [fetchX])`), before `AuthProvider` had restored a session or
before login had completed. The resulting 401 was captured as a permanent `error` state that
never re-cleared after a successful login, because the fetch effect had no dependency on auth
state. (`TherapistDataContext`, `TherapistsContext`, and `AppointmentsContext` were checked for
the same pattern and confirmed unaffected — they use local seed data only, no API fetch.)

### Fix

Each of the four affected providers now calls `useAuth()` and gates its fetch effect on
`currentUser`: while unauthenticated the effect skips the fetch (and clears `isLoading`); once
`currentUser` transitions from `null` to a real user — covering both session-restore-on-reload
and fresh login — the effect (re)fires. A `cancelled`-flag guard (matching the pattern already
used in `GlobalSettingsContext`) was added to all four providers' gated effects so a stale
in-flight request from a prior auth state (e.g. logout → re-login) cannot resolve late and
clobber newer state.

### Regression test

`src/contexts/authGatedFetch.test.tsx` (new) renders `CustomersProvider` and
`TreatmentTypesProvider` unauthenticated, asserts zero `fetch` calls and no error state while
logged out, then drives a real `AuthContext.login()` transition and asserts the fetch fires and
real data loads with no error — exercising the actual race that was broken rather than only the
already-authenticated path. `src/test/renderWithProviders.tsx` gained an `authenticated?: boolean`
option (default `true`, existing callers unaffected) to support this; `src/test/setup.ts` gained
a `POST /auth/login` mock response and an `afterEach(() => clearToken())` for test isolation.

### Files changed

- `src/contexts/CustomersContext.tsx`
- `src/contexts/TreatmentTypesContext.tsx`
- `src/contexts/PackageTypesContext.tsx`
- `src/contexts/GlobalSettingsContext.tsx`
- `src/test/renderWithProviders.tsx`
- `src/test/setup.ts`
- `src/contexts/authGatedFetch.test.tsx` (new)

### Verification

- `npx vitest run --config vitest.config.ts` — 276 passed, 0 failed (274 baseline + 2 new).
- `npm run build` / `npx tsc -b --noEmit` — one pre-existing, unrelated error
  (`RecordPaymentModal.tsx` unused `currentUser` param, logged as `FOLLOWUPS.md` FU-016);
  no new errors introduced.
- Manual browser validation performed by the user.

### Version

- Version: v0.10.1 (patch — backward-compatible bug fix, no new phase)
- Tag: v0.10.1 (branch `fix/auth-gated-data-fetch`, merged to `main`)

## Maintenance Patch — v0.10.2 (bug fix, within Phase 010 lineage)

**Status:** Implemented, tested, validated by the user in the browser.

### Bug

`POST /api/v1/customers/{customerId}/orders` (order creation) always failed with HTTP 500,
regardless of customer or package selected — blocking the "הזמנה חדשה" flow entirely.

### Root cause

Migration drift. `TreatmentSeries.CustomerId` (Domain entity, Fluent config, and the EF model
snapshot) was added in the Phase 010 commit (`ce37844`) and `CustomerOrdersController.Create`
actively sets it on every new `TreatmentSeries` row — but the Phase 010 migration
(`20260717160005_Phase010TreatmentNotes`) never emitted the corresponding `AddColumn` for it.
`__EFMigrationsHistory` listed all migrations as applied, so EF believed the schema was current
when the physical Postgres table structurally wasn't — every INSERT into `TreatmentSeries` threw
`42703: column "CustomerId" of relation "TreatmentSeries" does not exist`. Invisible to the
existing test suite because all prior tests use the EF InMemory provider, which never touches a
real schema or runs real migrations.

### Fix

New migration `20260719085129_AddTreatmentSeriesCustomerId`: `AddColumn<Guid> CustomerId`
(uuid, not null) → backfill via `UPDATE ... FROM "OrderItems" JOIN "CustomerOrders"` (walks
`OrderItem → CustomerOrder → CustomerId` for any pre-existing rows; a no-op on an empty table) →
`CreateIndex IX_TreatmentSeries_CustomerId` → `AddForeignKey FK_TreatmentSeries_Customers_CustomerId`
(`ON DELETE RESTRICT`, consistent with every other Customer-referencing FK in this schema).
Applied to the dev DB via `dotnet ef database update`; verified via direct SQL that the column,
index, and FK now exist and that pre-existing rows backfilled correctly.

As a prerequisite for regression coverage, also fixed an unrelated pre-existing compile error
(`Phase010Tests.cs:592`, `DateOnly`/`DateTime` mismatch, tracked as FU-015) that had been
blocking the entire `BeautyCareClinic.Tests` project from building.

### Regression test

`backend/BeautyCareClinic.Tests/Integration/CustomerOrdersControllerPostgresTests.cs` (new) —
opens a real Npgsql `AppDbContext`, runs `Database.MigrateAsync()`, calls
`CustomerOrdersController.Create` against self-contained seed data, and asserts both a 201
response and (via an untracked read straight from Postgres) that the persisted
`TreatmentSeries.CustomerId` is correct. Proven genuine by temporarily reverting the schema and
confirming the test fails with the same `42703` error class as the original bug, then passes
again after restoring the fix. Requires a reachable Postgres via the
`ConnectionStrings__DefaultConnection` env var (same variable used by the EF CLI tooling).

### Files changed

- `backend/BeautyCareClinic.Infrastructure/Migrations/20260719085129_AddTreatmentSeriesCustomerId.cs` (new)
- `backend/BeautyCareClinic.Infrastructure/Migrations/20260719085129_AddTreatmentSeriesCustomerId.Designer.cs` (new)
- `backend/BeautyCareClinic.Tests/Application/Phase010Tests.cs` (FU-015 one-line fix)
- `backend/BeautyCareClinic.Tests/Integration/CustomerOrdersControllerPostgresTests.cs` (new)
- `docs/DATABASE_SCHEMA.md` (documented the FK + denormalization rationale)

### Verification

- `dotnet build BeautyCareClinic.sln` — 0 errors, 0 warnings, all 5 projects (Tests included,
  for the first time since the pre-existing FU-015 error was introduced).
- `dotnet test` — 130/130 passed (129 pre-existing + 1 new).
- Live `POST /api/v1/customers/{customerId}/orders` — 201, confirmed against multiple different
  customers, independently re-verified by both the code-reviewer and the orchestrating session.
- Manual browser validation performed by the user.

### Version

- Version: v0.10.2 (patch — backward-compatible bug fix, no new phase)
- Tag: v0.10.2 (branch `fix/order-creation-treatmentseries-customerid`, merged to `main`)

## Maintenance Release — v0.11.0 (CR-031 + 4 fixes/enhancements, within Phase 010 lineage)

**Status:** Implemented, tested, validated by the user in the browser.

### Scope

Bundled into a single release at the user's explicit request (multiple items validated together
in one browser session):

**CR-031 — Stable per-customer package numbering.** `OrderItem.PackageNumber`, assigned once per
customer at order-creation time (row-locked via `SELECT ... FOR UPDATE` on the Customer row,
ADR-010-A pattern), backfilled via a deterministic `ROW_NUMBER()` migration. `ActiveSeriesTab` and
`TreatmentHistoryTab` now both read `packageNumber` instead of independently computing an index,
so the same package shows the same `#N` in both tabs. See `CHANGE_REQUESTS.md` (closed 2026-07-19).

**Bug: payment recording / note creation always failed (500).** `PaymentsController.Create` and
`NotesController.Create`/`Update` converted a `DateOnly` to `DateTime` via
`.ToDateTime(TimeOnly.MinValue)` with no `DateTimeKind` — Npgsql rejects `Kind=Unspecified` for a
`timestamp with time zone` column. Fixed by adding `DateTimeKind.Utc`, matching the pattern already
used in `TreatmentsController`. New Postgres integration tests
(`PaymentsControllerPostgresTests.cs`, `NotesControllerPostgresTests.cs`) prove the fix — reverting
it reproduces the original crash.

**Bug: Orders & Payments tab showed no package name, a garbled date, and ₪0 total.**
`OrdersTab.tsx` read legacy mock-data field names (`order.createdDate`, `order.orderItems`,
`order.totalPrice`) that don't exist in the real API response (`orderDate`, `items`,
`discountedPrice`/`originalPrice`). Fixed to prefer the real API fields with a legacy fallback,
matching the pattern already used correctly in `RecordPaymentModal.tsx`/`TreatmentHistoryTab.tsx`.
New test: `OrdersTab.test.tsx`.

**UI fix: package index position in Treatment History.** Repositioned so the package name and its
`#N` badge render in the same order as the equivalent badge in `ActiveSeriesTab.tsx`.

**New capability: edit treatment-level notes.** `Treatment.Notes` was a persisted column with no
way to set it after creation and no UI to set it at all (the record-treatment flows never sent a
note). Added `PUT /api/v1/treatments/{id}` (author-or-manager only, 5000-char cap, only `Notes` is
mutable) and an edit affordance in `TreatmentModal.tsx` (the same modal where photos are added),
gated to the treatment's author or a Manager. Treatment Photos remain explicitly out of scope,
deferred to Phase 011 (in-memory only, no persistence — unchanged from Phase 010).

### Files changed

Backend: `PaymentsController.cs`, `NotesController.cs`, `TreatmentsController.cs`,
`TreatmentDtos.cs`, `ITreatmentRepository.cs`, `TreatmentRepository.cs`,
`CustomerOrdersController.cs`, `TreatmentSeriesController.cs`, `OrderDtos.cs`,
`TreatmentSeriesDtos.cs`, `OrderItem.cs` (Domain), `AppDbContext.cs`,
`AppDbContextModelSnapshot.cs`, migration `20260719105258_AddPackageNumberToOrderItems`,
`Phase010Tests.cs`, `CustomerOrdersControllerPostgresTests.cs` (extended); new:
`PaymentsControllerPostgresTests.cs`, `NotesControllerPostgresTests.cs`,
`TreatmentsControllerPostgresTests.cs`.

Frontend: `OrdersTab.tsx`, `TreatmentHistoryTab.tsx`, `TreatmentModal.tsx`, `ActiveSeriesTab.tsx`,
`treatmentsApi.ts`, `api/index.ts`, `types/Order.ts`, `types/TreatmentSeries.ts`; new:
`OrdersTab.test.tsx`, `TreatmentModal.test.tsx`.

Docs: `API_SPECIFICATION.md` (new `PUT /treatments/{id}`, corrected stale "immutable" note),
`DATABASE_SCHEMA.md`, `DOMAIN_MODEL.md` (CR-031 column + numbering rules).

### Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Backend (xUnit) | 149 | 0 | 130 baseline (v0.10.2) + 19 new across CR-031, payment/notes fix, and treatment-notes feature |
| Frontend (Vitest) | 284 | 0 | 276 baseline (v0.10.2) + 8 new across OrdersTab and TreatmentModal |

### Manual Validation

- כל הפריטים נבדקו בדפדפן על ידי המשתמשת ואושרו לביצוע commit יחיד.

### Code Review / Security Review

- כל תיקון עבר code-reviewer; ה-endpoint החדש (PUT /treatments/{id}) עבר גם security-reviewer —
  ללא ממצאי Critical/High/Medium.
- ממצאי code-review (תיעוד לא מסונכרן, טסטים שלא בדקו את ה-controller בפועל, טסט frontend
  שלא תרגל את מסלול הדחייה) תוקנו לפני האישור.

### Version

- Version: v0.11.0 (minor — bundles a backward-compatible feature (CR-031, treatment-note editing)
  with backward-compatible bug fixes)
- Tag: v0.11.0
