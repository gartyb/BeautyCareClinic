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

1. Customer Card → Active Series → select a timer-based series → Start Timer.
2. Timer shows elapsed time. Controls: pause, resume, reset.
3. End treatment → duration added to `TreatmentSeries.used_minutes`.
4. System recalculates `completed_treatments = floor(used_minutes / minutes_per_treatment)`.
5. A `Treatment` record is created with the measured `duration_minutes`.

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
