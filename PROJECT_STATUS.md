# Project Status

## Current State

- Current phase: 007 — Backend Foundation
- Phase status: Completed
- Current branch: feature/phase-007-backend-foundation
- Latest approved version: v0.7.0
- Latest approved tag: v0.7.0

## Current Activity

Phase 007 הושלם. ממתין להצעת Phase 008.

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

## Open Change Requests

- CR-001: GlobalSettings schema inconsistency (Backend phase)
- CR-004: CSP + image allowlist (Backend/Infra phase)
- CR-008: Server-side therapistId validation (Backend phase)
- CR-009: Code quality lows from Phase 4 review
- CR-010: UX/observability gaps — refresh warning, logger, SYSTEM_FLOWS.md

## Known Risks or Accepted Findings

- Data is in-memory only — resets on page refresh (intentional, no backend yet).

## Next Step

Phase 007 — Backend Foundation. הקוד מוכן. נדרש: `dotnet build` + `dotnet test` + manual API validation עם Swagger. לאחר אישור → commit v0.7.0 → Phase 008.
