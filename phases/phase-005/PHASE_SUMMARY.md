# Phase 005 — New Customer + Manager Admin Screens

## Status

Approved — Committed

## Goal

Enable therapists and managers to create new customers, and equip managers with admin screens to configure treatment packages, manage therapist availability and capabilities, and set global settings.

## Business Value

- **Therapists:** Can onboard new customers directly from the search screen without manager intervention
- **Managers:** Full control over clinic operations — define treatment offerings, configure therapist schedules and capabilities, and control clinic-wide defaults
- **System:** Completes the foundation for Phase 6 (Appointment Calendar), which depends on therapist availability and capabilities

## Scope

### Feature A — New Customer (SearchScreen)
- Enable "לקוחה חדשה" button on `/search` screen
- Opens modal dialog with form: שם מלא (required), טלפון (required), אימייל (optional)
- Validation: non-empty fullName, non-empty phone
- On save: creates new Customer in-memory, adds to global customers list, navigates to Customer Card
- Available to both Manager and Therapist roles

### Feature B — Package Type Management (`/packages`, Manager only)
- New screen: list of all PackageTypes with key properties
- Create: modal/form to add new PackageType
- Edit: same modal/form to update existing PackageType
- Delete: confirmation dialog, removes from list
- Form fields: שם, סוג טיפול (treatmentTypeId select), מחיר, האם סדרה (toggle), מספר טיפולים (if isSeries), האם מבוסס טיימר (toggle, requires isSeries), דקות לטיפול (if isTimerBased)
- Business rules enforced in UI: isTimerBased only valid when isSeries=true; field visibility controlled by toggles
- Manager only (RoleGuard)

### Feature C — Therapist Management (`/therapists`, Manager only)
- New screen: list of therapist users (role=Therapist)
- Therapist detail (sub-route `/therapists/:userId`):
  - **Working Hours:** per weekday (Sun–Sat), start/end time or day-off toggle
  - **Unavailable Dates:** add/remove specific ISO dates
  - **Treatment Capabilities:** multi-select from TreatmentTypes
- No add/remove User accounts (backend phase)
- Manager only (RoleGuard)

### Feature D — Global Settings (`/settings`, Manager only)
- Simple form: one field — מספר תשלומים מקסימלי ברירת מחדל (default_max_payment_count), integer > 0
- Save button; changes reflected in-memory
- Value used when creating new orders (replaces hardcoded constant)
- Manager only (RoleGuard)

## Out of Scope

- Appointment Calendar (Phase 6 — depends on therapist data from Phase 5)
- Editing/deleting customers (backend phase)
- Adding/removing User accounts (backend phase)
- Real persistence / backend
- CR-001, CR-004, CR-008 (backend phases)
- CR-009, CR-010 (tech debt / UX — defer to backend phase)

## User Workflows

### Feature A — New Customer

1. User navigates to `/search` screen
2. User clicks "לקוחה חדשה" button
3. Modal opens: שם מלא, טלפון, אימייל (optional)
4. User fills required fields, clicks "שמור לקוחה"
5. Customer created in-memory, app navigates to new Customer Card
6. New customer appears in search results immediately

Error cases: empty שם or טלפון → save disabled; modal closed → no customer created.

### Feature B — Package Type Management

**Create:**
1. Click "יצירת חבילה חדשה" → modal opens
2. Fill name, select treatment type, enter price, toggle series options
3. Conditional fields appear based on toggles
4. Save → package added to list

**Edit:** Click edit on row → modal opens with current values → save → list updates.

**Delete:** Click delete → confirmation dialog → confirm → removed from list.

### Feature C — Therapist Management

1. Manager navigates to `/therapists`
2. Clicks therapist → detail sub-route `/therapists/:userId`
3. **Working Hours section:** 7-day table, per row: start time, end time, or day-off toggle
4. **Unavailable Dates section:** date input + "הוסף" button; × to remove
5. **Capabilities section:** checkboxes per TreatmentType
6. Each section has its own save button

### Feature D — Global Settings

1. Manager navigates to `/settings`
2. Number input pre-populated with current value (default: 3)
3. Changes value, clicks save
4. Toast confirms success; new orders use updated value

