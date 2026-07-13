# Phase 001 — Foundation + Customer View

## Status

Approved — Pending Commit

## Goal

הקמת תשתית ה-Frontend (Vite + React + TS + Tailwind + shadcn/ui + RTL עברית), mock data, TypeScript types, App shell — ומשם Customer Search ו-Customer Card במצב תצוגה מלא (כל 5 טאבים, כפתורי פעולה כ-disabled).

## Planned

### תשתית
- Vite + React 18 + TypeScript
- Tailwind CSS עם design tokens clinic-*
- shadcn/ui — הגדרה ראשונית
- React Router v6
- פונט Assistant (Google Fonts), `dir="rtl"` על `<html>`
- App shell: header, ניווט צידי (sidebar), routing

### נתונים
- TypeScript types מלאים ב-`src/types/` (כל ה-entities מה-Domain Model)
- Mock data ב-`src/data/mockData.ts`:
  - 5 לקוחות עם היסטוריה
  - 2 משתמשים (מנהל + מטפלת)
  - 3 סוגי טיפול, 5 סוגי חבילות
  - הזמנות, תשלומים, טיפולים, תורים, הערות
- `CustomerContext` — לקוח נוכחי + נתוניו המלאים
- `ActiveTimerContext` — skeleton (state בלבד, ללא לוגיקה)

### Customer Search Screen (`/search`)
- שדה חיפוש בשם או טלפון (פילטר real-time על mock data)
- רשימת תוצאות (שם, טלפון, תור אחרון)
- Empty state כשאין תוצאות
- לחיצה על לקוחה → Customer Card
- כפתור "לקוחה חדשה" — disabled (יופעל בפאזה 4)

### Customer Card Screen (`/customer/:id`)
- **Header:** שם מלא, טלפון, אימייל, יתרה כוללת
- **Summary row:** תור קודם / תור הבא / יתרה לתשלום
- **Quick-action buttons** — מופיעים אך disabled: New Order, Record Payment, Book Appointment, Add Note
- **5 טאבים:**
  1. **Active Series** — רשימת סדרות פעילות עם progress bar (כמות / דקות), סטטוס badge, כפתורי פעולה disabled (Start Timer, Mark Complete)
  2. **Treatment History** — רשימה כרונולוגית, thumbnails של תמונות, כפתור View Details
  3. **Orders** — רשימת הזמנות עם סטטוס תשלום ויתרה, כפתורי פעולה disabled
  4. **Payments** — לוג תשלומים מלא, מיון לפי תאריך
  5. **Notes** — רשימת הערות, תאריך + מחבר, כפתור View Full
- **Timer panel** — skeleton ויזואלי בלבד, כפתורי timer disabled (יופעל בפאזה 3)
- Treatment detail modal — read-only עם גלריית תמונות
- Note detail modal — read-only

### Role-based visibility
- כל ה-UI מוצג לפי תפקיד mock (מנהל / מטפלת)
- מנהל רואה פריטי ניווט למסכי ניהול (disabled בפאזה זו)
- מתג "Dev: Switch User" ב-header לבדיקה

## Out of Scope (נדחה לפאזות 2-5)

- כל write action: יצירת הזמנה, תשלום, תור, הערה, לקוחה חדשה
- לוגיקת timer
- Upload תמונות
- מסכי מנהל (Package Types, Therapist Management, Settings, Calendar)
- Backend / DB / auth

## Open Questions

1. **Treatment detail modal** — האם לכלול בפאזה 1 (read-only) או לדחות לפאזה 3 כשיש תמונות אמיתיות? המלצה: לכלול — הטאב קיים, הנתונים ב-mock, הגיוני להציג.
2. **Note detail modal** — דומה: לכלול read-only בפאזה 1? המלצה: כן.

## Acceptance Criteria

