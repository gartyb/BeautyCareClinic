# Domain Model

## Entities

| Entity                       | Purpose                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **User**                     | System user with role `Manager` or `Therapist`. Role determines all permissions. `IsActive` (Phase 012) — soft-deactivation flag for staff who left the clinic. |
| **Customer**                 | Clinic customer. Has orders, appointments, treatments, and notes.                                    |
| **TreatmentType**            | Named category of treatment (e.g. facial, laser). Used across packages, appointments, treatments, and notes. |
| **PackageType**              | Clinic-defined package. Can be a quantity-based series, a timer-based series, or neither.            |
| **CustomerOrder**            | Customer purchase. Contains one or more order items. Tracks payments and balance.                    |
| **OrderItem**                | One package type within an order. Creates a `TreatmentSeries` when the package is a series. Carries a stable per-customer `package_number`. |
| **TreatmentSeries**          | Tracks usage of a series package. Either quantity-based or timer-based.                              |
| **Payment**                  | Payment toward an order. Method and date recorded.                                                   |
| **Appointment**              | Scheduled treatment slot. Must not conflict with therapist availability.                             |
| **Treatment**                | Performed treatment. Linked to a series for usage tracking. May have photos.                        |
| **TreatmentPhoto**           | Photo attached to a treatment.                                                                       |
| **TherapistWorkingHours**    | Recurring weekly schedule for a therapist user.                                                      |
| **TherapistUnavailableDate** | One-off date a therapist is unavailable.                                                             |
| **TherapistCapability**      | Which treatment types a therapist can perform.                                                       |
| **Note**                     | Internal note on a customer. Written by a therapist. May reference a treatment type.                |
| **GlobalSettings**           | Clinic-wide settings. Key-value table — each setting is a row with `name` (unique) and `value`. Currently defined: `default_max_payment_count`. |

## Business Rules

### Timer-based series
- `PackageType.is_timer_based` requires `PackageType.is_series = true`.
- `minutes_per_treatment` is required and must be > 0 for timer-based packages.
- Completed treatments = `floor(used_minutes / minutes_per_treatment)`.
- Each timer session adds its duration to `TreatmentSeries.used_minutes`.

### Orders and payments
- Total customer balance = sum of `remaining_balance` across all open orders. Displayed on the Customer Card summary row.
- A new order receives the global `default_max_payment_count`.
- A manager may override `max_payment_count` on a specific order.
- Payments can be added until the order reaches its `max_payment_count`.
- `amount_paid` and `remaining_balance` are updated after each payment.
- Therapists cannot edit payments after saving.

### Package numbering (CR-031)
- Every `OrderItem` carries a `package_number`, unique per customer and assigned once at order-creation time in purchase order (1, 2, 3, ...).
- Numbers are never reassigned: when a package completes or its order is deleted, its number is retired — gaps in the sequence are expected and correct.
- Assignment is race-free under concurrent order creation because it locks the owning `Customer` row (`SELECT ... FOR UPDATE`) before computing the next number.
- `TreatmentSeries` does not store its own copy of the number; it is read through `TreatmentSeries.OrderItem.PackageNumber`.
- This is the single source of truth for the "#N" package badge shown on both the Active Series tab and the Treatment History tab of the Customer Card, so the same package always shows the same number in both places.