## Domain Changes

### New Types (if not yet defined)

```typescript
TherapistWorkingHours: { id, userId, weekday: 0-6, startTime: string|null, endTime: string|null }
TherapistUnavailableDate: { id, userId, date: string } // ISO YYYY-MM-DD
TherapistCapability: { id, userId, treatmentTypeId }
GlobalSettings: { name: string, value: string } // key-value row
```

### New Context / Service Changes

- **CustomersContext** (new — `src/contexts/CustomersContext.tsx`): owns customer list; exposes `customers` + `createCustomer(fullName, phone, email?)`. `SearchScreen` and `CustomerContext` both consume `useCustomers()` — mock array becomes seed-only.
- **GlobalSettingsContext** (new — `src/contexts/GlobalSettingsContext.tsx`): `defaultMaxPaymentCount`, `setDefaultMaxPaymentCount()`. Mounted at root above all other providers.
- **CustomerContext** updated: reads customer list via `useCustomers()`; `addOrder` reads `defaultMaxPaymentCount` via `useGlobalSettings()` and passes explicitly to `buildNewOrder()`.
- **orderService.ts** updated: `buildNewOrder()` gains required `defaultMaxPaymentCount: number` parameter; `DEFAULT_MAX_PAYMENT_COUNT` constant import deleted.
- **packageTypeService.ts** (new): `buildPackageType()`, `updatePackageType()`, `deletePackageType()`, `validatePackageType()`
- **therapistDataService.ts** (new): `buildWorkingHours()`, `buildUnavailableDate()`, `addUnavailableDate()`, `removeUnavailableDate()`, `buildCapability()`, `updateTherapistCapabilities()`
- **settingsService.ts** (new): `updateDefaultMaxPaymentCount()`
- **customerService.ts** (new): `buildCustomer()` using `newId` from `src/domain/id.ts`
- `DEFAULT_MAX_PAYMENT_COUNT` constant deleted in same commit as `GlobalSettingsContext` introduction (no dual-source period)

## New Files

| File | Purpose |
|---|---|
| `src/types/TherapistWorkingHours.ts` | Type definition |
| `src/types/TherapistUnavailableDate.ts` | Type definition |
| `src/types/TherapistCapability.ts` | Type definition |
| `src/types/GlobalSettings.ts` | Type definition |
| `src/data/globalSettings.ts` | Mock initial settings (default_max_payment_count = 3) |
| `src/data/therapistWorkingHours.ts` | Mock working hours (empty or defaults) |
| `src/data/therapistUnavailableDates.ts` | Mock unavailable dates (empty) |
| `src/data/therapistCapabilities.ts` | Mock capabilities (empty or defaults) |
| `src/features/customer/NewCustomerModal.tsx` | New customer form modal |
| `src/features/customer/customerService.ts` | `buildCustomer()` pure function |
| `src/features/customer/customerService.test.ts` | Unit tests |
| `src/features/packages/PackagesScreen.tsx` | Package list + actions |
| `src/features/packages/PackageTypeModal.tsx` | Create/edit form |
| `src/features/packages/PackageDeleteConfirm.tsx` | Delete confirmation |
| `src/features/packages/packageTypeService.ts` | Service layer |
| `src/features/packages/packageTypeService.test.ts` | Unit tests |
| `src/features/therapists/TherapistsScreen.tsx` | Therapist list |
| `src/features/therapists/TherapistDetail.tsx` | Working hours, unavailable dates, capabilities |
| `src/features/therapists/therapistDataService.ts` | Service layer |
| `src/features/therapists/therapistDataService.test.ts` | Unit tests |
| `src/features/settings/SettingsScreen.tsx` | Global settings form |
| `src/features/settings/settingsService.ts` | Service layer |
| `src/features/settings/settingsService.test.ts` | Unit tests |

## Modified Files

