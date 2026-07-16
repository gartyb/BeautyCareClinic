# Phase 006 — Appointment Calendar

## Status

Completed

## Goal

לאפשר לצוות הקליניקה לצפות, לקבוע, ולנהל תורים עם בדיקת זמינות אמיתית. כפתור "קבע תור" בכרטיס הלקוחה ו-KPI "תור הבא" יהפכו לפונקציונליים.

## Business Value

- **תזמון מטפלות** — קביעת תור עם בדיקת זמינות בזמן אמת
- **גישה מהירה** — כפתור "קבע תור" בכרטיס הלקוחה
- **ויזואליזציה** — לוח שבועי של כל התורים בקליניקה
- **מניעת חפיפות** — המערכת בודקת שעות עבודה, תאריכים חסומים ויכולות טיפול
- **בהירות מסע לקוח** — KPI "תור הבא" בכרטיס הלקוחה

## Planned

### 4.1 עדכון ישות Appointment
- **הוספת `durationMinutes: number`** לממשק `Appointment`
- **Status enum:** `'Scheduled' | 'Cancelled'` — בשלב זה, מעבר ל-Completed נדחה לפאזה 007+

### 4.2 עדכון TreatmentType
- **הוספת `defaultDurationMinutes: number`** לממשק `TreatmentType` (required, > 0)
- **עדכון seed data** — ערכי default לכל סוגי הטיפול
- **UI מנהלת** — TreatmentTypeModal מקבל שדה מספרי חדש

### 4.3 Appointments Context + Service
- **AppointmentsContext חדש** — מנהל רשימת תורים, חושף `createAppointment`, `cancelAppointment`
- **appointmentService.ts חדש** — פונקציות pure לבדיקת זמינות וניהול תורים

### 4.4 מסך לוח תורים שבועי (`/appointments`)
- Grid שבועי RTL (ראשון בימין, שבת בשמאל)
- שורות: slots של 30 דקות (09:00–18:00)
- ניווט: חץ שבוע קודם / שבוע הבא / היום
- כל תור: שם לקוחה, מטפלת, סוג טיפול
- כפתור "קבע תור חדש" → BookAppointmentModal

### 4.5 BookAppointmentModal
**כניסות:** כרטיס לקוחה ("קבע תור") + מסך לוח ("קבע תור חדש")

**Option A בלבד (5 שלבים):**
1. בחירת סוג טיפול (dropdown)
2. בחירת תאריך (`<input type="date">`)
3. בחירת מטפלת מהזמינות לתאריך+טיפול
4. בחירת שעה מתוך slots פנויים (30 דקות)
5. אישור משך (pre-fill מ-TreatmentType.defaultDurationMinutes, עריכה חופשית) + שמירה

### 4.6 ביטול תור
- לחיצה על block בלוח → popover עם פרטים + "בטל תור"
- אישור → status='Cancelled', נעלם מהלוח, toast

### 4.7 עדכון "תור הבא" KPI
- SummaryRow קורא מ-AppointmentsContext (לא מ-CustomerContext)
- פורמט: `dd/MM/yyyy HH:mm`
- "אין" אם אין תור עתידי scheduled

## Out of Scope

- הזמנה עצמאית של לקוחות (backend)
- תזכורות SMS/email (backend)
- שינוי מועד תור (cancel + rebook)
- תורים חוזרים / recurring
- עריכת תור לאחר שמירה
- קישור תור ל-Treatment record שבוצע (פאזה 007+)
- מעבר אוטומטי ל-status Completed (פאזה 007+)
- Backend / persistence אמיתי

## Open Questions

| שאלה | ברירת מחדל |
| --- | --- |
| האם תורים מבוטלים מוצגים (greyed) בלוח או נסתרים? | **נסתרים** |
| Filter מטפלת בלוח — בפאזה 006 או נדחה? | **נדחה** |
| שעה מינימלית בלוח | **09:00** |
| שעה מקסימלית בלוח | **18:00** |

## User Workflows

