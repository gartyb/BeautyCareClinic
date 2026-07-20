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

### CR-033 — Raise HSTS max-age after burn-in period

- Type: Technical Debt / Security
- Priority: Medium
- Source: Architecture review — Phase 013 (RC-3)
- Related phase: Phase 013
- Description: `beautycare.conf` ships `Strict-Transport-Security: max-age=300` deliberately, to limit the blast radius of an early cert/config mistake while the sslip.io + Let's Encrypt setup is freshly deployed. Once the deployment has run stably for a few days (cert renewal confirmed working, no config issues), raise `max-age` to a long-lived value (e.g. `31536000`). Do not add `preload`; reconsider `includeSubDomains` given the shared sslip.io suffix.
- Status: Open

### CR-034 — Production-build migration (frontend build + backend Production environment)

- Type: Feature
- Priority: Medium
- Source: Phase 013 planning — explicitly deferred by the user
- Related phase: Future
- Description: Phase 013 put nginx + real HTTPS in front of the app but deliberately left the frontend on the raw Vite dev server and the backend on `ASPNETCORE_ENVIRONMENT=Development` (`dotnet run`), per explicit user decision to keep this phase infra-only. A future phase should switch to a production frontend build and `ASPNETCORE_ENVIRONMENT=Production` backend, and reassess whether Swagger/HMR/dev-only conveniences should be removed from the public-facing path at that point.
- Status: Open

### CR-035 — Reject HTTPS requests to the raw server IP (no matching default_server)

- Type: Technical Debt / Security
- Priority: Low
- Source: User manual validation of Phase 013 (2026-07-20) — accessing `https://169.58.26.157/login` directly (raw IP, not the sslip.io hostname) served the application, with a certificate-mismatch warning as the only barrier (cert CN is `169-58-26-157.sslip.io`, not the IP).
- Related phase: Phase 013
- Description: aaPanel's nginx has a single HTTPS vhost for `beautycare.conf`, so it also answers for requests where the Host/SNI doesn't match the configured hostname (e.g. the raw IP), falling back to serving the app instead of rejecting the connection. This isn't a bypass of any real access control (HTTPS still encrypts, JWT auth still applies, and the cert-mismatch warning correctly signals something is off) — the sslip.io hostname was never meant as a secrecy boundary, only a way to get a valid cert without buying a domain. But it does mean the app is reachable by anyone scanning the raw IP, guarded only by a browser warning users can click through. Consider adding a minimal `default_server` block that rejects (e.g. 444/close, or a plain error page) connections with a Host/SNI that doesn't match `169-58-26-157.sslip.io`.
- Status: Open

### CR-036 — SSH hardening: disable password auth + root login

- Type: Security
- Priority: Critical
- Source: Comprehensive security audit (2026-07-20) — `security/SERVER-HARDENING-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: Live server has `PasswordAuthentication yes` and `PermitRootLogin yes` in effective sshd config, confirmed under an active brute-force attack (51,827 failed attempts, 12,687 against `root`). `fail2ban` was installed and enabled same-session as an immediate mitigation, but the root cause (password auth + root login both allowed) remains open. Requires disabling both (`PasswordAuthentication no`, `PermitRootLogin no`) with care to avoid self-lockout (verify key-based access works before changing, keep the Contabo VNC console recovery path documented in `phases/phase-013/PHASE_SUMMARY.md:129` in mind).
- Status: Open

### CR-037 — Close unnecessary open ports (aaPanel admin panel, unidentified port, dead FTP rules)

- Type: Security
- Priority: High
- Source: Comprehensive security audit (2026-07-20) — `security/INFRA-SECURITY-FINDINGS.md`, `security/SERVER-HARDENING-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: `ufw status` shows aaPanel's admin panel (port 888, full server-control UI) open to the entire internet guarded only by its own login — never addressed by Phase 013 (explicitly out of scope then). Also open: an unidentified aaPanel internal `webserver` process on port 25664 (needs identification before deciding to close/restrict), and dead-but-open FTP rules (20/21/39000:40000) with no live listener. Fix: restrict 888 to a known admin IP/VPN; identify and close/restrict 25664; remove the unused FTP ufw rules unless FTP is an intentional future feature.
- Status: Open