| File | Change |
|---|---|
| `src/main.tsx` | Provider order: GlobalSettingsProvider → CustomersProvider → CustomerProvider → ActiveTimerProvider |
| `App.tsx` | Add routes: `/packages`, `/therapists`, `/therapists/:userId`, `/settings`; wrap manager routes with `<RoleGuard fallback={<Navigate to="/search" />}>` |
| `Sidebar.tsx` | Enable nav items for /packages, /therapists, /settings |
| `SearchScreen.tsx` | Consume `useCustomers()`; enable "לקוחה חדשה" button; wire to `NewCustomerModal`; navigate on save |
| `CustomerContext.tsx` | Read customer list via `useCustomers()`; `addOrder` reads `defaultMaxPaymentCount` via `useGlobalSettings()` |
| `src/features/order/orderService.ts` | `buildNewOrder()` requires explicit `defaultMaxPaymentCount` param; delete constant import |
| `src/features/order/orderService.test.ts` | Pass `defaultMaxPaymentCount` explicitly in all test cases |
| `src/features/order/NewOrderModal.tsx` | Read default via `useGlobalSettings()` |
| `src/components/shared/RoleGuard.tsx` | Add optional `fallback?: React.ReactNode` prop (default `null`) |
| `src/domain/constants.ts` | Remove `DEFAULT_MAX_PAYMENT_COUNT` (delete if file becomes empty) |

## Validation Rules

### New Customer
1. `fullName` — required, non-empty, max 100 chars
2. `phone` — required, non-empty, max 20 chars
3. `email` — optional; if provided, basic format check (`/.+@.+\..+/`)

### Package Type
1. `name` — required, non-empty, max 100 chars
2. `treatmentTypeId` — required, must exist in TreatmentTypes
3. `price` — required, valid decimal string, >= 0
4. `treatmentCount` — required and > 0 if `isSeries=true`
5. `minutesPerTreatment` — required and > 0 if `isTimerBased=true`
6. **Business rule:** `isTimerBased=true` requires `isSeries=true`

### Therapist Working Hours
1. `startTime` / `endTime` — HH:MM format (00:00–23:59), or null if day-off
2. **Business rule:** `startTime < endTime` when both set

### Therapist Unavailable Dates
1. `date` — valid ISO date string (YYYY-MM-DD)
2. No duplicates per therapist

### Global Settings
1. `defaultMaxPaymentCount` — integer > 0, <= 24

## Testing Strategy

### Unit Tests

**customerService.test.ts:**
- `buildCustomer()`: valid inputs → Customer with generated id and createdDate
- `buildCustomer()`: empty fullName → DomainError
- `buildCustomer()`: empty phone → DomainError

**packageTypeService.test.ts:**
- `buildPackageType()`: valid non-series, valid series, valid timer-based
- `buildPackageType()`: isTimerBased without isSeries → DomainError
- `buildPackageType()`: isSeries without treatmentCount → DomainError
- `buildPackageType()`: isTimerBased without minutesPerTreatment → DomainError
- `updatePackageType()`: immutable update
- `deletePackageType()`: removes by id, immutable

**therapistDataService.test.ts:**
- `buildWorkingHours()`: valid day, day-off, start >= end → DomainError
- `buildUnavailableDate()`: valid date
- `addUnavailableDate()`: appends, immutable
- `removeUnavailableDate()`: removes by date, immutable
- `updateTherapistCapabilities()`: replaces list, immutable

**settingsService.test.ts:**
- `updateDefaultMaxPaymentCount()`: valid value (> 0)
- `updateDefaultMaxPaymentCount()`: invalid value (<= 0) → DomainError

## Risks

| Risk | Mitigation |
|---|---|
| State management scope creep | Pure service functions + minimal new contexts |
| Working hours UI complexity (7 days × 3 fields) | Table layout with clear day-off toggle |
| `DEFAULT_MAX_PAYMENT_COUNT` constant migration | Replace constant with context lookup; comment migration path |
| Date picker compatibility (RTL) | Use native `<input type="date">` — best RTL support without extra deps |

## Dependencies

- No new npm packages required
- Existing: Radix Dialog wrapper, DomainError, RoleGuard, Tailwind clinic tokens
- Existing mock data: therapists.ts, packageTypes.ts, treatmentTypes.ts

## Architecture Review

**ADR-002** — `docs/adr/ADR-002-phase-5-architecture.md` — **Approved with conditions**

