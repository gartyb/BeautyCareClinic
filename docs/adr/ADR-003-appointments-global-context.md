# ADR-003 — Appointments Live in a Global Context, Not Per-Customer

## Status

Approved — Phase 006

## Context

Phase 006 introduces the Appointment entity and an appointment calendar screen that must display all clinic appointments across all customers. The existing `CustomerContext` is scoped to the currently active customer and uses `useMemo` to derive per-customer data. Placing appointments inside `CustomerContext` would limit their visibility to a single customer at a time, breaking the calendar view.

Additionally, two components read appointments today:
- `SummaryRow.tsx` — reads next appointment for the active customer
- `SearchResults.tsx` — reads next appointment per row from a static module import

## Decision

1. **Global `AppointmentsContext`** — A new context holds the full appointments list for all customers, initialized from `src/data/appointments.ts`. This mirrors `CustomersContext`, `TherapistsContext`, and `TreatmentTypesContext`, which are all global list contexts.

2. **`CustomerContext` drops `appointments`** — The active customer context no longer holds or derives appointments. Consumers (`SummaryRow`, `SearchResults`) migrate to `useAppointments()` and filter by `customerId` themselves.

3. **`isSlotAvailable` is the single availability primitive** — `getAvailableSlots` and `getAvailableTherapists` are thin wrappers that compose `isSlotAvailable`. This prevents the four-condition availability logic from being duplicated.

4. **Datetime convention: naive local ISO** — All appointment datetimes are stored as `YYYY-MM-DDTHH:mm:ss` (no timezone offset). Comparisons use `new Date(a) < new Date(b)` — consistent as long as all values use the same convention. Timezone-aware storage is deferred to the backend phase.

5. **Provider order** — `AppointmentsProvider` is inserted between `PackageTypesProvider` and `CustomerProvider`:
   ```
   GlobalSettings → Customers → TherapistData → Therapists → TreatmentTypes → PackageTypes → Appointments → Customer → ActiveTimer
   ```

## Alternatives Considered

- **Appointments inside `CustomerContext`** — Rejected. Breaks the calendar view which must display appointments for all customers simultaneously.
- **Appointments fetched per-component** — Rejected. Would require prop-drilling or repeated filtering; inconsistent with the established context pattern.
- **Separate `isSlotAvailable` and `getAvailableSlots` with shared helper** — Accepted as the implementation approach.

## Consequences

- Booking a new appointment is immediately visible in both the calendar screen and the `SearchResults` "תור הבא" column within the same session.
- `CustomerContext` is simpler (no appointments array or derived selectors).
- When backend is added, `AppointmentsContext` is the single integration point for appointment API calls.
- Timezone handling must be revisited before production; naive local ISO is a known limitation.
