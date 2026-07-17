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
  "items": [{ "id": "<uuid>", "packageTypeId": "<uuid>", "unitPrice": "200.00", "treatmentSeriesId": "<uuid>" }],
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

**Response 200:** `TreatmentSeries[]`.

### GET /api/v1/treatment-series/{id}

**Response 200:** `TreatmentSeries` | **404**.

---

## Planned Endpoints (Phase 10+)

| Resource             | Planned |
| -------------------- | ------- |
| Treatments           | CRUD per customer (Phase 010) |
| Treatment Photos     | Upload + list (Phase 011) |
| Appointments         | CRUD + availability (Phase 011) |
| Working Hours        | Per therapist (Phase 011) |
| Unavailable Dates    | Per therapist (Phase 011) |
| Therapist Capability | Per therapist (Phase 011) |
