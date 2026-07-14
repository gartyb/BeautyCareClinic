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
- Status: Open

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

## Planned

None.

## Completed

None.