### Appointments (Phase 011)
- Eligibility: a customer may only book an appointment for a `TreatmentType` they hold an active `TreatmentSeries` for (quantity-based with remaining sessions, or timer-based with remaining minutes). A customer with no active series for a given treatment type cannot select it when booking. Enforced client-side today (`BookAppointmentModal.tsx`); server-side enforcement is tracked as CR-032.
- Availability = working hours ∩ no unavailable dates ∩ no existing `Scheduled`/`Completed` appointment for that therapist ∩ therapist capability for the treatment type.
- A booking cannot be saved in an unavailable slot; the check runs server-side, not just client-side.
- Status scope for this phase: only `Scheduled` → `Cancelled` (via cancel). `Completed`/`NoShow` and any Appointment → Treatment link are deferred.
- Create: any authenticated user. Reschedule/cancel: the appointment's assigned therapist (author) or a Manager — same author-or-Manager pattern as `Treatment`/`Note`.
- Reschedule is blocked for every role, including Manager, if the appointment is not currently `Scheduled` or its current start time has already passed — no exception.
- Double-booking prevention invariant (ADR-011-A): any code that inserts or moves an `Appointment` must first lock the target therapist's `User` row (`SELECT ... FOR UPDATE`) within the same transaction, as a serialization mutex — not by locking `Appointment` rows, since the conflicting row may not exist yet at lock time.
- `TherapistWorkingHours`/`TherapistUnavailableDate`/`TherapistCapability` (Phase 012) have full CRUD via `/api/v1/therapists/{userId}/working-hours|capabilities|unavailable-dates` (Manager-only writes, both-roles reads) — superseding Phase 011's seed-only status. Availability rejects a booking/reschedule against an inactive therapist (see below).

### Therapist Management and Deactivation (Phase 012)
- `User.IsActive` (default `true`) marks whether a therapist is still at the clinic. Setting it to `false` (`PUT /api/v1/users/{id}/deactivate`, Manager-only) is a soft-delete: it does not cascade to appointments/treatments/notes, which remain fully valid and queryable, snapshotted with the therapist's name as before. It is distinct from `DELETE /api/v1/users/{id}` (true hard-delete, still blocked by existing history via FK-restrict — a 409, not a 500).
- Deactivation deliberately does not auto-cancel or flag the therapist's future `Scheduled` appointments — left to manager judgment (accepted risk, not a defect; same accepted-risk class as the ADR-011-A note on schedule edits below).
- Effects of deactivation: excluded from `GET /api/v1/therapists` (always active-only) and from the default `GET /api/v1/therapists/availability` response (`?includeInactive=true` is a Manager-oriented escape hatch); rejected at login (`AuthController.Login`, same 401 shape as an unknown/wrong-password login — no distinct "deactivated" signal); rejected as a booking/reschedule target (`POST /customers/{customerId}/appointments`, `PUT /appointments/{id}`) with a 422 Hebrew reason ("המטפלת המבוקשת לא פעילה"), checked inside `AvailabilityService.CheckAvailabilityAsync`.
- Working-hours/capability/unavailable-date writes require the target `userId` to resolve to an existing, active `Therapist`-role `User` — editing an inactive therapist's schedule is rejected (422), matching the frontend's read-only presentation for an inactive therapist's detail screen.
- ADR-011-A scope note: schedule edits (working hours / capabilities / unavailable dates) intentionally do not take the therapist's `User`-row lock and do not retroactively validate existing appointments; narrowing a therapist's availability can leave already-booked appointments outside the new constraints — same accepted-risk class as the deactivation risk above.
- Therapist creation (`POST /api/v1/users`) and account creation/editing remain Manager-only, unchanged from Phase 007/008 except for the addition of `IsActive` to the response.

### Permissions
- Managers can create and edit all data.
- Therapists can create orders and payments only; cannot edit after saving.
- Only managers can access therapist management (including deactivation and schedule/capability management), package type management, and global settings.

## Relationships

```
Customer ──< CustomerOrder ──< OrderItem >── PackageType >── TreatmentType
                  │                │
                  └──< Payment     └──> TreatmentSeries ──< Treatment ──< TreatmentPhoto

Customer ──< Appointment >── TreatmentType
Customer ──< Treatment >── TreatmentType
Customer ──< Note >── TreatmentType

User (Therapist) ──< Appointment
User (Therapist) ──< Treatment
User (Therapist) ──< Note
User (Therapist) ──< TherapistWorkingHours
User (Therapist) ──< TherapistUnavailableDate
User (Therapist) ──< TherapistCapability >── TreatmentType
```