1. `npm run dev` מעלה את האפליקציה ללא שגיאות
2. HTML root עם `dir="rtl"`, פונט Assistant, רקע clinic-bg
3. Search: הקלדת שם / טלפון → תוצאות מתעדכנות real-time מ-mock data
4. לחיצה על לקוחה → Customer Card נפתח עם הנתונים הנכונים
5. Customer Card header מציג שם, טלפון, אימייל, יתרה כוללת (sum of remaining_balance)
6. Summary row מציג תור קודם, תור הבא, יתרה לתשלום
7. כפתורי פעולה מהירה (New Order, Record Payment וכו') מוצגים ומסומנים כ-disabled
8. כל 5 הטאבים מציגים נתוני mock תקינים
9. Active Series: progress bar נכון (כמות: X/Y treatments, timer: X/Y minutes)
10. Treatment History: רשימת טיפולים עם thumbnails
11. Orders: יתרה וסטטוס תשלום נכונים לכל הזמנה
12. Payments: לוג מלא ממוין
13. Notes: רשימה עם תאריך ומחבר
14. Timer panel — מוצג כ-skeleton, כפתורים disabled
15. Role-based visibility: therapist לא רואה מסכי ניהול, manager כן
16. מתג "Dev: Switch User" עובד ומחליף role

## Architecture Review

**סטטוס:** אושר

### תיקונים נדרשים (C1–C5) — כולם יאוכלסו בפלאן המעודכן

**C1** — `TherapistWorkingHours`, `TherapistUnavailableDate`, `TherapistCapability`, `GlobalSettings` לא ייכנסו ל-types בפאזה 1. אין להם שימוש ב-Customer Card. יישמרו כ-stub ריק עד הפאזה הרלוונטית.

**C2** — `createCustomer` יצא מ-`CustomerContext`. ייכנס ל-`src/data/customersService.ts` כפונקציה רגילה. `CustomerContext` מחזיק רק את הלקוחה הפעילה.

**C3** — אין stub methods לפעולות CRUD ב-contexts של פאזה 1. Contexts מציגים read-only shape בלבד. Mutation methods יתווספו בפאזה שבה נדרשים לראשונה.

**C4** — `outstandingBalance` ו-`activeSeries` יעברו ל-`src/features/customer/selectors.ts` כ-pure functions. זהו business logic — אסור ב-Presentation layer.

**C5** — `end()` יוסר מ-`ActiveTimerContext` בפאזה 1. Timer context = display state בלבד (`isRunning`, `isPaused`, `elapsedSeconds`, `targetSeriesId`) + `start/pause/resume/reset` כ-no-ops.

### המלצות מאומצות

**R1** — `CustomerSummary` type נפרד מ-`Customer` המלא (לחיפוש ו-header).

**R2** — Mock data מפוצלת לקבצים לפי aggregate root: `customers.ts`, `orders.ts`, `treatments.ts` וכו'.

**R3** — `completedTreatmentsForSeries(series, packageType)` ב-`selectors.ts` מהיום הראשון.

**R4** — שדות כסף (`amount_paid`, `remaining_balance` וכו') ייוצגו כ-`string` בטיפוסי TypeScript.

**R5** — Route יהיה `/customers/:id` (plural), עקבי עם REST API עתידי.

### ADR נדרש

"Customer state layering: context holds data, selectors hold rules, services hold mutations" — יוצר לפני ה-implementation.

### ממצאים שנדחו ל-CHANGE_REQUESTS

- CR-001: GlobalSettings schema inconsistency בין DOMAIN_MODEL.md ל-ERD.md (Phase 2).

## Implemented

### תשתית
- Vite 6 + React 18 + TypeScript (tsconfig.app.json + tsconfig.node.json)
- Tailwind CSS v3 עם design tokens: clinic-bg, clinic-pink, clinic-blush, clinic-gold, clinic-text, clinic-muted, clinic-border
- פונט Assistant מ-Google Fonts, `dir="rtl"` על `<html>` ו-`<body>`
- React Router v6 עם routes: `/` → redirect, `/search`, `/customers/:id`
- App shell: Header (עם dropdown "Dev: Switch User"), Sidebar (עם role-based visibility)

### TypeScript Types (`src/types/`)
- `User.ts`, `Customer.ts`, `TreatmentSeries.ts`, `PackageType.ts`, `Order.ts`, `Payment.ts`, `Treatment.ts`, `Appointment.ts`, `Note.ts`, `TreatmentType.ts`
- `index.ts` — re-export all types
- שדות כסף מיוצגים כ-`string`

### Mock Data (`src/data/`)
- `treatmentTypes.ts` — 3 סוגי טיפול (פנים, לייזר, עיסוי)
- `packageTypes.ts` — 5 סוגי חבילות (quantity + timer series + single)
- `therapists.ts` — 2 משתמשים (Manager + Therapist)
- `customers.ts` — 5 לקוחות (רחל, דנה, אסתר, יעל, נועה)
- `series.ts` — 9 סדרות טיפולים (active quantity, timer, completed)
- `orders.ts` — 10 הזמנות עם order items
- `payments.ts` — 12 תשלומים
- `treatments.ts` — 12 טיפולים, כולל תמונות מ-picsum.photos ל-cust-3
- `appointments.ts` — 15 תורים (עבר ועתיד)
- `notes.ts` — 9 הערות
- `customersService.ts` — `searchCustomers()` + stub `createCustomer()`

### ADR-001: Context holds data · Selectors hold rules · Services hold mutations
- `CustomerContext` — read-only aggregate data, `setActiveCustomer(id)`, `useMemo`/`useCallback`
- `ActiveTimerContext` — display state only, כל פעולות no-ops בפאזה 1
- `src/features/customer/selectors.ts` — pure functions: `outstandingBalance`, `activeSeries`, `completedTreatmentsForSeries`, `previousAppointment`, `nextAppointment`

### Shared Components (`src/components/shared/`)
- `Badge.tsx` — pill badge עם 5 variants
- `ProgressBar.tsx` — horizontal bar עם fill clinic-gold, label
- `Header.tsx` — logo + "Dev: Switch User" dropdown
- `Sidebar.tsx` — nav links עם role-based visibility, active highlight

### Search Feature (`src/features/search/`)
- `SearchScreen.tsx` — input עם debounce 200ms, כפתור "לקוחה חדשה" disabled
- `SearchResults.tsx` — רשימת תוצאות עם שם, טלפון, תור אחרון; empty states

### Customer Card Feature (`src/features/customer/`)
- `CustomerCard.tsx` — layout עם Radix UI Tabs, loads customer on URL param change
- `CustomerCardHeader.tsx` — שם, פרטי קשר, יתרה (from selector)
- `SummaryRow.tsx` — תור קודם / יתרה / תור הבא (from selectors)
- `QuickActionButtons.tsx` — 4 כפתורים disabled
- `TimerPanel.tsx` — skeleton, מוצג רק כשיש timer series פעיל
- `tabs/ActiveSeriesTab.tsx` — progress bar, badge, כפתורי פעולה disabled
- `tabs/TreatmentHistoryTab.tsx` — רשימה עם thumbnails, modal פרטים + גלריה
- `tabs/OrdersTab.tsx` — רשימה עם status badge, יתרה
- `tabs/PaymentsTab.tsx` — לוג תשלומים עם שם מבצע
- `tabs/NotesTab.tsx` — רשימה עם modal "קרא עוד"

## Deferred or Not Implemented

- פאזה 2: New Order, Record Payment, לוגיקת יתרה
- פאזה 3: Timer, Mark Complete, תמונות
- פאזה 4: Book Appointment, Add Note, Create Customer
- פאזה 5: מסכי מנהל

## Database Changes

אין — frontend בלבד עם mock data.

## Domain Changes

TypeScript types ב-`src/types/` — כל ה-entities מה-Domain Model.

## API Changes

אין.

## UI Changes

- כל ה-UI בעברית RTL
- design tokens clinic-* על tailwind.config.js
- פונט Assistant
- מסך חיפוש: input עם ניקוי, empty states, תוצאות clickable
- Customer Card: header + summary row + tabs + timer panel
- Modals: treatment detail, note read-only

## Automated Tests

| Test Type   | Passed | Failed | Notes |
| ----------- | -----: | -----: | ----- |
| Unit        |     45 |      0 | selectors (29) + customersService (10) + SearchScreen (6) — Vitest 3.2.7 |
| Integration |      0 |      0 | Phase 2+ |
| End-to-End  |      0 |      0 | Phase 2+ |

## Manual Validation

**סטטוס:** אושר על-ידי המשתמש

### שיפורי UX/UI שבוצעו במהלך ולידציה ידנית

**RTL Flow:**
- כותרת "חיפוש לקוחה" מימין, כפתור "לקוחה חדשה" משמאל
- Tabs.List עם `dir="rtl"` — טאבים זורמים מימין לשמאל
- אינדקס טיפול בהיסטוריה מופיע מימין (RTL explicit על `<ul>`)

**מסך חיפוש:**
- כל הלקוחות מוצגים בטבלה גם ללא הקלדה (4 עמודות: שם | סדרות פעילות | יתרת חוב | תור הבא)
- Empty state רק כשיש חיפוש פעיל ואין תוצאות

**Customer Card Header:**
- עיגול אינישיאלס + שם מצד ימין, טלפון + מייל מצד שמאל
- טלפון ומייל עם `dir="ltr"` לתצוגת מספרים נכונה

**Summary Row — 5 KPI Cards:**
- תור הבא | יתרת חוב | סה"כ שולם | יחידות שנותרו | סדרות פעילות
- selectors חדשים: `totalPaid()`, `remainingUnits()`

**Tab: סדרות פעילות:**
- שורת סטטיסטיקות בולטת: נרכשו | בוצעו | נותרו (עם מפרידים אנכיים)
- תיקון bidi ב-ProgressBar — הוסף `dir="rtl"` ל-`<p>` label

**Tab: היסטוריית טיפולים:**
- מבנה היררכי לפי חבילה/הזמנה, ממויין לפי תאריך מהאחרון לראשון
- טיפולים מקוננים עם מספור מימין
- הסרת כפתור "פרטים"

**Tab: הזמנות ותשלומים (מוזגו):**
- הצגת חבילות ההזמנה, מספר הזמנה, סיכום כספי, ותשלומים — הכל במקום אחד
- סדר עמודות RTL: סה"כ | שולם | יתרה לתשלום

**TimerPanel:**
- מוצג רק כשטאב "סדרות פעילות" פעיל

## Code Review

**סטטוס:** הושלם — כל הממצאים טופלו

- P1.1: z-60 Tailwind — תוקן (zIndex extend בתצורת Tailwind)
- P1.2: Loading flash ב-CustomerCard — תוקן (isLoading state + skeleton)
- P1.3: previousAppointment סינון שגוי — תוקן (status === 'Completed')
- P2.4: כפילות לוגיקה ב-SearchResults — תוקן (ייבוא selector)
- P2.6: ADR חתימת selector שגויה — תוקן
- P2.7: test חסר ל-previousAppointment — תוקן (2 טסטים חדשים)
- P2.8: floating point ב-outstandingBalance — תוקן (Math.round * 100 / 100)
- P3.9-10: deps לא בשימוש (react-dialog, tailwind-merge) — הוסרו
- P3.13: TimerPanel לא מחובר ל-context — תוקן

ממצאים שנדחו ל-CHANGE_REQUESTS: CR-003 (modal accessibility), CR-007 (smart defaultTab)

## Security Review

**סטטוס:** הושלם — ממצאים קריטיים/גבוהים טופלו

- F-01 Critical: vitest CVE — תוקן (bump ל-3.2.7, npm audit clean)
- F-03 Medium: search input ללא maxLength — תוקן (maxLength=100 + guard)
- F-07 Low: mock data נראית כ-PII אמיתי — תוקן (תגיות synthetic + domain example.co.il)

ממצאים שנדחו ל-CHANGE_REQUESTS: CR-002 (RoleGuard Phase 2), CR-004 (CSP + image allowlist), CR-005 (Error types), CR-006 (default user pattern)

## Documentation Updated

- `phases/phase-001/PHASE_SUMMARY.md` — עודכן
- `PROJECT_STATUS.md` — עודכן
- `PROGRESS.txt` — עודכן

## Version

- Version: v0.1.0
- Commit: (ייווצר עם ה-tag)
- Tag: v0.1.0

## Lessons Learned

- Vitest 2.x ו-Vite 6.x אינם תואמי types — דורשים קובץ `vitest.config.ts` נפרד (לא כולל ב-tsconfig.node.json)
- `/// <reference types="vitest/config" />` לא עובד ב-composite build עם `isolatedModules: true`

## Deferred Requests

- shadcn/ui: לא הותקן דרך CLI (בגלל interactive prompt) — Radix UI primitives הותקנו ישירות
- עיצוב מלא של shadcn/ui theme: נדחה לפאזה 2
