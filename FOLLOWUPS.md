# FOLLOWUPS

Out-of-scope bugs found during Phase 001 implementation.

## FU-001: Vitest 2.x / Vite 6.x type incompatibility

Vitest 2.x bundles its own vite (v5.x), which conflicts with top-level vite 6.x plugin types.
As a result, `vitest.config.ts` is not included in `tsconfig.node.json` (types not checked at build time).

Resolution options:
- Upgrade vitest to v3.x (compatible with vite 6)
- Or accept the separate config file workaround

Deferred to: Phase 2 dependency audit.
