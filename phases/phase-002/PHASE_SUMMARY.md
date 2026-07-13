# Phase 002 — New Order + Record Payment

## Status

Completed — v0.2.0

## Goal

Enable the first write actions on the Customer Card: **New Order** (therapist + manager) and **Record Payment** (therapist + manager), storing all data in-memory React state. No backend in this phase.

## Planned

### New Order Feature
- Modal dialog (Radix Dialog) where therapist selects ≥1 package types from clinic's master list
- System creates `CustomerOrder` + `OrderItem[]` + optional `TreatmentSeries[]` (for series packages) in React state
- Manager sees override field for `maxPaymentCount` (default: `DEFAULT_MAX_PAYMENT_COUNT = 3`); therapist does not
- Order assigned to current user (`createdByUserId`)
- Order stored in `CustomerContext` in-memory orders array

### Record Payment Feature
- Modal dialog (Radix Dialog) with form: amount (string), method (Cash | Credit Card | Bank Transfer | Other), date
- Guard: "Record Payment" button disabled if `paymentCount >= maxPaymentCount` on the order
- Therapists cannot edit payments after saving (UI-only: no edit button)
- Entry point A: Quick-action "Record Payment" on Customer Card header → if 1 open order, go straight to form; if multiple, show order selector first
- Entry point B: Per-order "רשום תשלום" button in Orders & Payments tab → directly to payment form
- After save: update order's `amountPaid` and `remainingBalance`; increment `paymentCount`
- Payment stored in `CustomerContext` in-memory payments array

### Service Layer (Pure Functions)
- `src/features/order/orderService.ts` — `buildNewOrder(customerId, selectedPackageTypeIds, packageTypes, currentUser, maxOverride?)` returns `{ order, items, series[] }`
- `src/features/payment/paymentService.ts` — `buildPayment(...)` and `applyPaymentToOrder(order, payment)` with guard; throws `DomainError` if `paymentCount >= maxPaymentCount`
- `src/domain/errors.ts` — `DomainError extends Error { code: string }`

### UI Components
- `src/features/order/NewOrderModal.tsx` — Radix Dialog, package checkboxes, price summary, manager-only max payment field
- `src/features/payment/RecordPaymentModal.tsx` — Radix Dialog, amount/method/date form, order selector step if needed
- `src/components/shared/RoleGuard.tsx` — conditional render based on `currentUser.role` (scaffold only)

### CustomerContext Upgrade
- Upgrade orders/payments/series from static imports to `useState<>` (initialized from mock, held for all customers)
- Expose `addOrder(order, items, series)` and `addPayment(payment, updatedOrder)` methods
- Filter data per active customer via `useMemo` (unchanged)

### Change Requests Closed in Phase 002
- **CR-002**: Add `<RoleGuard>` component; add comment to `Sidebar.tsx` that client-side role checks are UX-only
- **CR-003**: Migrate `TreatmentHistoryTab` and `NotesTab` custom div modals to Radix Dialog
- **CR-005**: Implement `DomainError` class
- **CR-006**: Add warning comment in `App.tsx` about never defaulting to a privileged role
- **CR-007**: Smart `defaultTab` — fall through to "Treatment History" if no active series

### Dependencies
- Re-add `@radix-ui/react-dialog` to `package.json`

## Out of Scope

- Backend / persistence / database
- Authentication / authorization
- API endpoints
- Editing or deleting existing orders or payments
- Timer functionality (Phase 3)
- Book Appointment, Add Note (Phase 4)
- Manager admin screens (Phase 5)
- CR-001 (GlobalSettings schema) — backend phase
- CR-004 (CSP + image allowlist) — backend/infra phase

## Architecture Review

**Status:** Approved with required corrections — all adopted.

**Corrections applied to implementation plan:**
- C1: `addOrder(order, series[])` — items already embedded in `order.orderItems`
- C2: `addPayment(payment)` — context calls `applyPaymentToOrder` internally; `updatedOrder` not passed by caller
- C3: ID generation via `crypto.randomUUID()` in `src/domain/id.ts`
- C4: `deps?` injection in service functions for testability (`newId`, `now`)
- C5: `buildNewOrder` populates `OrderItem.treatmentSeriesId` before returning
- C6: `buildNewOrder` computes `totalPrice` by summing selected package prices

**Recommendations adopted:**
- M1: `src/domain/money.ts` — `toCents` / `fromCents` for monetary arithmetic
- M2: `DEFAULT_MAX_PAYMENT_COUNT` in `src/domain/constants.ts`
- M3: `src/components/shared/Modal.tsx` — shared Radix Dialog wrapper (RTL + ARIA)
- M4: `openOrders(orders)` selector added to `selectors.ts`

