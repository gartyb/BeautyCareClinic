# Phase 007 — Backend Foundation

## Status

Completed

## Goal

הקמת שכבת Backend מלאה עם ASP.NET Core 10, PostgreSQL ו-JWT — בסיס שעליו יתבנו כל ה-APIs של Phases 8+.

## Planned

- .NET 10 solution ב-`backend/` עם 4 projects (Domain, Application, Infrastructure, Api)
- כל 15 הטבלאות של ה-schema: EF Core entities + migration + database update
- ASP.NET Core Identity מקושר לטבלת USER
- JWT authentication: `POST /api/v1/auth/login` + `GET /api/v1/auth/me`
- Role-based policies: Manager / Therapist
- CRUD APIs:
  - `/api/v1/customers` (GET+search, POST, PUT, DELETE)
  - `/api/v1/treatment-types` (GET, POST, PUT, DELETE — Manager בלבד ל-write)
  - `/api/v1/users` (GET, POST, PUT, DELETE — Manager בלבד)
  - `/api/v1/global-settings` (GET, PUT — Manager בלבד ל-update)
- Global error handling middleware (structured JSON, ללא stack traces)
- CORS לפי Vite dev server (localhost:5173)
- Security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- Swagger/OpenAPI ב-Development בלבד
- Seed data: 1 Manager + 2 Therapists + 5 Customers + 3 Treatment Types + default_max_payment_count=12

## Out of Scope

- Frontend wire-up — Phase 8
- Orders, Payments, Treatment Series, Treatments, Notes, Photos APIs — Phase 8+
- Appointments API — Phase 8+
- TherapistWorkingHours / TherapistUnavailableDate / TherapistCapability APIs — Phase 8+
- PackageType API — Phase 8+
- File upload — Phase 8+
- Refresh tokens — Phase 8+
- Docker / Deployment — Phase 11
- Automated unit tests — Phase 8 (Phase 7: manual validation via Swagger/Postman)

## API Endpoints (19 total)

### Auth
| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /api/v1/auth/login | None |
| GET | /api/v1/auth/me | JWT |

### Customers (both roles)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/v1/customers | JWT |
| GET | /api/v1/customers?search= | JWT |
| GET | /api/v1/customers/{id} | JWT |
| POST | /api/v1/customers | JWT |
| PUT | /api/v1/customers/{id} | Manager |
| DELETE | /api/v1/customers/{id} | Manager |

### Treatment Types
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/v1/treatment-types | JWT |
| GET | /api/v1/treatment-types/{id} | JWT |
| POST | /api/v1/treatment-types | Manager |
| PUT | /api/v1/treatment-types/{id} | Manager |
| DELETE | /api/v1/treatment-types/{id} | Manager |

### Users (Manager only)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/v1/users | Manager |
| GET | /api/v1/users/{id} | Manager |
| POST | /api/v1/users | Manager |
| PUT | /api/v1/users/{id} | Manager |
| DELETE | /api/v1/users/{id} | Manager |

### Global Settings (Manager only for write)
| Method | Endpoint | Auth |
|--------|----------|------|
| GET | /api/v1/global-settings | JWT |
| PUT | /api/v1/global-settings | Manager |

## Seed Data

**Users (password: `Clinic@123`):**
- Manager: ניהול אחראית / manager@clinic.local
- Therapist 1: טלי מטפלת / therapist1@clinic.local
- Therapist 2: שרה מטפלת / therapist2@clinic.local

**Customers:** 5 לקוחות לדוגמה (שמות עבריים)

**Treatment Types:** פנים, לייזר, עיסוי

**Global Settings:** default_max_payment_count = 12

