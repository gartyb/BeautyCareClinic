# Project Status

## Current State

- Current phase: 010 — Treatment Recording & Notes
- Phase status: Completed
- Current branch: main
- Latest approved version: v0.10.0
- Latest approved tag: v0.10.0
- Pending patch: v0.10.1 — auth-gated data-fetch bug fix (see below); implemented, tested, and
  validated by the user in the browser; **not yet committed/tagged** — awaiting explicit commit
  approval from the user directly (per this repo's Git Safety Protocol, an agent relaying "the
  user approved" is not sufficient authorization for a commit).

## Current Activity

Phase 010 הושלם ואושר (v0.10.0). Bug-fix patch v0.10.1 (customer/settings/treatment-types/
package-types data not loading after first login) implemented, tested (276/276 frontend tests
pass) and validated in the browser — ready to commit/tag as v0.10.1 once the user directly
confirms. מוכן להצעת Phase 011 לאחר מכן.

## Completed Phases

| Phase | Description                              | Version | Status    |
| ----- | ---------------------------------------- | ------- | --------- |
| 001   | Customer Card Frontend with Mock Data    | v0.1.0  | Completed |
| 002   | New Order + Record Payment               | v0.2.0  | Completed |
| 003   | Treatment Recording                      | v0.3.0  | Completed |
| 004   | Treatment Notes, Photos & Add Note       | v0.4.0  | Completed |
| 005   | New Customer + Manager Admin Screens     | v0.5.0  | Completed |
| 006   | Appointment Calendar                     | v0.6.0  | Completed |
| 007   | Backend Foundation                       | v0.7.0  | Completed |
| 008   | Frontend-Backend Integration             | v0.8.0  | Completed |
| 009   | Orders, Series & Payments                | v0.9.0  | Completed |
| 010   | Treatment Recording & Notes              | v0.10.0 | Completed |

## Open Change Requests

- CR-001: GlobalSettings schema inconsistency
- CR-004: CSP + image allowlist (Phase 11)
- CR-009: Code quality lows from Phase 4 review
- CR-010: UX/observability gaps
- CR-012: Refresh tokens (Phase 9+)
- CR-013: Production CORS policy (Phase 11)
- CR-014: HTTPS/HSTS (Phase 11)
- CR-016: JWT typed options (Phase 9+)
- CR-017: PII in JWT (Phase 9+)
- CR-018: RemainingBalance computed (Phase 9+)
- CR-019: DateTime → DateTimeOffset (Phase 9+)
- CR-020: AuthController use IUserRepository (Phase 9+)
- CR-021: DomainConflictException (Phase 9+)
- CR-022: User enumeration timing (Phase 9+)
- CR-023: First-login password change (Phase 9+)
- CR-024: GlobalSettings unique constraint (Phase 9+)
- CR-025: Phase 008 P2/P3 code quality (Phase 9+)

## Known Risks or Accepted Findings

- H2 (Security): JWT stored in localStorage — deferred to Phase 9+ (CR-012, refresh tokens + HttpOnly cookies)
- M4/M5: Kestrel + Vite bound to 0.0.0.0 in dev — required for current remote-access dev setup

## Next Step

1. Get direct user confirmation to commit + tag v0.10.1 (bug-fix patch, already validated in
   browser — see "Pending patch" above).
2. Phase 010 הושלם (v0.10.0). מוכן להצעת Phase 011 לאחר אישור ה-patch.
