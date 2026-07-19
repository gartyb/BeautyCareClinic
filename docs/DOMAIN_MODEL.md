# Domain Model

## Entities

| Entity                       | Purpose                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **User**                     | System user with role `Manager` or `Therapist`. Role determines all permissions.                    |
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

### Appointments
- Availability = working hours ∩ no unavailable dates ∩ no existing appointments ∩ therapist capability for the treatment type.
- A booking cannot be saved in an unavailable slot.

### Permissions
- Managers can create and edit all data.
- Therapists can create orders and payments only; cannot edit after saving.
- Only managers can access therapist management, package type management, and global settings.

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
