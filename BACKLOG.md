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

## BL-003: React Router future flag warnings

Two React Router v6→v7 migration warnings appear in tests:
- v7_startTransition
- v7_relativeSplatPath
These are harmless but could be addressed by adding future flags to BrowserRouter in main.tsx.
