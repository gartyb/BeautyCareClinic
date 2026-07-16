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

## Planned Endpoints (Phase 8+)

| Resource             | Planned |
| -------------------- | ------- |
| Orders               | CRUD per customer |
| Order Items          | Add/remove |
| Payments             | Create per order |
| Treatment Series     | Read per order item |
| Treatments           | CRUD per customer |
| Treatment Photos     | Upload + list |
| Appointments         | CRUD + availability |
| Working Hours        | Per therapist |
| Unavailable Dates    | Per therapist |
| Therapist Capability | Per therapist |
| Package Types        | Manager CRUD |