### קביעת תור מכרטיס לקוחה
1. כרטיס לקוחה → "קבע תור"
2. Modal נפתח עם לקוחה pre-filled
3. בחירת סוג טיפול → תאריך → מטפלת זמינה → שעה → אישור משך → שמירה
4. Toast + תור מופיע בלוח + "תור הבא" מתעדכן

### קביעת תור מלוח
1. `/appointments` → "קבע תור חדש"
2. Modal נפתח; בחירת לקוחה → כנ"ל

### צפייה בלוח
1. ניווט ל-`/appointments`
2. שבוע נוכחי, RTL grid
3. ניווט שבועות, היום מסומן

### ביטול תור
1. לחיצה על block → popover
2. "בטל תור" → אישור → toast + block נעלם

## New TypeScript Types

### `src/types/Appointment.ts`
```typescript
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Appointment {
  id: string;
  customerId: string;
  treatmentTypeId: string;
  therapistId: string;
  appointmentDateTime: string; // ISO datetime
  durationMinutes: number;
  status: AppointmentStatus;
  createdDate: string;
}

export type TimeSlot = {
  startTime: string;  // HH:MM
  endTime: string;    // HH:MM
};
```

### `src/types/TreatmentType.ts`
```typescript
export interface TreatmentType {
  id: string;
  name: string;
  defaultDurationMinutes: number; // NEW, > 0
}
```

## New Context / Service Changes

### AppointmentsContext (`src/contexts/AppointmentsContext.tsx`)
```typescript
interface AppointmentsContextValue {
  appointments: Appointment[];
  createAppointment(customerId, treatmentTypeId, therapistId, appointmentDateTime, durationMinutes): Appointment;
  cancelAppointment(appointmentId: string): void;
}
```
- Initialized from `src/data/appointments.ts`
- `createAppointment` throws DomainError on invalid input
- Mounted in main.tsx: after TreatmentTypesProvider, before CustomerProvider

### appointmentService.ts (`src/features/appointments/appointmentService.ts`)

| Function | Signature | Description |
| --- | --- | --- |
| `buildAppointment()` | `(customerId, treatmentTypeId, therapistId, appointmentDateTime, durationMinutes, deps?) → Appointment` | Validates + creates appointment |
| `cancelAppointment()` | `(appointments, id) → Appointment[]` | Returns new array with target status='Cancelled'; throws if not found |
| `getAvailableTherapists()` | `(date, treatmentTypeId, startTime, durationMinutes, therapists, workingHours, unavailableDates, capabilities, existingAppointments) → User[]` | Returns therapists passing all 4 availability checks |
| `getAvailableSlots()` | `(date, therapistId, durationMinutes, workingHours, unavailableDates, existingAppointments) → string[]` | Returns HH:MM start times (30-min buckets) |
| `getNextAppointment()` | `(customerId, appointments) → Appointment \| null` | Earliest upcoming scheduled appointment |
| `isSlotAvailable()` | `(date, startTime, durationMinutes, therapistId, workingHours, unavailableDates, capabilities, treatmentTypeId, existingAppointments) → boolean` | All 4 availability checks |

## New Files

| קובץ | מטרה |
| --- | --- |
| `src/contexts/AppointmentsContext.tsx` | Context provider לניהול תורים |
| `src/features/appointments/appointmentService.ts` | Pure service functions לבדיקת זמינות וניהול תורים |
| `src/features/appointments/appointmentService.test.ts` | Unit tests לכל פונקציות ה-service |
| `src/features/appointments/AppointmentCalendarScreen.tsx` | מסך לוח שבועי |
| `src/features/appointments/BookAppointmentModal.tsx` | Modal קביעת תור 5 שלבים |
| `src/features/appointments/AppointmentPopover.tsx` | Popover פרטי תור + ביטול |
| `src/features/appointments/components/CalendarGrid.tsx` | RTL weekly grid component |
| `src/features/appointments/components/TimeSlotList.tsx` | רשימת שעות זמינות |
| `src/data/appointments.ts` | Seed data — מספר תורים לדוגמה |

## Modified Files