Key decisions:
- **D1:** `createCustomer` moves to new `CustomersContext` (plural) — not `CustomerContext`. Fixes ADR-001 violation.
- **D2:** `GlobalSettingsContext` at root above all providers; `DEFAULT_MAX_PAYMENT_COUNT` constant deleted; `buildNewOrder` requires explicit param.
- **D3:** Admin screens use local `useState` (no shared AdminContext — premature abstraction).
- **D4:** `RoleGuard` gains `fallback` prop; manager routes redirect non-managers to `/search`.
- **D5:** Therapist detail as sub-route `/therapists/:userId` (as planned).

Additional risks flagged: provider stack in tests (add `renderWithProviders` helper); PackageType delete cascade (document limitation); CustomerSummary/Customer type alignment; id generation via `newId`; overnight shifts excluded by `startTime < endTime` rule (intentional for beauty clinic).

## Open Questions

1. **Email validation strictness:** Basic regex (`/.+@.+\..+/`) at mock level — backend enforces RFC 5322 later.
2. **Phone format:** No format constraint — max 20 chars only.
3. **Minimum working days:** No hard constraint — therapist can have all days off at mock level.
4. **Past unavailable dates:** Accepted at mock level; Phase 6 appointment logic will ignore them.
5. **Price decimal places:** Stored as string; UI formats to 2 decimal places for display only.
6. **PackageType delete with existing series:** Hard-delete allowed at mock level; backend must enforce referential integrity.

## Implemented

### Prerequisite infrastructure
- `CustomersContext` — owns customer list; `createCustomer()` adds to in-memory state; replaces static import
- `GlobalSettingsContext` — owns `defaultMaxPaymentCount`; replaces hardcoded constant; mounted at root
- `PackageTypesContext` — owns package types list; CRUD exposed; `NewOrderModal` and `PackagesScreen` both consume it
- `TherapistDataContext` — owns working hours, unavailable dates, capabilities; persists across navigation
- Provider order in `main.tsx`: GlobalSettings → Customers → TherapistData → PackageTypes → Customer → ActiveTimer
- `DEFAULT_MAX_PAYMENT_COUNT` constant deleted; `buildNewOrder` requires explicit parameter
- `RoleGuard` gained optional `fallback` prop (default `null`); manager routes redirect to `/search`
- `src/test/renderWithProviders.tsx` — shared test helper wrapping all providers

### Feature A — New Customer
- "לקוחה חדשה" button enabled in `SearchScreen`
- `NewCustomerModal` — Radix Dialog; fields: שם מלא (required), טלפון (required), אימייל (optional)
- `customerService.ts` — `buildCustomer()` with validation: name non-empty/≤80, phone regex `/^[+\d\-\s()]{6,20}$/`, email format if provided
- On save: creates customer in `CustomersContext`, navigates to Customer Card
- Modal resets on close; error state on save failure

### Feature B — Package Type Management
- `PackagesScreen` at `/packages` — list with edit/delete inline confirmation
- `PackageTypeModal` — create/edit with conditional fields (treatmentCount, isTimerBased, minutesPerTreatment)
- `packageTypeService.ts` — `buildPackageType()` with all 5 DomainError codes + price validation (finite, ≤999,999, stored as `toFixed(2)`); `updatePackageType()`, `deletePackageType()` immutable
- Manager-only route via `RoleGuard`

### Feature C — Therapist Management
- `TherapistsContext` (new) — owns therapist list with CRUD: `createTherapist`, `updateTherapist`, `deleteTherapist`; validation per field
- `TherapistsScreen` at `/therapists` — list; "הוספת מטפלת" button; inline delete confirmation with cascade warning; cascade delete calls `cleanupTherapist` + `deleteTherapist`
- `TherapistModal` (new) — create modal: שם פרטי, שם משפחה, אימייל, טלפון (all required); phone digits-only input
- `TherapistDetail` at `/therapists/:userId` — 4 sections: contact info (phone+email edit), working hours (7-day table + day-off toggle), unavailable dates (add/remove), capabilities (multi-select)
- `therapistDataService.ts` — all builders with validation; date format/validity check; range check `startTime < endTime`; `cleanupTherapist` added to context for cascade delete
- `User.ts` — added optional `phone?: string` field
- Data persisted in `TherapistDataContext` across navigation
- Manager-only route