## Open Questions

None.

## Code Review

**Status:** הושלם — כל הממצאים הקריטיים/גבוהים תוקנו.

- P0: `addPayment` atomicity (orphan payment) — תוקן (allOrdersRef + pre-compute)
- P1: `openOrders` `||` → `&&` — תוקן
- P1: `handleSave` empty-selection guard — תוקן
- P1: `maxOverride` range validation [1,24] — תוקן
- P1: Amount regex validation + float-safe comparison — תוקן
- P1: `applyPaymentToOrder` overpayment → DomainError — תוקן
- P1: `initialOrderId` stale — תוקן
- P2: `toCents` NaN guard — תוקן
- P2: `paymentsForOrder` in OrdersTab — תוקן
- P2: UUID-safe order display label — תוקן
- P2: Modal double-close — תוקן
- P2: Date validation (empty + future) — תוקן

נדחו ל-FOLLOWUPS: FU-002 (defaultTab flicker), FU-003 (money.ts tests), FU-004 (orderService test completeness), FU-005 (MAX_ORDER_TOTAL_CENTS), FU-006 (system-flows.md).

## Security Review

**Status:** הושלם — ממצאים Medium תוקנו.

- Medium: `maxOverride` input validation — תוקן (clamp + range)
- Medium: Amount field strict regex — תוקן
- Low: Date validation (future dates) — תוקן
- Low: `openOrders` `&&` fix — תוקן (ראה Code Review)
- Low/P0: `addPayment` atomicity — תוקן (ראה Code Review)
- Medium: UX-only comment added ל-NewOrderModal — תוקן
- Informational: XSS — React auto-escaping, no action
- Informational: `currentUser.id` spoofable — acknowledged per CR-006
- Informational: `@radix-ui/react-dialog` — no CVEs

נדחו ל-FOLLOWUPS: FU-006 (docs/system-flows.md auth documentation).

## Acceptance Criteria

**New Order Modal:**
1. Therapist clicks "New Order" → modal opens with full package type list as checkboxes
2. Selection of ≥1 packages → "שמור הזמנה" button enabled; empty selection → button disabled
3. Manager user sees "מקסימום תשלומים" field with default value; Therapist does not see it
4. Save creates `CustomerOrder` with `amountPaid = "0"`, `remainingBalance = totalPrice`, `paymentCount = 0`, `maxPaymentCount = override || DEFAULT_MAX_PAYMENT_COUNT`
5. Series packages each create a corresponding `TreatmentSeries` record with correct `seriesKind` and initial counts
6. New order appears in Orders & Payments tab immediately after modal closes

**Record Payment Entry Points:**
7. Quick-action "Record Payment" with 1 open order → payment form opens directly
8. Quick-action "Record Payment" with multiple open orders → order selection step shown first
9. Per-order "רשום תשלום" button in tab → payment form opens for that specific order

**Record Payment Form:**
10. Payment modal shows: amount field, method dropdown (4 options), date picker
11. "שמור תשלום" button enabled if `paymentCount < maxPaymentCount`; "Record Payment" buttons disabled otherwise
12. Save creates `Payment` record with amount, method, paymentDate, assigned to current user
13. Order's `amountPaid` increases, `remainingBalance` decreases, `paymentCount` increments by 1
14. Payment appears in Payments section of the order immediately after modal closes

**Post-Save Behavior:**
15. Therapist-created payment: no edit button displayed (UI-only restriction)

**Service Layer & Errors:**
16. `DomainError` class exists in `src/domain/errors.ts` with `code: string` property
17. `applyPaymentToOrder()` throws `DomainError('PAYMENT_COUNT_EXCEEDED', ...)` when guard fails

**RoleGuard & Comments:**
18. `<RoleGuard role="Manager">` renders children only if current user is Manager; hides otherwise
19. `Sidebar.tsx` has comment: client-side role checks are UX-only, not security
20. `App.tsx` has warning comment: never default to privileged role in production

**Smart defaultTab:**
21. Customer with no active series → Customer Card defaults to "היסטוריית טיפולים" tab
22. Customer with active series → Customer Card defaults to "סדרות פעילות" tab

**Modal Accessibility (CR-003):**
23. `TreatmentHistoryTab` treatment detail modal uses Radix Dialog
24. `NotesTab` "קרא עוד" modal uses Radix Dialog
25. New Order and Record Payment modals use Radix Dialog with proper ARIA attributes

**Build & Tests:**
26. `npm run build` passes with no TypeScript or Vite errors
27. `npm run test` passes — all existing + new unit tests for service layer
28. `@radix-ui/react-dialog` present in `package.json`
