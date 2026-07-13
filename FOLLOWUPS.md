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

## FU-001: Vitest 2.x / Vite 6.x type incompatibility

Vitest 2.x bundles its own vite (v5.x), which conflicts with top-level vite 6.x plugin types.
As a result, `vitest.config.ts` is not included in `tsconfig.node.json` (types not checked at build time).

Resolution options:
- Upgrade vitest to v3.x (compatible with vite 6)
- Or accept the separate config file workaround

Deferred to: Phase 2 dependency audit.

