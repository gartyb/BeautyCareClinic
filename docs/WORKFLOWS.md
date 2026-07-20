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

## Booking an Appointment (Phase 011 — backed by a real API)

1. Customer Card → Book Appointment (or Appointment Calendar).
2. Select treatment type — only treatment types the customer holds an active package (`TreatmentSeries`) for are offered. A customer with no active series for any treatment type cannot proceed (shown as "אין חבילות פעילות ללקוחה זו"); they must purchase a package first.
3. Option A — Select date first: system shows available therapists for that date and treatment type.
4. Option B — Select therapist first: system shows the next 5 available dates.
5. Select a time slot (availability = working hours ∩ no unavailable dates ∩ no existing appointments ∩ therapist capability — checked server-side by `POST /api/v1/customers/{customerId}/appointments`, not just client-side).
6. Save — slot is now blocked. Double-booking under concurrent requests for the same therapist/slot is prevented by locking the therapist's `User` row before the availability check + insert (ADR-011-A); the loser(s) receive a 409 with a Hebrew reason.
7. Validation errors (past time, therapist not qualified, slot unavailable) surface as a Hebrew toast.

## Rescheduling or Cancelling an Appointment *(author therapist or Manager)*

1. Open the appointment (calendar or Customer Card) → "עדכן" (reschedule) or "בטל" (cancel).
2. Reschedule (`PUT /api/v1/appointments/{id}`) may change date, time, and/or therapist, and re-runs
   the full availability check against the new slot (excluding the appointment's own current slot).
   Changing the therapist locks both the old and new therapist's `User` rows (ascending-GUID order)
   to avoid deadlocking against a concurrent reschedule doing the reverse swap.
3. Reschedule is blocked (409) if the appointment is not currently `Scheduled`, or if its current
   start time has already passed — for every role, including Manager; there is no override.
4. Cancel (`DELETE /api/v1/appointments/{id}`) transitions `Scheduled` → `Cancelled`. No hard
   delete, no soft-delete audit trail. Blocked (409) if the appointment is not currently `Scheduled`.
5. Both actions are hidden from the UI (and rejected 403 server-side) for a therapist who isn't the
   appointment's author, unless they are a Manager.

## Creating a Therapist *(Manager only, Phase 012)*

1. Therapist Management → "מטפלת חדשה" → enter full name, email, password, phone.
2. Save → `POST /api/v1/users` (server hardcodes `role=Therapist`) → the new therapist appears in the active therapist list immediately, but has no working hours/capabilities configured yet — every booking against them fails availability until a Manager finishes setup (not a defect, expected onboarding step).

## Configuring a Therapist *(Manager only, Phase 012 — backed by a real API)*

1. Therapist Management → select therapist.
2. Set weekly working days and hours — `POST`/`PUT`/`DELETE /api/v1/therapists/{userId}/working-hours[/{weekday}]`. Both start/end empty = day off.
3. Block specific unavailable dates — `POST`/`DELETE /api/v1/therapists/{userId}/unavailable-dates[/{date}]`.
4. Assign supported treatment types — `POST`/`DELETE /api/v1/therapists/{userId}/capabilities[/{treatmentTypeId}]`.
5. Each section shows a loading state while saving and a Hebrew error toast on failure (e.g. invalid time range, duplicate entry).
6. These three sections become read-only once the therapist is deactivated (see below) — the backend also rejects the write server-side (422) as a second line of defense.

## Deactivating a Therapist *(Manager only, Phase 012)*

1. Therapist Management → select therapist → "בטל פעילות" (visible only while the therapist is active) → confirm.
2. `PUT /api/v1/users/{id}/deactivate` sets `isActive=false`. The therapist immediately disappears from `GET /api/v1/therapists` (booking/reschedule pickers) and from the default therapist list/availability view; their past appointments, treatments, and notes remain fully visible, still labeled with their name as before.
3. Future `Scheduled` appointments already booked with this therapist are **not** auto-cancelled or flagged — left to manager judgment (accepted risk, documented, not tooled around in this phase).
4. Attempting to book or reschedule an appointment against a deactivated therapist (directly via API, bypassing the now-filtered picker) is rejected with **422** and the Hebrew reason "המטפלת המבוקשת לא פעילה".
5. A deactivated therapist can no longer log in — `POST /api/v1/auth/login` rejects the attempt with the same 401 shape as an unknown email or wrong password, even though their password is still valid and their identity record is untouched.
6. Deactivation is a soft-delete distinct from `DELETE /api/v1/users/{id}` (hard-delete), which stays blocked (409) whenever the therapist has any appointment/treatment/note history — deactivation is the correct action for a departed therapist with real history; hard-delete remains only for a genuine duplicate/mistaken account with no history.

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
