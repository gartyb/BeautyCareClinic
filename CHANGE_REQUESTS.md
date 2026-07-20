# Change Requests

## Open

### CR-001 — GlobalSettings schema inconsistency

- Type: Technical Debt
- Priority: Medium
- Source: Architecture review — Phase 001
- Related phase: Phase 2 (Backend)
- Description: `docs/DOMAIN_MODEL.md` defines `GlobalSettings` as a key-value table (name + value columns). `docs/ERD.md` defines it as a single-row table with one column per setting. The two representations conflict. Must be resolved before Phase 2 backend modeling.
- Status: Open

### CR-002 — RoleGuard route-level scaffold for Phase 2

- Type: Technical Debt
- Priority: High
- Source: Security review — Phase 001 (F-02)
- Related phase: Phase 2 (Backend + Auth)
- Description: Role-based visibility is UI-only (sidebar hide). No route-level guard exists. When Phase 2 adds authentication, a `<RoleGuard role="Manager">` wrapper must gate manager-only routes in `App.tsx`. Also add a comment in `Sidebar.tsx` that client-side role checks are UX-only and never security.
- Status: Closed — Phase 002 (`RoleGuard` component created; UX-only comment added to Sidebar.tsx)

### CR-003 — Modal accessibility (focus trap, Escape key, ARIA)

