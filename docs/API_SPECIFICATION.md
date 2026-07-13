# API Specification

Status: **Not started.** Backend begins in Phase 2.

This document will be populated during Phase 2 planning.

---

## Planned Base URL

```
/api/v1
```

## Planned Resource Groups

| Resource               | Planned Endpoints                                       |
| ---------------------- | ------------------------------------------------------- |
| Auth                   | Login, logout, current user                             |
| Customers              | CRUD, search                                            |
| Orders                 | CRUD per customer                                       |
| Order Items            | Add/remove within an order                              |
| Payments               | Create per order, list per order                        |
| Treatment Series       | Read and manual edit per order item                     |
| Timer Sessions         | Create (end session → add duration to series)           |
| Treatments             | Create per customer, list per customer                  |
| Treatment Photos       | Upload and list per treatment                           |
| Appointments           | CRUD, availability query                                |
| Therapists (Users)     | CRUD for managers; read own profile for therapists      |
| Working Hours          | Set per therapist                                       |
| Unavailable Dates      | Set per therapist                                       |
| Therapist Capabilities | Set per therapist                                       |
| Package Types          | CRUD for managers                                       |
| Treatment Types        | CRUD for managers                                       |
| Global Settings        | Read and update for managers                            |

## Auth

ASP.NET Core Identity. JWT or cookie-based (to be decided in Phase 2 planning).

Role-based policies:
- `Manager` — full access
- `Therapist` — scoped create access; no edit after save