### CR-038 — Vite dev server exposes full repo source via `/@fs/`, bypassing the `/swagger` auth gate

- Type: Security
- Priority: Critical
- Source: Comprehensive security audit (2026-07-20) — `security/SERVER-HARDENING-FINDINGS.md`, `security/E2E-SECURITY-FINDINGS.md` (live-confirmed via browser, unauthenticated)
- Related phase: security/comprehensive-audit
- Description: The Vite dev server behind the nginx proxy serves any non-dot file in the repo via `/@fs/<absolute-path>` with **no authentication at all**, completely bypassing the Basic-Auth gate that protects `/swagger`. Confirmed live: `GET https://169-58-26-157.sslip.io/@fs/home/runner/Projects/BeautyCareClinic/backend/BeautyCareClinic.Api/appsettings.Development.json` returns 200 with full file content, unauthenticated. Only placeholder values are exposed today, but any future non-dot file with a real secret (e.g. the already-noted `env.development.local` gitignore gap, CR from the infra audit) would be immediately exposed. Root-cause fix is the production-build migration (CR-034 — a built SPA has no `/@fs/` route at all). Interim band-aid: `location ~ ^/@fs/ { deny all; }` in `beautycare.conf`.
- Status: Open

### CR-039 — Nginx edge hardening (security headers, dot-file blocking, nginx_status exposure, default-site fallback)

- Type: Security
- Priority: Medium
- Source: Comprehensive security audit (2026-07-20) — `security/INFRA-SECURITY-FINDINGS.md`, `security/SERVER-HARDENING-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: Several nginx-layer gaps at the edge: (a) no security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP) on the customer-facing SPA path — the backend's `SecurityHeadersMiddleware` never runs on `location /`; (b) `/nginx_status` returns live connection stats to the public internet via a Host-header trick (the `allow 127.0.0.1;` rule lacks a trailing `deny all;`); (c) no `location ~ /\. { deny all; }` in `beautycare.conf` itself (dot-file protection currently relies entirely on Vite's own default behavior, no nginx-level defense-in-depth); (d) mismatched-Host requests on port 80 fall through to aaPanel's own default "website stopped" page (fingerprints aaPanel; the equivalent gap on port 443 is already tracked as CR-035).
- Status: Open

### CR-040 — No backup mechanism exists for the production Postgres data

- Type: Security / Technical Debt
- Priority: Critical
- Source: Comprehensive security audit (2026-07-20) — `security/SERVER-HARDENING-FINDINGS.md`, confirms an item flagged unconfirmed in `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`
- Related phase: security/comprehensive-audit
- Description: No cron job, systemd timer, aaPanel backup job, or any backup tool is configured anywhere on the server for the `beautycare-postgres-data` volume (real customer PII + financial records). aaPanel's own backup directories (`/www/backup/database`, `/www/backup/site`) exist but are empty — the feature was never activated. A disk failure or accidental data loss would be unrecoverable. Needs a scheduled `pg_dump` (or equivalent) with an off-server, encrypted destination.
- Status: Open

### CR-041 — No MFA for any authenticated role

- Type: Security / Privacy
- Priority: High
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` (תקנה 9(ב)(1), mandatory at the determined רמה בינונית security level)
- Related phase: security/comprehensive-audit
- Description: `POST /api/v1/auth/login` authenticates with email+password only for both Manager and Therapist roles — no second factor anywhere. Mandatory (not optional) once a data store is classified רמה בינונית or above, which this system already is (financial + health-adjacent note data). At minimum, add MFA/OTP for the Manager role.
- Status: Open

### CR-042 — No audit-logging mechanism (who accessed/modified what, including denied attempts)

- Type: Security / Privacy
- Priority: High
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` (תקנה 10(א)); live-proven alongside CR-029's existing IDOR-class gap via `security/E2E-SECURITY-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: No `AuditLog` entity/table or logging middleware exists anywhere that records who read/modified which customer/payment/note record, or which access attempts (including 401/403) were denied. Mandatory at the medium security level. This is the natural place to also close CR-029's per-therapist scoping gap — e2e testing this session proved live that any authenticated Therapist can read any customer's full financial history with zero ownership check (two independent therapist accounts both got 200 + real order/balance data for an unrelated customer).
- Status: Open

