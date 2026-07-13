# UI

## Design Language

Premium beauty-clinic aesthetic. Soft, calm, and intuitive.

| Aspect    | Spec                                                       |
| --------- | ---------------------------------------------------------- |
| Colors    | Soft pink (`#F6D6D9`) and champagne gold (`#D8B56D`)      |
| Background| Off-white blush (`#FFF8F6`)                                |
| Typography| Assistant (Google Fonts), RTL-first                        |
| Direction | RTL Hebrew throughout (`dir="rtl"` on `<html>`)           |
| Cards     | Soft shadows, rounded corners, `clinic-blush` backgrounds  |
| Mockups   | `docs/mockups/` — visual source of truth                   |

## Screens

### Customer Card (Priority 1)

The highest-priority screen. Therapist must read full customer status in seconds.

**Header (right → left):**
- RIGHT: Avatar circle with initials, then name
- LEFT: Phone number (LTR) and email (LTR)

**Summary row (KPI cards):** תור הבא | יתרת חוב | סה"כ שולם | יחידות שנותרו | סדרות פעילות

**Quick-action buttons (disabled in Phase 1):** New Order, Record Payment, Book Appointment, Add Note

**Tabs (RTL order — right to left):** סדרות פעילות | היסטוריית טיפולים | הזמנות ותשלומים | הערות

**Tab: סדרות פעילות**
- Stats row per series: נרכשו | בוצעו | נותרו (with dividers)
- Progress bar with label (e.g. "3 מתוך 10 טיפולים")
- Action buttons disabled (Start Timer, Mark Complete)

**Tab: היסטוריית טיפולים**
- Grouped by package/order-item, newest first
- Each package expands to show individual treatment rows (date, therapist, duration)
- Treatment index shown on RIGHT per RTL convention

**Tab: הזמנות ותשלומים** (merged Orders + Payments)
- Per order: header with status badge + order number, package items list, financial summary (סה"כ | שולם | יתרה לתשלום), then payment log

**Tab: הערות**
- Notes list with date, author, "קרא עוד" modal

**Timer panel:** Appears only when **סדרות פעילות** tab is active and a timer series exists. Skeleton / disabled in Phase 1.

Mockup: `docs/mockups/customer-screen-mockup.png`

### Customer Search / List

All customers displayed immediately in a table (4 columns: שם | סדרות פעילות | יתרת חוב | תור הבא).
Real-time filter by name or phone. Click row to open Customer Card.
"לקוחה חדשה" button (disabled in Phase 1) on LEFT; page title on RIGHT.

### Appointment Calendar

View, create, and manage appointments. Availability-aware slot selection.

### Package Type Management *(Manager only)*

List, create, and edit package types. Timer-based constraints enforced in UI.

### Therapist Management *(Manager only)*

Configure working hours, unavailable dates, and treatment capabilities per therapist.

### Global Settings *(Manager only)*

Set default maximum payment count.

## Component Conventions

- Shared components: `src/components/`
- Feature-specific components: `src/features/<feature>/`
- Custom Tailwind tokens: `clinic-*` class names
- RTL mirroring: `rtl:` Tailwind variants
- Base components: shadcn/ui styled with clinic tokens
