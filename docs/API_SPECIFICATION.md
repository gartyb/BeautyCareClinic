# API Specification

Base URL: `/api/v1`

Authentication: JWT Bearer token. Obtain via `POST /auth/login`.

Roles: `Manager` (full access) | `Therapist` (read + limited write).

---

## Error Response Format

All errors return:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message.",
  "timestamp": "2026-07-17T00:00:00Z",
  "traceId": "request-id"
}
```

Common codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `ACCOUNT_LOCKED`.

---

## Auth

### POST /api/v1/auth/login

No auth required.

**Request:**
```json
{ "email": "manager@clinic.local", "password": "Clinic@123" }
```

**Response 200:**
```json
{
  "accessToken": "<jwt>",
  "expiresIn": 86400,
  "user": { "id": "<uuid>", "fullName": "...", "email": "...", "role": "Manager" }
}
```

**Response 401:** Invalid credentials.
**Response 429:** Account locked (too many failed attempts).

---

### GET /api/v1/auth/me

Auth: JWT.

**Response 200:**
```json
{ "id": "<uuid>", "fullName": "...", "email": "...", "role": "Therapist" }
```

---

## Customers

All endpoints require JWT. Write endpoints with `Manager` notation require Manager role.

### GET /api/v1/customers

Returns all customers. Optional `?search=<term>` filters by name or phone (case-insensitive ILike).

**Response 200:** `Customer[]`

```json
[{ "id": "<uuid>", "fullName": "שירה לוי", "phone": "052-2345678", "email": "shira@example.com" }]
```

### GET /api/v1/customers/{id}

**Response 200:** `Customer` | **404** if not found.

### POST /api/v1/customers

**Request:** `{ "fullName": "...", "phone": "...", "email": "..." }`

Validation: `fullName` required; `email` must be valid format if provided.

**Response 201:** Created `Customer`.

### PUT /api/v1/customers/{id} — Manager

**Request:** `{ "fullName": "...", "phone": "...", "email": "..." }`

**Response 200:** Updated `Customer` | **404**.

### DELETE /api/v1/customers/{id} — Manager

**Response 204** | **409** if customer has related orders, appointments, or treatments.

---

## Treatment Types

### GET /api/v1/treatment-types

Auth: JWT. Returns all treatment types.

**Response 200:** `TreatmentType[]`
```json
[{ "id": "<uuid>", "name": "פנים" }]
```

### GET /api/v1/treatment-types/{id}

**Response 200:** `TreatmentType` | **404**.

### POST /api/v1/treatment-types — Manager

**Request:** `{ "name": "..." }`

**Response 201:** Created `TreatmentType`.

### PUT /api/v1/treatment-types/{id} — Manager

**Request:** `{ "name": "..." }`

**Response 200:** Updated `TreatmentType` | **404**.

### DELETE /api/v1/treatment-types/{id} — Manager

**Response 204** | **409** if referenced by treatments, appointments, notes, or package types.

---

## Users

All endpoints require Manager role.

### GET /api/v1/users

Optional `?role=Manager|Therapist` filter.

**Response 200:** `User[]`
```json
[{ "id": "<uuid>", "fullName": "...", "email": "...", "role": "Therapist" }]
```

### GET /api/v1/users/{id}

**Response 200:** `User` | **404**.

### POST /api/v1/users

Creates a Therapist (Managers cannot be created via API).

**Request:** `{ "fullName": "...", "email": "...", "password": "..." }`

Validation: email unique; password meets Identity policy (min 8 chars, uppercase, digit, non-alphanumeric).

**Response 201:** Created `User`.

### PUT /api/v1/users/{id}

Updates `fullName` and/or `email`. Role cannot be changed via API.

**Request:** `{ "fullName": "...", "email": "..." }`

**Response 200:** Updated `User` | **404** | **409** email conflict.

### DELETE /api/v1/users/{id}

Cannot delete self.

**Response 204** | **400** if self-delete attempted | **404**.

---

## Global Settings

### GET /api/v1/global-settings

Auth: JWT.

**Response 200:**
```json
[{ "name": "default_max_payment_count", "value": "12" }]
```

### PUT /api/v1/global-settings — Manager

**Request:** `[{ "name": "default_max_payment_count", "value": "10" }]`

Only known keys are accepted. Unknown keys return **400**.

**Response 200:** Updated settings array.

---

## Package Types

Auth: JWT. Write endpoints require Manager role.

### GET /api/v1/package-types

**Response 200:** `PackageType[]`
```json
[{ "id": "<uuid>", "treatmentTypeId": "<uuid>", "name": "חבילת פנים", "price": "200.00", "isSeries": true, "isTimerBased": false, "treatmentCount": 5, "minutesPerTreatment": 0 }]
```

### GET /api/v1/package-types/{id}

**Response 200:** `PackageType` | **404**.

### POST /api/v1/package-types — Manager

**Request:** `{ "treatmentTypeId": "<uuid>", "name": "...", "price": 200.00, "isSeries": true, "isTimerBased": false, "treatmentCount": 5, "minutesPerTreatment": 0 }`

Validation: `isSeries = false` disallows `isTimerBased = true`. `isTimerBased = true` requires `minutesPerTreatment > 0`.

**Response 201:** Created `PackageType`.

### PUT /api/v1/package-types/{id} — Manager

**Request:** Same as POST.

**Response 200:** Updated `PackageType` | **404**.

### DELETE /api/v1/package-types/{id} — Manager

**Response 204** | **409** if referenced by an `OrderItem`.

---

## Orders

Auth: JWT. Write endpoints require Manager role unless noted.

### GET /api/v1/customers/{customerId}/orders

**Response 200:** `CustomerOrder[]` — summary list including `paymentCount`.

### GET /api/v1/orders/{id}

**Response 200:** Full `CustomerOrder` with nested `items`, `payments`. | **404**.

```json
{
  "id": "<uuid>", "customerId": "<uuid>", "orderDate": "2026-07-17",
  "originalPrice": "1000.00", "discountedPrice": "900.00", "discountPercentage": "10.00",
  "maxPaymentCount": 3, "amountPaid": "450.00", "remainingBalance": "450.00",
  "paymentCount": 1,
  "items": [{ "id": "<uuid>", "packageTypeId": "<uuid>", "unitPrice": "200.00", "treatmentSeriesId": "<uuid>", "packageNumber": 1 }],
  "payments": [{ "id": "<uuid>", "amount": "450.00", "paymentMethod": "Cash", "paymentDate": "2026-07-17", "recordedByFullName": "..." }]
}
```

### POST /api/v1/customers/{customerId}/orders

Creates order + items + treatment series (for `is_series` packages) in a single transaction.

**Request:**
```json
{ "discountPercentage": 10, "maxPaymentCount": 3, "items": [{ "packageTypeId": "<uuid>" }] }
```

`maxPaymentCount` defaults to `GlobalSettings.default_max_payment_count` if omitted.

**Response 201:** Created `CustomerOrder` (full). | **404** customer or packageType not found. | **422** validation error.

### PUT /api/v1/orders/{id} — Manager

Updates `discountPercentage` and/or `maxPaymentCount` only.

**Response 200:** Updated `CustomerOrder`. | **404**.

### DELETE /api/v1/orders/{id} — Manager

**Response 204** | **409** if order has payments or treatments linked to its series.

---

## Payments

Auth: JWT.

### GET /api/v1/orders/{orderId}/payments

**Response 200:** `Payment[]`.

### POST /api/v1/orders/{orderId}/payments

**Request:** `{ "amount": 450.00, "paymentMethod": "Cash", "paymentDate": "2026-07-17" }`

`paymentMethod` allowlist: `Cash`, `Credit Card`, `Bank Transfer`, `Check`, `Other`.
`recordedByUserId` / `recordedByFullName` are server-derived from JWT — never accepted from client.

**Response 201:** Created `Payment`. | **422** amount ≤ 0, amount > remainingBalance, or amount > 99,999,999.99. | **409** paymentCount ≥ maxPaymentCount.

Payment rows are immutable — no PUT or DELETE.

---

## Treatment Series

Auth: JWT. Read-only — created automatically from orders.

### GET /api/v1/customers/{customerId}/treatment-series

Returns active series only (quantity: `completedTreatments < totalTreatments`; timer: `usedMinutes < totalMinutes`).

**Response 200:** `TreatmentSeries[]`. Each series includes `packageNumber` (int) — the stable per-customer package number read through the series' `OrderItem`. This is the same value returned as `packageNumber` on the corresponding item in `GET /api/v1/customers/{customerId}/orders`, so the "#N" badge is consistent between the Active Series and Treatment History views on the Customer Card.

### GET /api/v1/treatment-series/{id}

**Response 200:** `TreatmentSeries` | **404**.

---

## Treatments

Auth: JWT.

`userId` / `performedByFullName` are server-derived from JWT — never accepted from client.

### GET /api/v1/customers/{customerId}/treatments

Returns treatments for a customer, sorted by date DESC.

**Response 200:** `TreatmentDto[]`.

### GET /api/v1/treatments/{id}

**Response 200:** `TreatmentDto` | **404**.

### POST /api/v1/customers/{customerId}/treatments

**Request:**
```json
{
  "treatmentTypeId": "<uuid>",
  "treatmentSeriesId": "<uuid | null>",
  "treatmentDate": "2026-07-17",
  "durationMinutes": 60,
  "notes": "optional note text"
}
```

If `treatmentSeriesId` is provided: atomically increments `UsedMinutes` (timer) or `CompletedTreatments` (quantity), clamped at series cap. Uses `SELECT FOR UPDATE` to prevent concurrent lost updates.

**Response 201:** Created `TreatmentDto`. | **422** `durationMinutes < 0` or `treatmentDate > today`. | **404** customer or treatment type not found.

### PUT /api/v1/treatments/{id}

**Request:**
```json
{
  "notes": "optional note text"
}
```

Only `notes` is mutable via this endpoint — all other treatment fields (type, series, date, duration) are immutable after creation. Requires author or Manager role.

**Response 200:** Updated `TreatmentDto`. | **403** not author and not Manager. | **404** not found. | **422** `notes` > 5000 chars.

### DELETE /api/v1/treatments/{id}

Deletes treatment and reverses series counters (clamped ≥ 0). Requires author or Manager role.

**Response 204** | **403** not author and not Manager | **404**.

---

## Notes

Auth: JWT.

`userId` / `writtenByFullName` are server-derived from JWT — never accepted from client.

### GET /api/v1/customers/{customerId}/notes

Returns notes for a customer, sorted by date DESC.

**Response 200:** `NoteDto[]`.

### GET /api/v1/notes/{id}

**Response 200:** `NoteDto` | **404**.

### POST /api/v1/customers/{customerId}/notes

**Request:**
```json
{
  "treatmentTypeId": "<uuid | null>",
  "noteDate": "2026-07-17",
  "content": "note text (max 5000 chars)"
}
```

**Response 201:** Created `NoteDto`. | **422** `content` empty or > 5000 chars, or `noteDate > today`. | **404** `treatmentTypeId` provided but not found.

### PUT /api/v1/notes/{id}

Same request body as POST. Requires author or Manager role.

**Response 200:** Updated `NoteDto`. | **403** | **404** | **422**.

### DELETE /api/v1/notes/{id}

Requires author or Manager role.

**Response 204** | **403** | **404**.

---

## Appointments

Auth: JWT. Read (list/get) is available to any authenticated user. Create is available to any
authenticated user. Update (reschedule) / Delete (cancel) require the appointment's assigned
therapist (`userId`) or a Manager.

`startTime` / `endTime` are naive local time (Israel, no DST-aware conversion — same convention as
`TreatmentDate` / `PaymentDate` / `NoteDate`; CR-019's DateTimeOffset migration stays deferred).
`userFullName` is snapshotted at creation/reschedule time, matching the
`performedByFullName` / `writtenByFullName` / `recordedByFullName` pattern used elsewhere.

Phase 011 MVP status scope: only `Scheduled` → `Cancelled` (via DELETE) is supported.
`Completed` / `NoShow` and any Appointment → Treatment link are out of scope.

### GET /api/v1/appointments

Returns every appointment, ordered by `startTime` ascending.

**Response 200:** `AppointmentDto[]`.

### GET /api/v1/customers/{customerId}/appointments

Returns a customer's appointments, ordered by `startTime` ascending.

**Response 200:** `AppointmentDto[]` | **404** customer not found.

### GET /api/v1/appointments/{id}

**Response 200:** `AppointmentDto` | **404**.

### POST /api/v1/customers/{customerId}/appointments

**Request:**
```json
{
  "treatmentTypeId": "<uuid>",
  "userId": "<uuid — the therapist being booked>",
  "startTime": "2026-07-26T10:00:00",
  "endTime": "2026-07-26T11:00:00"
}
```

Validates, in order: `endTime > startTime`; `startTime` not in the past; `customerId` /
`treatmentTypeId` / `userId` exist; `userId` resolves to a `Therapist`-role user; then a full
availability check (working hours cover the slot / no unavailable-date entry / therapist has
capability for the treatment type / no overlapping `Scheduled`/`Completed` appointment for that
therapist). Double-booking is prevented by locking the therapist's `User` row
(`SELECT ... FOR UPDATE`) before the overlap check + insert (ADR-011-A) — not by locking
`Appointment` rows, which would not block a concurrent phantom insert.

**Known gap (CR-032):** the customer must hold an active `TreatmentSeries` for `treatmentTypeId`
(see Domain Model → Appointments). This is currently enforced only by the client
(`BookAppointmentModal.tsx`) and not by this endpoint — a direct API call can create an
appointment for a customer with no active package.

**Response 201:** Created `AppointmentDto`. | **404** customer/treatmentType/therapist not found. | **422** validation failure (bad time range, past start time, `userId` not a Therapist). | **409** availability conflict, with a Hebrew reason.

### PUT /api/v1/appointments/{id}

Reschedules `startTime` / `endTime` / `userId` (therapist). Requires the appointment's author
(assigned therapist) or a Manager. Blocked for **every** role, including Manager, if the
appointment is not currently `Scheduled` or its current `startTime` has already passed — there is
no override. If the therapist changes, both the old and new therapist's `User` rows are locked in
ascending-GUID order (to avoid deadlocking against a concurrent reschedule doing the reverse swap),
and the appointment being moved is excluded from its own overlap check.

**Request:** same shape as POST, without `treatmentTypeId` (immutable after creation).

**Response 200:** Updated `AppointmentDto`. | **403** | **404** appointment/therapist not found. | **409** appointment not `Scheduled` / already in the past / availability conflict. | **422** validation failure.

### DELETE /api/v1/appointments/{id}

Cancels (`Scheduled` → `Cancelled`). Requires the appointment's author or a Manager. No hard
delete; no soft-delete audit trail (out of scope for Phase 011).

**Response 204** | **403** | **404** | **409** appointment not currently `Scheduled`.

## Therapist Availability (read-only)

### GET /api/v1/therapists/availability

Auth: JWT, any authenticated user (not Manager-restricted — the appointment calendar's therapist
picker must be usable by Therapist-role users too). Returns all `TherapistWorkingHours` /
`TherapistUnavailableDate` / `TherapistCapability` rows, keyed by real `User.Id`. Read-only —
there is no write/management API for this data in Phase 011 (deferred); the rows are seed data
only (see `DbSeeder.cs`).

**Response 200:**
```json
{
  "workingHours": [
    { "id": "<uuid>", "userId": "<uuid>", "weekday": 0, "startTime": "09:00", "endTime": "17:00" }
  ],
  "unavailableDates": [
    { "id": "<uuid>", "userId": "<uuid>", "date": "2026-08-09" }
  ],
  "capabilities": [
    { "id": "<uuid>", "userId": "<uuid>", "treatmentTypeId": "<uuid>" }
  ]
}
```

`weekday` is `0`=Sunday..`6`=Saturday (matches both the backend `Weekday` enum's declaration order
and the frontend's `Date.getDay()` convention — no remapping required).

---

## Planned Endpoints (Phase 12+)

| Resource              | Planned |
| ---------------------- | ------- |
| Treatment Photos       | Upload + list |
| Working Hours mgmt API | Per-therapist create/update (currently seed-only, read exposed via `GET /api/v1/therapists/availability`) |
| Unavailable Dates mgmt API | Per-therapist create/update (currently seed-only) |
| Therapist Capability mgmt API | Per-therapist create/update (currently seed-only) |
