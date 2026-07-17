# BACKLOG

Out-of-scope ideas and improvements noted during implementation.

## BL-001: shadcn/ui CLI setup

The `npx shadcn@latest init` step was skipped because it requires interactive prompts.
Radix UI primitives (@radix-ui/react-tabs, @radix-ui/react-dialog) were installed directly.
If the project needs the full shadcn/ui component library (Button, Card, etc.), consider running
the CLI setup in an interactive session and adding `components/ui/` to the codebase.

## BL-002: Add e2e tests with Playwright

Playwright e2e tests for full user flows (search → customer card → tabs) are not in Phase 1 scope.
Consider adding in Phase 2 or Phase 3.

## BL-004: Remove dead DEFAULT_MAX_PAYMENT_COUNT constant

`src/domain/constants.ts` contains only `DEFAULT_MAX_PAYMENT_COUNT` which is no longer
imported in any runtime code (Phase 5 migrated all usage to GlobalSettingsContext).
The file can be deleted and `src/domain/constants.ts` removed entirely once confirmed no
other code references it.

## BL-003: React Router future flag warnings

Two React Router v6→v7 migration warnings appear in tests:
- v7_startTransition
- v7_relativeSplatPath
These are harmless but could be addressed by adding future flags to BrowserRouter in main.tsx.

## BL-005: Retry logic on transient 5xx errors

`apiClient.ts` throws immediately on any non-OK response. The Phase 008 spec mentioned "retry once on 5xx". This was deferred — no retry logic was implemented. Consider adding a single automatic retry with exponential backoff for 500/502/503/504 responses, skipped for 4xx.

## BL-006: Centralized error-to-Hebrew toast mapper

Error display is currently inline per component (NewCustomerModal, TreatmentTypeModal, SettingsScreen). A shared `useApiError()` hook or `errorToHebrew(err: ApiRequestError): string` utility would eliminate repetition and ensure consistent Hebrew error messages across all future API-wired components.