| קובץ | שינוי |
| --- | --- |
| `src/types/Appointment.ts` | הוספת `durationMinutes`, `status` enum |
| `src/types/TreatmentType.ts` | הוספת `defaultDurationMinutes` |
| `src/data/treatmentTypes.ts` | הוספת `defaultDurationMinutes` לכל הרשומות |
| `src/data/appointments.ts` | עדכון mock data עם `durationMinutes` |
| `src/main.tsx` | הוספת `<AppointmentsProvider>` |
| `src/contexts/CustomerContext.tsx` | הסרת `appointments`; Context לא מחזיק תורים |
| `src/features/customer/SummaryRow.tsx` | קריאה מ-`useAppointments()` |
| `src/features/customer/QuickActionButtons.tsx` | הפעלת "קבע תור" + handler |
| `src/App.tsx` | הוספת route `/appointments` |
| `src/components/shared/Sidebar.tsx` | הוספת nav item "לוח זמנים" |
| `src/features/treatmentTypes/TreatmentTypeModal.tsx` | הוספת שדה `defaultDurationMinutes` |

## Validation Rules

### Appointment Booking
1. `customerId` — non-empty, must exist
2. `treatmentTypeId` — non-empty, must exist
3. `therapistId` — non-empty, must exist, role='Therapist'
4. `appointmentDateTime` — valid ISO datetime, must be >= now
5. `durationMinutes` — integer, > 0

### Availability Algorithm (Step-by-Step)

Slot `[startTime, startTime+durationMinutes)` on date D for therapist T and treatment TT:

**Step 1: Working Hours**
- Get weekday from D (0=Sun, 6=Sat)
- Find `TherapistWorkingHours` row for T + weekday
- If not found OR null → UNAVAILABLE
- If `row.startTime > slot.start` OR `row.endTime < slot.end` → UNAVAILABLE

**Step 2: Unavailable Date**
- If D ∈ T's unavailable dates → UNAVAILABLE

**Step 3: Capability**
- If T has no `TherapistCapability` for TT → UNAVAILABLE

**Step 4: No Overlapping Appointment**
- For each scheduled appointment A of T:
- If `A.startTime < slot.end AND A.endTime > slot.start` → UNAVAILABLE

✅ All 4 pass → AVAILABLE

### TreatmentType Validation
- `name` — required, 1–100 chars
- `defaultDurationMinutes` — required, integer, > 0

## UI Changes

### Weekly Calendar Grid
- RTL: ראשון (Sun) בימין, שבת (Sat) בשמאל
- 30-min slot rows, 09:00–18:00
- Appointment block: שם לקוחה / מטפלת / סוג טיפול
- Navigation: חץ שמאל/ימין + "היום"
- Today highlighted in header
- "קבע תור חדש" button at top

### BookAppointmentModal (5 steps)
- Step indicator: "שלב X מתוך 5"
- RTL Radix Dialog
- "הקודם" / "הבא" / "שמור"
- Error state per step if no results found

### AppointmentPopover
- לחיצה על block → popover
- פרטים + "בטל תור" + confirmation dialog

### CustomerCard
- "קבע תור" button enabled
- "תור הבא" KPI: `dd/MM/yyyy HH:mm` or "אין"

### Sidebar
- nav item "לוח זמנים" (Calendar icon), route `/appointments`, גם Therapist גם Manager

### TreatmentTypeModal
- שדה חדש: "משך טיפול ברירת מחדל (דקות)", required, integer > 0

## Testing Strategy

### Unit Tests — `appointmentService.test.ts`

**`buildAppointment()`:**
- ✓ Valid inputs → Appointment created
- ✓ Empty customerId → DomainError
- ✓ Past appointmentDateTime → DomainError
- ✓ durationMinutes ≤ 0 → DomainError

**`getAvailableTherapists()`:**
- ✓ Returns therapists with working hours
- ✓ Excludes: unavailable date / no capability / overlapping appointment
- ✓ Returns empty array if none available
- ✓ Cancelled appointments do NOT block availability