- Type: Enhancement
- Priority: Medium
- Source: Code review — Phase 001 (P3.11)
- Related phase: Phase 2
- Description: Custom div-based modals in `TreatmentHistoryTab` and `NotesTab` lack `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trapping, and Escape key dismissal. Replace with Radix Dialog when proper shadcn/ui integration is done.
- Status: Closed — Phase 002 (all modals migrated to shared Radix Dialog wrapper)

### CR-004 — Image URL allowlist + CSP headers

- Type: Security
- Priority: Medium
- Source: Security review — Phase 001 (F-05, F-06)
- Related phase: Phase 2 / Phase 3
- Description: (a) `TreatmentPhoto.photoUrl` is a free string — must be validated as same-origin or allowlisted CDN on ingest in Phase 2. (b) No Content-Security-Policy headers exist. Add baseline CSP meta tag in `index.html`; move to Nginx response headers in Phase 3.
- Status: Open

### CR-005 — Error type strategy for service layer

- Type: Technical Debt
- Priority: Low
- Source: Security review — Phase 001 (F-04)
- Related phase: Phase 2
- Description: `createCustomer` and future service stubs throw raw `Error` with internal identifiers. Establish a `DomainError` type or `Result<T, E>` pattern before Phase 2 service layer is implemented to prevent internal details leaking to user-facing toasts or logs.
- Status: Closed — Phase 002 (`DomainError extends Error { code: string }` in `src/domain/errors.ts`)

### CR-006 — Default user pattern for Phase 2 auth

- Type: Technical Debt
- Priority: Medium
- Source: Security review — Phase 001 (F-08)
- Related phase: Phase 2
- Description: `App.tsx` bootstraps `useState<User>(therapists[0]!)` defaulting to Manager. Replace with `null` + loading skeleton when Phase 2 adds real authentication. Add a code comment now warning against defaulting to a privileged role.
- Status: Closed — Phase 002 (warning comment added to `App.tsx`)

### CR-007 — Smart default tab in Customer Card

- Type: Enhancement
- Priority: Low
- Source: Code review — Phase 001 (P3.14)
- Related phase: Phase 2
- Description: Customer Card always defaults to "Active Series" tab. If a customer has no active series, the therapist lands on an empty state. Consider a smart `defaultValue` that falls through to "Treatment History" or "Notes" when no active series exist.
- Status: Closed — Phase 002 (smart defaultTab: falls through to "Treatment History" when no active series)

### CR-008 — Server-side therapistId validation before backend wiring

- Type: Security
- Priority: High
- Source: Security review — Phase 003
- Related phase: Phase 2 (Backend)
- Description: `recordTimerTreatment` and `recordQuantityTreatment` stamp `therapistId = currentUser.id` from the client-supplied `User` object (the dev-only header switcher). When backend is added, `therapistId` must come from the authenticated server session — never trust the client-supplied value. The Header switcher must be removed or locked behind an env flag before production.
- Status: Closed — Phase 008 (dev user switcher removed from `Header.tsx` and `App.tsx`; `currentUser` now comes exclusively from `AuthContext` backed by JWT + `/auth/me`)

### CR-009 — Code quality lows from Phase 4 review

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 004
- Related phase: Backend / maintenance
- Description: (a) UUID v4 regex in test assertions is too weak (`[0-9a-f-]{36}`). (b) `BuilderDeps` interface duplicated in `noteService.ts` and `treatmentService.ts` — extract to `src/domain/deps.ts`. (c) Cosmetic: `noteText` param name in `updateTreatmentNote`, redundant array spread in `TreatmentHistoryTab`. (d) Missing test for whitespace-only text passed directly to `buildNote` (now covered by DomainError guard, but test documents the contract explicitly).
- Status: Open

### CR-010 — UX / observability gaps deferred from Phase 4

- Type: Enhancement / Technical Debt
- Priority: Medium
- Source: Security review — Phase 004
- Related phase: Backend / Phase 5
- Description: (a) No banner warning that data (notes, photos) is lost on page refresh — add a session-scoped toast or info strip before production. (b) `console.error` logs raw errors; establish a `logger` abstraction before backend wiring to prevent PII leaking into log aggregators (Sentry etc.). (c) `docs/SYSTEM_FLOWS.md` does not exist — create it to document input surfaces, trust boundaries, and client-supplied vs server-derived fields per phase. (d) `buildTreatmentPhoto` accepts any URL scheme; add a `blob:`/same-origin guard before backend phase to prevent SSRF-like patterns.
- Status: Open

### CR-011 — Frontend User.firstName/lastName → fullName reconciliation

- Type: Technical Debt
- Priority: High
- Source: Architecture review — Phase 007
- Related phase: Phase 8
- Description: Frontend type definitions use `firstName`/`lastName` but backend schema and API use `fullName`. Must reconcile when wiring frontend to backend in Phase 8.
- Status: Closed — Phase 008 (`firstName`/`lastName` removed from `CustomerSummary`, `User`, all mock data, all forms and displays; `fullName` used throughout)

### CR-012 — Token revocation / refresh tokens

- Type: Security
- Priority: Medium
- Source: Architecture review + Security review — Phase 007
- Related phase: Phase 8 or 11
- Description: 24-hour JWT with no revocation means deleted/demoted users retain access until natural expiry. Add refresh tokens or SecurityStamp validation.
- Status: Open

### CR-013 — Production CORS policy

- Type: Technical Debt
- Priority: High
- Source: Code review — Phase 007
- Related phase: Phase 11
- Description: No CORS policy is configured for non-Development environments. Define a production CORS policy reading allowed origins from configuration.
- Status: Open

### CR-014 — HTTPS redirection + HSTS

- Type: Security
- Priority: High
- Source: Security review — Phase 007
- Related phase: Phase 11
- Description: `UseHttpsRedirection` and `UseHsts` are not called. Add in non-Development middleware pipeline.
- Status: Open

### CR-015 — Customer search wildcard escaping

- Type: Bug
- Priority: Medium
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: `CustomerRepository.SearchAsync` interpolates search term into ILike pattern without escaping `%`, `_`, or `\`. Add escaping before interpolation.
- Status: Closed — Phase 008 (`CustomerRepository.SearchAsync` now escapes `\`, `%`, `_` in that order before ILike interpolation; `ESCAPE` clause `"\\"` passed to EF Core)

### CR-016 — JWT typed options + validation on startup

- Type: Technical Debt
- Priority: Medium
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: JWT Issuer/Audience/ExpiresInHours are read from IConfiguration with null-forgiving operators. Extract into a typed `JwtOptions` class with `ValidateDataAnnotations().ValidateOnStart()`.
- Status: Open

### CR-017 — PII in JWT payload

- Type: Security / Privacy
- Priority: Medium
- Source: Security review — Phase 007
- Related phase: Phase 8
- Description: JWT includes email and fullName claims. Keep only sub/role/jti in token; fetch identity from /auth/me on client.
- Status: Open

### CR-018 — RemainingBalance computed column

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: `CustomerOrder.RemainingBalance` is a derived value stored redundantly alongside `DiscountedPrice` and `AmountPaid`. Risk of drift if any payment path forgets to recalculate. Make it a computed property or add a DB check constraint.
- Status: Closed — Phase 009 (`remaining_balance` implemented as PostgreSQL `GENERATED ALWAYS AS (discounted_price - amount_paid) STORED`. EF Core: `HasComputedColumnSql("discounted_price - amount_paid", stored: true)` + `[DatabaseGenerated(Computed)]`. Service layer never writes this field; reloads entity via `ReloadAsync()` after `SaveChangesAsync()`. Integration test deferred to CR-028.)

### CR-019 — DateTime → DateTimeOffset for timestamp columns

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: `Appointment.StartTime`, `EndTime`, `CreatedAt`, `Treatment.TreatmentDate`, `Note.NoteDate` use `DateTime` (unspecified kind). Migrate to `DateTimeOffset` for timezone safety.
- Status: Open

### CR-020 — AuthController: use IUserRepository instead of AppDbContext directly

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: `AuthController` injects `AppDbContext` directly to look up `Domain.User`. Replace with `IUserRepository.GetByIdAsync` to respect layer boundaries.
- Status: Open

### CR-021 — DomainConflictException typed exception

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 007
- Related phase: Phase 8
- Description: `ExceptionHandlingMiddleware` detects conflicts via `exception.Message.Contains("CONFLICT")` — a magic string. Introduce `DomainConflictException` and catch it explicitly.
- Status: Closed — Phase 009 (`DomainConflictException` added to `BeautyCareClinic.Domain/Exceptions/`. `ExceptionHandlingMiddleware` catches it explicitly — `.Contains` magic string removed.)

### CR-022 — User enumeration via login timing

- Type: Security
- Priority: Medium
- Source: Security review — Phase 008 (M3)
- Related phase: Phase 9+
- Description: `AuthController.Login` returns immediately with 401 when the email is not found, but runs a slow PBKDF2 hash when the email exists. The response time delta allows enumeration of valid emails. Fix: run a dummy `PasswordHasher.VerifyHashedPassword` on a constant hash when the user is not found, making both paths constant-time.
- Status: Open

### CR-023 — First-login mandatory password change

- Type: Security / UX
- Priority: Medium
- Source: Security review — Phase 008 (M8)
- Related phase: Phase 9+
- Description: Manager-created users receive a known initial password with no forced change on first login. Add a `MustChangePassword` flag to the `User` entity; on login, if the flag is set, return a specific code that directs the client to a password-change screen before proceeding.
- Status: Open

### CR-024 — GlobalSettings race condition / unique constraint

- Type: Technical Debt
- Priority: Low
- Source: Security review — Phase 008 (L6)
- Related phase: Phase 9+
- Description: `GlobalSettingsRepository.UpdateAsync` is a read-modify-write upsert with no unique constraint on `Name`. Two concurrent requests for a new key can both insert, producing duplicate rows. Add a `UNIQUE` constraint on `GlobalSettings.Name` and handle the conflict in the repository.
- Status: Open

### CR-025 — Phase 008 code quality P2/P3 items (remaining)

- Type: Technical Debt
- Priority: Low
- Source: Code review — Phase 008
- Related phase: Phase 10+
- Description: Remaining deferred items: (b) `GlobalSettingsContext.setCalendarHours` makes two sequential non-atomic API calls. (c) `setup.ts` uses substring URL matching that can match multiple routes. (e) `api/index.ts` barrel does not re-export entity API modules. (f) `UserDto`/`UserApiDto` duplicated across `authApi.ts` and `usersApi.ts`. (g) `IsValidEmail` helper duplicated in two controllers. Items (a) and (d) were resolved in Phase 009.
- Status: Open

### CR-026 — Clean Architecture: extract controller business logic into Application-layer services

- Type: Technical Debt
- Priority: Medium
- Source: Phase 009 code review
- Related phase: Phase 10+
- Description: `CustomerOrdersController` and `PaymentsController` both inject `AppDbContext` directly, bypassing repository abstractions and violating the Clean Architecture layer boundary. Extract order creation and payment recording into Application-layer services.
- Status: Open

### CR-027 — Remove dead `IPaymentRepository.AddAsync` or move payment creation through repository

- Type: Technical Debt
- Priority: Low
- Source: Phase 009 code review
- Related phase: Phase 10+
- Description: `IPaymentRepository.AddAsync` exists but payment creation in `PaymentsController` bypasses it and writes directly to `AppDbContext.Payments`. Either remove the dead surface or route all payment creation through the repository inside the transaction.
- Status: Open

### CR-028 — Rewrite payment validation tests as controller-level integration tests

- Type: Technical Debt
- Priority: Medium
- Source: Phase 009 code review
- Related phase: Phase 10+
- Description: Payment validation tests in `Phase009Tests.cs` inline the validation logic directly instead of calling production code. Rewrite as controller-level integration tests using `WebApplicationFactory` so the tests call the real controller and validate HTTP response codes.
- Status: Open

### CR-029 — Per-therapist customer scoping

- Type: Feature
- Priority: Low
- Source: Phase 009 security review
- Related phase: Future
- Description: Currently all authenticated users can read all customer financial data (orders, payments, treatment series). Add per-therapist scoping when multi-location or per-therapist privacy is required. See access model in `docs/WORKFLOWS.md`.
- Status: Open

### CR-030 — Batch package type lookup in `CustomerOrdersController.Create`

- Type: Performance
- Priority: Medium
- Source: Phase 009 code review
- Related phase: Phase 10+
- Description: `CustomerOrdersController.Create` fetches each package type with a separate `GetByIdAsync` call per item (N round-trips). Replace with a single `WHERE Id IN (...)` batch lookup.
- Status: Open

### CR-032 — Server-side enforcement of active-package eligibility for booking

- Type: Bug / Security
- Priority: High
- Source: Manual browser testing of Phase 011 booking flow (2026-07-20), confirmed via `lean-chronoscope` MCP
- Related phase: Phase 011
- Description: Booking rule — a customer may only be booked for a `TreatmentType` they hold an active `TreatmentSeries` for — is documented in `docs/DOMAIN_MODEL.md` and enforced only client-side in `BookAppointmentModal.tsx` (`filteredTreatmentTypes`). `POST /api/v1/customers/{customerId}/appointments` performs no such check, so a direct API call can create an appointment for a customer with no active package. Add the same eligibility check server-side (422 with a Hebrew reason on violation), consistent with how availability is already enforced server-side.
- Status: Open

## Planned

None.

## Completed

### CR-002 — Closed Phase 002. RoleGuard + sidebar UX comment.
### CR-003 — Closed Phase 002. All modals migrated to Radix Dialog.
### CR-005 — Closed Phase 002. `DomainError` established.
### CR-006 — Closed Phase 002. Warning comment in App.tsx; null user default.
### CR-007 — Closed Phase 002. Smart defaultTab.
### CR-008 — Closed Phase 008. Dev user switcher removed; `currentUser` from `AuthContext` only.
### CR-011 — Closed Phase 008. `firstName`/`lastName` → `fullName` throughout all frontend types, forms, displays, and tests.
### CR-015 — Closed Phase 008. `CustomerRepository.SearchAsync` escapes `\`, `%`, `_` before ILike interpolation. Also fixed `TreatmentTypeRepository.ExistsByNameAsync` (same pattern).
### CR-018 — Closed Phase 009. `remaining_balance` as PostgreSQL GENERATED STORED column. Service layer reloads entity post-save.
### CR-021 — Closed Phase 009. `DomainConflictException` in Domain layer; middleware catches explicitly.
### CR-025 (partial) — Items (a) and (d) closed Phase 009: `globalSettingsApi.updateSetting` return type fixed; `AuthController`/`UsersController` use `ICurrentUserService`.
### CR-031 — Closed 2026-07-19. `OrderItem.PackageNumber` (row-locked assignment, deterministic backfill migration); `ActiveSeriesTab`/`TreatmentHistoryTab` now show the same package number.
