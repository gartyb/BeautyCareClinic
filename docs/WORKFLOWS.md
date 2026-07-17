# Workflows

## Customer Onboarding

1. Search for customer by name or phone.
2. If not found — create customer (full name, phone, email required).
3. Open Customer Card.

## Creating an Order

1. Customer Card → New Order.
2. Select one or more package types.
3. System applies global `default_max_payment_count` to the order.
4. Manager may override `max_payment_count`.
5. Save → `amount_paid = 0`, `remaining_balance = discounted_price`.
6. A `TreatmentSeries` is created automatically for each series package.

## Recording a Payment

1. Customer Card → Record Payment (or from order details).
2. Enter amount, payment method, date.
3. System updates `amount_paid` and `remaining_balance` on the order.
4. Adding payments is blocked once the order reaches `max_payment_count`.
5. Therapists cannot edit payments after saving.

## Running a Timer-Based Treatment

1. Customer Card → Active Series → timer-based series card → "התחל טיימר".
2. Timer panel activates. Controls: השהה | המשך | אפס | סיים טיפול.
3. Only one timer active globally — "התחל טיימר" disabled on other series while running.
4. "סיים טיפול" (elapsed > 0) → `durationMinutes = floor(elapsedSeconds / 60)` added to `usedMinutes`.
5. `completedTreatments` recalculated as `floor(usedMinutes / minutesPerTreatment)` (derived, not stored).
6. A `Treatment` record is created. Progress bar updates immediately.
7. If elapsed = 0 → "סיים טיפול" is disabled; אפס clears the timer without creating a Treatment.

## Recording a Quantity-Based Treatment

1. Customer Card → Active Series or Treatment History → mark treatment as completed.
2. `TreatmentSeries.completed_treatments` incremented by 1.
3. A `Treatment` record is created.

## Adding Photos to a Treatment

1. Open a treatment record in Treatment History.
2. Upload one or more photos.
3. Photos appear in the customer gallery.

## Booking an Appointment

1. Customer Card → Book Appointment (or Appointment Calendar).
2. Select treatment type.
3. Option A — Select date first: system shows available therapists for that date and treatment type.
4. Option B — Select therapist first: system shows the next 5 available dates.
5. Select a time slot (availability = working hours ∩ no unavailable dates ∩ no existing appointments ∩ therapist capability).
6. Save — slot is now blocked.

## Configuring a Therapist *(Manager only)*

1. Therapist Management → select therapist.
2. Set weekly working days and hours.
3. Block specific unavailable dates.
4. Assign supported treatment types.

## Creating a Package Type *(Manager only)*

1. Package Type Management → New Package.
2. Enter name and treatment type.
3. Toggle series → reveals treatment count field.
4. Toggle timer-based (requires series) → reveals minutes-per-treatment field (must be > 0).
5. Save.

## Global Settings *(Manager only)*

1. Global Settings → set `default_max_payment_count` (whole number > 0).
2. Save. Applies to all future orders.

## Access Model and Trust Boundary (Phase 009)

The following rules govern who can access Phase 009 endpoints:

- All authenticated users (Therapist and Manager roles) can read all orders, payments, and treatment series across all customers.
- The system currently has no per-therapist customer scoping. This is intentional: the clinic operates from a single location where all therapists serve all customers.
- Mutations (create/update/delete PackageTypes, update/delete Orders) require the Manager role.
- Creating orders and recording payments are permitted for both roles.
- Future CR-029 covers adding per-therapist scoping if multi-location or per-therapist privacy requirements arise.