**`getAvailableSlots()`:**
- ✓ Returns 30-min slots within working hours
- ✓ Returns empty if date is unavailable
- ✓ Excludes slots overlapping scheduled appointments
- ✓ Respects duration (90-min slot can't start at 17:45 if working hours end at 18:00)

**`getNextAppointment()`:**
- ✓ Returns earliest upcoming scheduled
- ✓ Returns null if none
- ✓ Ignores cancelled / past

**`cancelAppointment()`:**
- ✓ Returns new array with status='Cancelled'
- ✓ Throws if not found
- ✓ Does not mutate input

## Architecture Review

**ADR-003 מומלץ:** "Appointments live in a global context, not per-customer"

### ✅ Approved Parts
1. `AppointmentsContext` גלובלי — נכון, mirrors CustomersContext / TherapistsContext
2. Pure service module — מתאים לארכיטקטורה קיימת
3. DomainError validation — consistent עם פאזות קודמות
4. ביטול תורים לא חוסמים זמינות — consistent עם selectors קיימים
5. מיגרציית SummaryRow ל-useAppointments() — נדרש ונכון

### 🔴 Required Corrections (לפני implementation)

**C1 — Provider tree לא מדויק בתוכנית**
עץ ה-providers האמיתי: `GlobalSettings → Customers → TherapistData → Therapists → TreatmentTypes → PackageTypes → Customer → ActiveTimer`
המיקום הנכון: `AppointmentsProvider` עוטף `CustomerProvider`:
```
... PackageTypes → Appointments → Customer → ActiveTimer
```

**C2 — SearchResults.tsx לא בתוכנית (missing)**
`SearchResults.tsx` קורא appointments ישירות מ-`src/data/appointments` (import סטטי). לאחר Phase 006, תורים שנוצרו ב-AppointmentsContext לא יופיעו בעמודת "תור הבא" בחיפוש. חייב להתווסף ל-Modified Files.

**C3 — getAvailableTherapists() signature שגויה**
הפונקציה מקבלת `startTime` ו-`durationMinutes` — אבל בשלב 3 של wizard המשתמש עוד לא בחר שעה. Fix: הסר את הפרמטרים האלה. הפונקציה תחזיר מטפלות שיש להן: working hours ביום הנבחר + לא unavailable + יש capability + לפחות slot פנוי אחד.

**C4 — סדר שלבי wizard שגוי**
שלב 5 (משך) חייב להיות לפני שלב 4 (slot) כי `getAvailableSlots()` צריך את `durationMinutes`. 
סדר מתוקן: `טיפול → תאריך → מטפלת → משך → שעה`

**C5 — defaultDurationMinutes שובר consumers קיימים**
שדה required חדש ב-TreatmentType שובר:
- seed data ב-`treatmentTypes.ts`
- `TreatmentTypesContext.createTreatmentType(name)` — חייב להרחיב חתימה
- `updateTreatmentType` — חייב להרחיב
- test fixtures ב-packageTypeService.test.ts, orderService.test.ts, treatmentService.test.ts, selectors.test.ts
כולם חייבים להתווסף ל-Modified Files.

**C6 — Appointment.durationMinutes שובר mock data קיים**
כל 15 הרשומות ב-`appointments.ts` חייבות להתעדכן atomically עם שינוי הטיפוס.

**C7 — חישוב endTime לא מרכוזי**
`Appointment` מחזיק `appointmentDateTime + durationMinutes` בלי `endTime`. הוסף helper `getAppointmentInterval(a) → { start, end }` ב-`appointmentService.ts` ונשתמש בו בכל בדיקות ה-overlap.

**C8 — isSlotAvailable ו-getAvailableSlots — סיכון divergence**
שתי הפונקציות מיישמות את אותם 4 תנאים. Fix: `isSlotAvailable` הוא ה-primitive; `getAvailableSlots` הוא wrapper שמייצר buckets ומסנן:
```ts
generate30MinBuckets(workingHours).filter(b => isSlotAvailable(date, b, duration, ...))
```

**C9 — datetime convention לא מוגדרת**
Naive local ISO (`YYYY-MM-DDTHH:mm:ss`) vs UTC עם offset. Selectors קיימים משתמשים ב-`.toISOString()` (UTC). חייב להחליט ולתעד לפני implementation.
**ברירת מחדל מומלצת:** naive local ISO בכל ה-mock data; comparisons ב-`new Date(a) < new Date(b)` (JS מטפל נכון אם consistent).

### 💡 Recommendations (non-blocking)
- **R1:** Comment בקוד על 09:00–18:00 hardcoded — תור מחוץ לטווח לא יוצג
- **R2:** RTL calendar — השתמש ב-CSS Grid (לא flex-row-reverse) למניעת בעיות keyboard nav
- **R3:** AppointmentPopover — השתמש ב-Radix Popover עם click-outside dismiss
- **R4:** הוסף JSDoc ל-`defaultDurationMinutes` כדי להבחין מ-`PackageType.minutesPerTreatment`
- **R6:** Wizard — "הקודם" שומר state (לא מאפס)

### שינויים לתוכנית לפני Implementation
1. סדר wizard: `טיפול → תאריך → מטפלת → משך → שעה`
2. הוסף `SearchResults.tsx` ל-Modified Files
3. הוסף `TreatmentTypesContext.tsx`, test fixtures ל-Modified Files
4. תעד provider tree מדויק
5. `isSlotAvailable` כ-primitive; שאר הפונקציות מרכיבות ממנו
6. הגדר datetime convention: naive local ISO
7. עדכן signature `getAvailableTherapists` (ללא startTime/durationMinutes)
8. הוסף acceptance test: תור שנוצר בלוח מופיע ב-SearchResults

## Implemented

### תשתית
- `AppointmentsContext` גלובלי — `createAppointment`, `cancelAppointment`, seed data
- `AppointmentsProvider` ב-main.tsx בין PackageTypes ל-CustomerProvider
- `appointments` הוסר מ-`CustomerContext`

### appointmentService.ts — pure functions
- `buildAppointment()` — validation + יצירת Appointment
- `cancelAppointmentInList()` — מחזיר array חדש עם status='Cancelled'
- `getAppointmentInterval()` — helper מרכזי לחישוב endTime
- `isSlotAvailable()` — primitive יחיד, 4 תנאים
- `getAvailableSlots()` — wrapper; מחזיר HH:MM buckets של 30 דקות
- `getAvailableTherapists()` — wrapper; מסנן לפי כל 4 תנאים
- `getNextAppointment()` — תור הבא לפי customerId

### UI
- `AppointmentCalendarScreen.tsx` — לוח שבועי RTL, nav, appointment blocks
- `CalendarGrid.tsx` — CSS Grid component, RTL
- `BookAppointmentModal.tsx` — wizard 5/6 שלבים (טיפול → תאריך → מטפלת → משך → שעה)
- `AppointmentPopover.tsx` — פרטי תור + ביטול עם confirmation

### עדכונים
- `SummaryRow` — "תור הבא" מ-AppointmentsContext + formatDateTime
- `SearchResults` — "תור הבא" מ-AppointmentsContext (לא import סטטי)
- `QuickActionButtons` — "קבע תור" פעיל
- `TreatmentTypeModal` — שדה defaultDurationMinutes
- `TreatmentTypesContext` — חתימות מורחבות עם defaultDurationMinutes
- `Sidebar` — nav item "לוח זמנים"
- `/appointments` route ב-App.tsx
- `renderWithProviders` — AppointmentsProvider

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Unit | 252 | 0 | כולל 40 טסטים חדשים ל-appointmentService |
| Integration | 0 | 0 | — |
| End-to-End | 0 | 0 | Manual validation |

## Additional Features (beyond original plan)

- `AppointmentStatus` extended with `'NoShow'`
- `updateAppointmentStatus` and `rescheduleAppointment` added to `AppointmentsContext` and service
- `RescheduleModal` — 3-step wizard: date → therapist → time slot; excludes current appointment from availability check
- Inline cancel confirmation on appointment block (no separate popover needed)
- `AppointmentsTab` on customer card — lists all customer appointments; Completed/NoShow toggle buttons always visible; clicking active status resets to Scheduled
- `CalendarGrid` — day view with one column per therapist (not weekly); action buttons always visible at block bottom
- Date picker via native `<input type="date">` `showPicker()` positioned near date label
- `GlobalSettings` extended with `calendarStartHour` + `calendarEndHour`; `SettingsScreen` updated
- `BookAppointmentModal` pre-filters treatment types to active-series types when opened from customer card
- Z-index fix: multi-slot appointment blocks now use `z-10` to prevent grid rows from intercepting mouse events

## Manual Validation

Status: Complete — validated in browser

## Code Review

TBD

## Security Review

TBD

## Documentation Updated

PROJECT_STATUS.md, PROGRESS.txt, phases/phase-006/PHASE_SUMMARY.md

## Version

- Version: v0.6.0
- Tag: v0.6.0

## Lessons Learned

- Multi-slot appointment blocks in CSS Grid need explicit `z-index` because grid cells rendered later in the DOM stack above absolutely-positioned blocks that span multiple rows.
- Native `<input type="date">` `showPicker()` opens the picker near the input's DOM position — must position the hidden input near the visible trigger, not off-screen with `sr-only`.

## Deferred Requests

- CR-001, CR-004, CR-008, CR-009, CR-010 — נדחו לפאזה backend/infra
- Appointment ↔ Treatment linking — נדחה לפאזה 007

## Risks

| Risk | Mitigation |
| --- | --- |
| Timezone ambiguity | ISO 8601 בכל מקום; זמן מקומי בלבד בפאזה 006 |
| Slot boundary edge cases | Unit tests מקיפים ל-`getAvailableSlots()` |
| RTL calendar layout | Tailwind RTL variants, flex-direction control |
| Context provider order | AppointmentsProvider אחרי TreatmentTypes/Therapists/TherapistData |
| Mock data divergence | sync capabilities/workingHours/treatmentTypes in seed data |

## Acceptance Criteria

### Appointment Entity
- [ ] `Appointment` interface with `durationMinutes` and `status`
- [ ] All mock appointments include `durationMinutes > 0`

### TreatmentType Enhancement
- [ ] `defaultDurationMinutes` field on TreatmentType
- [ ] TreatmentTypeModal includes the field with validation

### AppointmentsContext
- [ ] Provides `appointments`, `createAppointment()`, `cancelAppointment()`
- [ ] Initialized from mock seed data

### Weekly Calendar Screen
- [ ] `/appointments` shows current week RTL grid (Sun right)
- [ ] 30-min rows from 09:00–18:00
- [ ] Appointment blocks with customer/therapist/treatment
- [ ] Prev/Next/Today navigation works
- [ ] Today highlighted

### BookAppointmentModal
- [ ] Opens from Customer Card "קבע תור" with customer pre-filled
- [ ] Opens from calendar "קבע תור חדש" without pre-fill
- [ ] 5-step flow with step indicator
- [ ] Step 3: therapist list filtered by availability
- [ ] Step 4: time slots filtered by availability
- [ ] Step 5: duration pre-filled, editable
- [ ] Save: appointment created, toast, modal closes, calendar updates

### Cancellation
- [ ] Click block → popover with details
- [ ] "בטל תור" → confirmation → status=Cancelled, block disappears, toast

### "תור הבא" KPI
- [ ] Shows `dd/MM/yyyy HH:mm` of next scheduled appointment
- [ ] Shows "אין" if none
- [ ] Updates after booking

### Availability Enforcement
- [ ] Therapist with no working hours → not shown
- [ ] Therapist with unavailable date → not shown
- [ ] Therapist without capability → not shown
- [ ] Slot with overlapping appointment → not shown
- [ ] Cancelled appointments don't block availability

### Sidebar
- [ ] "לוח זמנים" nav item visible to both roles, navigates to `/appointments`