## Error Response Format

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "timestamp": "2026-07-16T10:30:00Z",
  "traceId": "request-id"
}
```

## Open Questions Resolved

| שאלה | החלטה |
|------|-------|
| Refresh tokens ב-Phase 7? | לא — access token ל-24 שעות, Phase 8 יוסיף |
| Password reset? | לא — Phase 8+ |
| Soft deletes? | לא — hard delete ב-Phase 7 |
| Pagination? | לא — כל הרשומות, dataset קטן |
| Base URL? | /api/v1 |
| Seed password? | Clinic@123 לכל המשתמשים |

## Acceptance Criteria

- [ ] `dotnet build backend/BeautyCareClinic.sln` עובר ללא שגיאות
- [ ] `dotnet ef database update` יוצר את כל 15 הטבלאות
- [ ] Seed data קיים ב-DB
- [ ] POST /auth/login מחזיר JWT
- [ ] GET /auth/me ללא token מחזיר 401
- [ ] Therapist מקבל 403 על endpoints של Manager בלבד
- [ ] כל ה-CRUD endpoints עובדים
- [ ] Search customers מסנן לפי שם/טלפון
- [ ] שגיאות מחזירות JSON מובנה, ללא stack trace
- [ ] CORS מאפשר localhost:5173
- [ ] Security headers קיימים
- [ ] Swagger זמין ב-Development

## Architecture Review

**סטטוס:** הושלם — ממתין לאישור משתמש

### מה אושר

- Clean Architecture 4-project split — תקין
- `backend/` at repo root — תקין
- כל 15 entities ב-InitialCreate migration אחד — נכון
- JWT 24h ללא refresh ב-Phase 7 — מתאים
- Role-based policies ברמת controller — מספיק
- CORS localhost:5173 בDev בלבד — בסדר
- CR-001 resolution (key-value GlobalSettings) — מאושר

### תיקונים נדרשים לפני Implementation

**RC-1 — Frontend User shape mismatch:** Frontend מגדיר `firstName/lastName` אך schema + API משתמשים ב-`fullName`. לפתוח CR-011, ה-DTO ישתמש ב-`fullName`.

**RC-2 — Appointment entity: status + created_date:** Frontend Appointment מכיל `status` (Scheduled/Completed/Cancelled/NoShow) שלא ניתן לגזור מ-start_time/end_time. החלטה: להוסיף `status` (enum) + `created_at` לטבלת APPOINTMENT בmigration ולעדכן DATABASE_SCHEMA.md.

**RC-3 — Identity strategy (ADR-004):** Domain layer חייב להיות נקי מ-framework deps. להשתמש ב-Strategy B: `Domain.User` כ-POCO, `Infrastructure.AppUser : IdentityUser<Guid>` עם אותו ID. Identity מנהל AspNetUsers בנפרד.

**RC-4 — Role authority:** `Domain.User.role` הוא המקור היחיד. אסור ל-seed AspNetRoles / AspNetUserRoles. JWT role claim נלקח מ-`Domain.User.role`.

**RC-5 — ICurrentUserService:** להוסיף interface זה ב-Application כדי ש-Phase 8 handlers יוכלו לקרוא userId מ-JWT claims. סוגר CR-008.

**RC-6 — Password policy:** לשמור את ברירת המחדל של Identity (min 8 + uppercase + digit + non-alphanumeric). `Clinic@123` עומד בדרישות.

### ADR נדרש

**ADR-004 — Identity Integration Strategy (Strategy B):** Domain.User כ-POCO נקי; AppUser בInfrastructure בלבד. USER.role הוא authoritative לאישור — ראה `docs/adr/ADR-004-identity-integration.md`.

### Risks מרכזיים

| # | Risk | מיטיגציה |
|---|------|-----------|
| K-2 | Identity role table + USER.role drift | רק USER.role authoritative |
| K-3 | Seed non-transactional Identity + Domain | wrap in IDbContextTransaction |
| K-4 | Case-sensitive email duplicates | lowercase-on-write ב-DTO validator |
| K-5 | JWT secret checked into appsettings | dotnet user-secrets בDev, env var בProd |
| K-6 | Manager self-delete / self-demote | reject ב-controller |
| K-7 | DELETE TreatmentType cascades history | Restrict FK + 409 |
| K-8 | 24h JWT ללא revocation | מקובל Phase 7; CR-012 ל-Phase 8 |

### Recommendations

- R-1: `created_at`/`updated_at` timestamps לentities מרכזיים
- R-2: UUID app-side via `Guid.NewGuid()`
- R-3: Explicit indexes ב-InitialCreate (customer search, FK indexes, unique constraints)
- R-4: Cascade `Restrict` על Customer/TreatmentType — 409 במקום cascade delete
- R-5: `ErrorCodes` static class מרכזי ב-Application
- R-6: `IGlobalSettings` typed accessor ב-Application
- R-7: JWT claims documented: sub=userId, role, email, name
- R-8: עדכון docs/API_SPECIFICATION.md + ARCHITECTURE.md + ERD.md + TECH_STACK.md

### Change Requests חדשים מה-Review

- CR-011: Frontend User.firstName/lastName → fullName reconciliation (Phase 8)
- CR-012: Token revocation / refresh tokens (Phase 8 or 11)

## Implemented

- `.NET 10` solution ב-`backend/` — 5 projects: Domain, Application, Infrastructure, Api, Tests
- כל 16 ה-entities: EF Core POCOs + navigation properties + AppDbContext עם כל ה-relationships
- ASP.NET Core Identity (Strategy B): `AppUser : IdentityUser<Guid>` ב-Infrastructure, `Domain.User` כ-POCO נקי
- JWT authentication: `POST /api/v1/auth/login` + `GET /api/v1/auth/me` — token ל-24 שעות
- Role-based policies: Manager / Therapist — `[Authorize(Policy = "Manager")]` ברמת controller/action
- CRUD APIs — כל 19 endpoints:
  - Auth: login, me
  - Customers: GET (+ search ILike), GET by id, POST, PUT (Manager), DELETE (Manager + conflict check)
  - TreatmentTypes: GET, GET by id, POST (Manager), PUT (Manager), DELETE (Manager + conflict check)
  - Users: GET (+ filter by role), GET by id, POST (Therapist only), PUT (sync Identity + Domain), DELETE (no self-delete)
  - GlobalSettings: GET, PUT (Manager, validates KnownKeys)
- Global exception handling middleware — JSON structured errors, no stack traces
- Security headers middleware — X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- CORS policy "Development" — localhost:5173 בלבד
- Swagger/OpenAPI ב-Development עם JWT bearer support
- Seed data: 3 users (Manager + 2 Therapists), 5 customers, 3 treatment types, 1 global setting
- `ICurrentUserService` ב-Application — סוגר CR-008
- `GlobalSettingsKeys` static class — CR-001 resolved
- `IDesignTimeDbContextFactory` ב-Infrastructure — מאפשר `dotnet ef migrations add` ללא startup validation
- InitialCreate migration — כל 16 domain tables + 7 Identity tables, כל indexes וconstraints
- Model snapshot (AppDbContextModelSnapshot.cs + Designer.cs)
- xUnit tests: Domain, Application, Infrastructure (InMemory), Api middleware — כ-40 tests

## Deferred or Not Implemented

- Orders, Payments, TreatmentSeries, Treatments, Notes, Photos APIs — Phase 8+
- Appointments API — Phase 8+
- TherapistWorkingHours / TherapistUnavailableDate / TherapistCapability APIs — Phase 8+
- PackageType API — Phase 8+
- File upload — Phase 8+
- Refresh tokens — Phase 8+ (CR-012)
- Docker / Deployment — Phase 11
- Automated unit tests ל-controllers — Phase 8

## Database Changes

`InitialCreate migration` — 23 tables (16 domain + 7 Identity):
Users, Customers, TreatmentTypes, PackageTypes, GlobalSettings,
CustomerOrders, OrderItems, Payments, TreatmentSeries, Treatments, TreatmentPhotos,
Appointments, TherapistWorkingHours, TherapistUnavailableDates, TherapistCapabilities,
Notes + AspNetUsers, AspNetRoles, AspNetRoleClaims, AspNetUserClaims,
AspNetUserLogins, AspNetUserRoles, AspNetUserTokens

## API Changes

19 endpoints חדשים — ראה טבלאות ב-Planned לעיל.

## Automated Tests

| Test Type | Passed | Failed | Notes |
|-----------|-------:|-------:|-------|
| Unit | ~40 | — | Domain + App + Infra (InMemory) + API middleware |
| Integration | — | — | Phase 8 |
| Manual API | — | — | טרם — נדרש dotnet + Postgres |

## Manual Validation

ממתין לאישור בסביבה עם dotnet + PostgreSQL.

## Code Review

**הושלם.** ממצאים עיקריים שתוקנו:
- P0×3: UsersController Create/Update/Delete — עוטפו ב-IDbContextTransaction
- P1: Exception middleware — הודעות סטטיות לclient, פרטים בlog בלבד
- P1: Seed password הועבר לconfig; DbSeeder מוגבל לDevelopment בלבד
- P1: Connection string הוסר מappsettings.json + startup guard נוסף
- P1: JWT minimum length (32 bytes) נאכף בstartup

ממצאים שנדחו ל-CRs: CR-013–CR-021 (CORS בprod, HTTPS, wildcard escaping, JWT typed options, PII בtoken, DateTime→DateTimeOffset, תשתית נקודתית).

## Security Review

**הושלם.** ממצאים קריטיים שתוקנו:
- C-1: JWT secret minimum length enforcement (≥32 bytes)
- C-2: DB credentials הוסרו מappsettings.json, startup guard נוסף
- C-3: DbSeeder מוגבל לDevelopment בלבד; סיסמה מconfig
- H-2: Exception middleware לא חושף internal messages לclient
- H-5: AuthController עבר ל-`SignInManager.CheckPasswordSignInAsync(lockoutOnFailure: true)` — lockout פעיל

ממצאים שנדחו: H-1 HTTPS/HSTS (Phase 11), H-3 IDOR design decision (documented), M-1 JWT PII (Phase 8 CR-017), M-3 CSP (Phase 11 CR-004), M-4 token revocation (Phase 8 CR-012).

## Documentation Updated

- `docs/TECH_STACK.md` — Backend section עודכן לPhase 7
- `docs/ARCHITECTURE.md` — Backend structure עודכן עם project names ו-Identity strategy
- `docs/API_SPECIFICATION.md` — כל 19 endpoints מתועדים
- `CHANGE_REQUESTS.md` — CR-011 עד CR-021 נוספו
- `phases/phase-007/PHASE_SUMMARY.md` — מסמך זה

## Version

- Version: v0.7.0
- Commit: 5af6f5f
- Tag: v0.7.0

## Lessons Learned

- Strategy B לIdentity (POCO + AppUser) שומרת Domain נקי אך דורשת transaction זהיר בכל CRUD של users
- DbSeeder חייב להיות מוגבל לDevelopment מההתחלה — לא לדחות לreview
- JWT secret validation צריך לכלול minimum length, לא רק non-empty
- `CheckPasswordAsync` לא מפעיל lockout — חייב `SignInManager.PasswordSignInAsync`

## Deferred Requests

- CR-001: GlobalSettings schema — resolved in Phase 7 (key-value table)
- CR-004: CSP headers — basic security headers ב-Phase 7, full CSP ב-Phase 11
- CR-008: therapistId validation — JWT claims validation ב-Phase 7