### Feature E — Treatment Type Management (scope extension during validation)
- `TreatmentTypesContext` (new) — owns treatment types list with CRUD: `createTreatmentType`, `updateTreatmentType`, `deleteTreatmentType`
- `TreatmentTypesScreen` at `/treatment-types` — list; create/edit modal; hard-block delete when in use by packages or therapist capabilities (shows count tooltip)
- `TreatmentTypeModal` (new) — single name field; create and edit mode
- `PackagesScreen` and `PackageTypeModal` — replaced static `treatmentTypes` import with `useTreatmentTypes()` (fully dynamic)
- `TherapistDetail` capabilities section — already driven by `useTreatmentTypes()` (unchanged)
- Sidebar — "סוגי טיפולים" nav item added (manager only, before "סוגי חבילות")
- Manager-only route via `RoleGuard`

### Feature F — Phone Formatting System-Wide (scope extension during validation)
- `src/utils/phone.ts` (new) — `parsePhone(value)`: strips non-digits, max 10 chars; `formatPhone(digits)`: 10→`ddd-ddddddd`, 9→`dd-ddddddd`
- All phone inputs: `onChange` uses `parsePhone`, `maxLength={10}`, `inputMode="numeric"` (NewCustomerModal, TherapistModal, TherapistDetail contact)
- Display: `CustomerCardHeader`, `SearchResults`, `TherapistsScreen`, `TherapistDetail` header all use `formatPhone`
- `customers.ts` seed data: phone values converted to raw digits (no hyphens)
- `customerService.ts` phone validation updated to `/^\d{7,10}$/`; all tests updated accordingly

### Feature D — Global Settings
- `SettingsScreen` at `/settings` — number input pre-populated, saves via context
- `settingsService.ts` — validates integer > 0 and ≤ 24
- Default affects all new orders in same session
- Manager-only route

### Sidebar
- סוגי טיפולים, סוגי חבילות, מטפלות, הגדרות nav items enabled with routes

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Unit | 212 | 0 | +17 new: customerService(8), packageTypeService(7), therapistDataService(2); phone tests updated |
| Integration | 0 | 0 | Not applicable (mock level) |
| End-to-End | 0 | 0 | Manual validation |

## Manual Validation

To be completed after implementation.

## Code Review

- **C1:** `customers` missing from `activeCustomer` useMemo deps → תוקן
- **H1:** PackageType state split (PackagesScreen / NewOrderModal) → תוקן: `PackageTypesContext` added
- **H2:** Working hours range validation bypassed in save path → תוקן: `updateTherapistWorkingHours` calls `buildWorkingHours` per row
- **H3:** `setTimeout` leaks on unmount → תוקן: `useRef` + cleanup
- **H4:** `price` stored without numeric validation → תוקן: DomainError for NaN/negative
- **H5:** No upper bound on `defaultMaxPaymentCount` → תוקן: cap at 24 in service + input
- **M1–M4:** Single setForm call; inline delete confirm; useEffect dep fixed; DomainError propagation documented — כולם תוקנו
- **L1–L3, L5:** RTL chevrons, test assertions, parseInt guard, unused param — תוקנו

## Security Review

- **High (2):** Input validation missing in `buildCustomer` (phone regex, email format, length caps) + date string not validated in `buildUnavailableDate` → שניהם תוקנו
- **Medium (3 actionable):** Price not canonicalized (non-finite, overflow, toFixed) → תוקן; `TherapistDataContext` added for persistence → תוקן; maxLength on inputs → תוקן
- **Low:** Fragment keys in PackagesScreen → תוקן; console.error logs raw DomainError (PII risk) → נדחה ל-CR-010 (logger abstraction)
- **Deferred:** parseInt consistency in PackageTypeModal (M3), URL param null narrowing (M5) → low risk at mock level, deferred to backend phase

## Documentation Updated

To be updated after implementation.

## Version

- Version: v0.5.0
- Commit: (see git log)
- Tag: v0.5.0

## Lessons Learned

To be recorded after completion.

## Deferred Requests

- CR-001, CR-004, CR-008, CR-009, CR-010 — deferred to backend/infra phase