### CR-043 — No data-subject deletion/anonymization mechanism (Sec 14)

- Type: Security / Privacy
- Priority: Critical
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`; live-proven via `security/E2E-SECURITY-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: `DELETE /api/v1/customers/{id}` unconditionally refuses (409) whenever the customer has any order/appointment/treatment/note — the normal case for any real customer — with **no anonymization alternative**. Live-confirmed this session with a throwaway customer. Needs an anonymization-in-place branch (scramble `FullName`/`Phone`/`Email` while preserving FK-linked financial/treatment history for accounting purposes) as the alternative when hard delete is blocked — a data-model and retention-policy decision, not a pure code fix.
- Status: Open

### CR-044 — No consolidated data-subject access/export endpoint (Sec 13)

- Type: Feature / Privacy
- Priority: Medium
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`
- Related phase: security/comprehensive-audit
- Description: No endpoint or admin tool aggregates a customer's full personal-data footprint (core fields + appointments + treatments + notes + orders/payments) into a single response for the עיון (access) right. Needs a product decision on scope (staff-mediated export vs. customer self-service).
- Status: Open

### CR-045 — No consent/privacy-notice mechanism at customer intake (Sec 11)

- Type: Feature / Privacy
- Priority: Medium
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`
- Related phase: security/comprehensive-audit
- Description: `NewCustomerModal`/`POST /customers` collects PII with no consent checkbox, no privacy notice, and no schema field recording that/when notice was given. Needs a product/legal decision on notice content and placement before implementation.
- Status: Open

### CR-046 — Incident-response runbook + close docs-vs-reality drift on bind-to-loopback

- Type: Technical Debt
- Priority: Medium
- Source: Comprehensive security audit (2026-07-20) — `security/SERVER-HARDENING-FINDINGS.md`
- Related phase: security/comprehensive-audit
- Description: No general incident-response runbook exists (only a narrow SSH-lockout recovery note in `phases/phase-013/PHASE_SUMMARY.md:129`). Also, `docs/ARCHITECTURE.md` implies Vite/Kestrel are not internet-reachable, but they still bind to `0.0.0.0`/`*` at the OS level (protected only by ufw, a single control) — Phase 013's own non-blocking recommendation to bind them to `127.0.0.1` was never implemented. Fix both: write a general `INCIDENT.md`/`RUNBOOK.md`, and bind Kestrel/Vite explicitly to loopback + update the architecture doc to describe actual bind behavior.
- Status: Open

### CR-047 — Data retention policy undefined

- Type: Technical Debt / Privacy
- Priority: Low
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` (תקנה 2(ג))
- Related phase: security/comprehensive-audit
- Description: No retention period or annual-review mechanism exists for any PII-bearing table (`Customer`, `Note`, `CustomerOrder`, `Appointment`, `Treatment` all persist indefinitely). Needs a business decision on retention period per entity before any code/process implementation.
- Status: Open

### CR-048 — Postgres data not encrypted at rest

- Type: Security
- Priority: Low
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` (תקנה 12)
- Related phase: security/comprehensive-audit
- Description: The `beautycare-postgres-data` volume (real PII + financial records) has no encryption-at-rest. A disk compromise or unauthorized volume copy exposes the DB in cleartext. Needs an infra decision (encrypted host volume, or a managed-disk-encryption alternative) — server-provisioning work, not an application code change.
- Status: Open

### CR-049 — Customer search query string logged to browser console when `VITE_LOG_API_CALLS` is on

- Type: Bug / Privacy
- Priority: Low
- Source: Comprehensive security audit (2026-07-20) — `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`
- Related phase: security/comprehensive-audit
- Description: `apiClient.ts` logs the full request URL (including the raw customer search term — a name/phone/email fragment) to the browser console whenever `VITE_LOG_API_CALLS` is true (confirmed true by default in `env.development.local`, false in `.env.example`). Fix: log the path only, strip query params before logging; confirm the flag stays off in any shared environment.
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
