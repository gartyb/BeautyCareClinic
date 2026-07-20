# Infrastructure Security Findings — BeautyCareClinic — 2026-07-20

> Read-only audit of domain-2 infra config (proxy · ports · TLS/headers · containers · secrets/CI).
> No config was modified. Scope: repo root (`/home/runner/Projects/BeautyCareClinic`) plus the live
> Contabo server it runs on (aaPanel nginx vhost, ufw, running processes — audited directly since this
> session runs on that same box). This audits *config* (and, where noted, directly-observed live state)
> — it does not replace a dedicated `runtime-verify` pass from an external vantage point.

## Summary

| Severity | Count |
|---|---|
| 🔴 critical | 1 |
| 🟡 risk | 4 |
| 🔵 nit | 7 |

Top 3 to fix first:
1. 🔴 `ufw status` (live server) — aaPanel admin panel (port 888, full server-control UI) is reachable from the entire internet, guarded only by its own login — not by the network-boundary the docs claim.
2. 🟡 `/www/server/panel/vhost/nginx/beautycare.conf: location /` — no security headers (CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy) on the actual customer-facing SPA path; the backend's `SecurityHeadersMiddleware` never runs on this path.
3. 🟡 `ufw status` (live server) — undocumented open port `25664/tcp`, plus dead-but-open FTP rules (`20`, `21`, `39000:40000`) with no current listener — unused attack surface.

---

## Network exposure / ports / proxy — WARN

- 🔴 `docs/ARCHITECTURE.md:96` (documented posture) vs. live `ufw status verbose` — **the documented network posture ("only 22/80/443 externally reachable") does not match the live firewall.** `888/tcp ALLOW IN Anywhere` (+v6) is active, and `ss -tlnp` confirms aaPanel's admin panel is listening on `0.0.0.0:888`. Root cause: Phase 013 explicitly scoped out "aaPanel panel hardening... out of scope, not touched" — but that also means the port was never added to the ufw review, so a full server-admin UI is reachable from the whole internet with no network-layer control, only aaPanel's own login. **Why:** `02-network-and-ports.md §front-proxy/admin-UI exposure`, `§port-map hygiene`. **Fix:** restrict `888/tcp` in ufw to a known admin IP or a VPN/SSH-tunnel-only access pattern (aaPanel supports an IP allowlist for panel access); update `docs/ARCHITECTURE.md`'s Deployment Topology section to reflect the true allowed-port set instead of the aspirational one.

- 🟡 `ufw status verbose` (live server, not versioned in repo) — undocumented open port **`25664/tcp`** (`ALLOW IN Anywhere`, IPv4+IPv6), actively listening under process name `webserver` (an aaPanel auxiliary daemon; exact function not confirmed from this vantage point). Not referenced anywhere in `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `CHANGE_REQUESTS.md`, or `PROJECT_STATUS.md`. **Why:** `02-network-and-ports.md §port-map hygiene` (undocumented published port). **Fix:** identify the bound service (`lsof -p <pid>` / aaPanel service inventory) before deciding whether to close or document it. See Low-confidence section — severity may need revising once identified.

- 🟡 `ufw status verbose` (live server) — ufw allows `20/tcp`, `21/tcp` (FTP) and the passive-mode range `39000:40000/tcp` from anywhere, but `ss -tlnp` shows **no process currently listening** on any of them — dead attack surface, not an active exposure. If any FTP daemon (aaPanel bundles one) is ever installed/re-enabled, it becomes instantly internet-reachable with no further firewall step, and FTP is cleartext by default. **Why:** `02-network-and-ports.md §port-map hygiene`. **Fix:** `ufw delete allow 20`, `21`, `39000:40000` unless FTP is an intentional, currently-used feature — if it is, document it and confirm the service is actually SFTP/FTPS, not plaintext FTP.

- 🔵 `docker-compose.yml` (only defines `postgres`) vs. live `ss -tlnp` — the app's own Kestrel (`0.0.0.0:5000`) and Vite (`*:5174`) processes are un-versioned server state (`dotnet run` / `vite`), bound to all interfaces at the OS level with protection coming entirely from ufw default-deny rather than an explicit loopback bind — a single control, no defense-in-depth (same class of risk RC-4 already fixed for Postgres in Phase 013). Not exploitable today (confirmed no ufw allow rule exists for either port), but one misconfigured `ufw allow` re-opens direct access the way it did before Phase 013. **Why:** `02-network-and-ports.md §host-binding at the app edge`. **Fix:** optionally bind Kestrel/Vite explicitly to `127.0.0.1` (Phase 013's own non-blocking recommendation, still open).

Already tracked, not re-counted here:
- No `default_server` in `beautycare.conf` rejecting mismatched Host/SNI (raw-IP access falls through to the app) — **CR-035** (`CHANGE_REQUESTS.md`).
- `/swagger` → `127.0.0.1:5000` Basic-Auth gate — confirmed present and correctly configured; not re-flagged.

## TLS / HTTPS / security headers — WARN

- 🟡 `/www/server/panel/vhost/nginx/beautycare.conf: server{443} location /` — no `add_header` for `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`, or `Permissions-Policy` on the path that actually serves the customer-facing SPA (proxied to Vite on `127.0.0.1:5174`); the proxied Vite dev server doesn't add them either. The backend's `SecurityHeadersMiddleware` (`backend/BeautyCareClinic.Api/Middleware/SecurityHeadersMiddleware.cs`) only decorates `/api/v1/...` and `/swagger` — it never runs on this path. So the page that renders real customer PII ships with zero clickjacking/MIME-sniffing/CSP protection at the only hop the browser sees. **Why:** `03-tls-and-headers.md §4`. **Fix:** add the four headers (`nosniff`, `DENY` or `frame-ancestors 'none'`, `strict-origin-when-cross-origin`, and a CSP scoped to the SPA's actual script/style/connect/img sources) at the nginx `server{443}` level.

- 🔵 `/www/server/panel/vhost/nginx/beautycare.conf: server{443}` — no explicit `ssl_ciphers`/`ssl_prefer_server_ciphers`; only `ssl_protocols TLSv1.2 TLSv1.3` is pinned, leaving cipher choice to nginx's compiled-in default. Low-impact given TLS 1.3's AEAD-only suites. **Why:** `03-tls-and-headers.md` (cipher curation). **Fix:** consider an explicit modern cipher list (e.g. Mozilla "Intermediate") for defense-in-depth; not urgent.

Confirmed clean, no finding: HTTP→HTTPS 301 redirect (excl. ACME challenge path) is correct; TLS protocol restricted to 1.2/1.3, real Let's Encrypt cert (expires 2026-10-18, auto-renewing); HSTS present at the intentional staged `max-age=300` with no `preload`/`includeSubDomains` (matches CR-033/RC-3 exactly — not a defect); `server_tokens off` confirmed globally.

## Containers / images / compose — PASS (hardening niceties only)

- 🔵 `docker-compose.yml: services.postgres` — no `healthcheck:`; a wedged-but-alive Postgres process won't be flagged by container state. **Why:** `04-containers-and-images.md §5 hardening niceties`. **Fix:** add a `pg_isready`-based healthcheck.
- 🔵 `docker-compose.yml: services.postgres` — no `mem_limit`/`pids_limit`/`deploy.resources.limits`; a runaway query or connection storm has no ceiling and can affect the host's other processes (backend/frontend dev servers share the box). **Why:** `04-containers-and-images.md §5`. **Fix:** add resource limits sized to expected load.
- 🔵 `docker-compose.yml: services.postgres` — no `read_only: true` root filesystem; feasible with the data dir already a volume, reduces in-container-RCE blast radius, but needs a supervised test (some entrypoint steps write outside the data volume). **Why:** `04-containers-and-images.md §5`. **Fix:** evaluate `read_only: true` + tmpfs for `/tmp`/run-dirs.
- 🔵 `docker-compose.yml: image: postgres:17` — major-version tag only, not digest/patch-pinned; a future recreation can silently drift to a newer `17.x` patch. **Why:** `04-containers-and-images.md §2 base-image pinning`. **Fix:** pin a full patch tag or digest if reproducibility matters more than automatic patching (tradeoff, not clear-cut — human decision).

Confirmed clean: no `privileged`/`network_mode: host`/`docker.sock` mount/`cap_add` anywhere; no secrets baked into an image (no `Dockerfile`/build stage exists — pre-built official image only); `${VAR:?required}` interpolation on all Postgres env vars, real values in a gitignored `.env`; image tag documented with its `docker inspect` provenance command (Phase 013 code-review fix, confirmed present).

## Secrets in env & CI — WARN

- 🟡 `env.development.local` (git-tracked, confirmed via `git ls-files`) — a per-environment local-override file created **without the leading dot**, so it falls outside `.gitignore`'s `.env.*.local` pattern (only the correctly-dotted `.env.local` is excluded). Currently holds only `VITE_LOG_API_CALLS=true` (not a secret — no live leak today), but the gitignore gap means any future real value dropped into this file is committed by default. **Why:** `05-secrets-and-ci.md §1 committed env/secret files`. **Fix:** rename to `.env.development.local` (or add an explicit `env.*.local` rule to `.gitignore`) and `git rm --cached` the currently-tracked file.
- 🔵 No `.github/workflows/` exists — no CI pipeline yet, therefore no secret-scanning step (trufflehog/gitleaks) either. Not a defect introduced by this repo; flagging as a gap to close once CI is introduced. **Why:** `05-secrets-and-ci.md §3 CI/CD pipeline`. **Fix:** couldn't find a fix — needs human decision (premature until CI exists).

Confirmed clean: `.env.example`/`env.example`/`.env.docker.example` contain only placeholders; no real `.env`, `.pem`, `.key`, SSH key, or kubeconfig anywhere in the repo or its full git history; `Jwt:Secret` placeholder in `appsettings.json` causes a startup throw if left unreplaced (no committed signing key); broad secret-pattern grep (AWS keys, private-key headers, hardcoded passwords/connection strings) found nothing; live-verified `/www/beautycare-secrets/swagger_htpasswd` is `0750`/`0640` (`www:www`), outside every web-servable path — the Phase 013 fix holds exactly as documented.

---

## Low-confidence / needs human review
- ❔ `25664/tcp` (live ufw/ss) — open to the internet under an aaPanel `webserver` process; exact function/sensitivity not confirmed from this vantage point. Recheck with `lsof -p <pid>` or aaPanel's own service inventory before finalizing severity (currently rated 🟡 pending that confirmation — could be 🔴 if it exposes anything sensitive, or downgradable if it's inert).
- ❔ Postgres container non-root runtime UID — the official `postgres:17` image is documented to drop root internally, but this audit could not run `docker inspect --format '{{.Config.User}}' beautycare-postgres` against the live container to directly confirm (read-only constraint). Recommend a `runtime-verify` pass to close the loop.
- ❔ TLS 1.2 cipher suite specifics — no `openssl s_client`/`sslyze` scan was run; the missing explicit cipher list is flagged on the reference's general principle, not a confirmed weak-cipher observation.

## Coverage gaps & follow-ups
This report audits **config and directly-observed live server state** (this session runs on the same
Contabo box). Not covered here:
- **App-code vulns** (IDOR, injection, authz logic) → `/secure-audit` (out of scope for this pass — the
  user selected infra + server + privacy + e2e for this audit round, not the code-level 16-principle review).
- **Live reachability from an external vantage point** — this audit read `ufw status`/`ss -tlnp` directly on
  the server rather than probing from outside; a `runtime-verify` pass from an external host would
  independently confirm what's actually internet-reachable vs. what the local firewall config claims.
- **Coding-agent config** (this repo's `.claude/` setup) → `/agent-harden-audit`.
- **Cloud IAM / physical network segmentation** — Contabo VPS-level controls (if any) are infra-ops,
  out of scope.
- **Blind spots:** aaPanel's own internal security settings (rate limiting, WAF rules if any) were not
  reviewed — only ufw/nginx/docker-compose were audited. The `25664/tcp` service identity (see
  Low-confidence above).

## Method
- Auditors (read-only): `infra-auditor` ×4, by category (`network-exposure`, `tls-headers`,
  `container-hardening`, `secrets-config`). Baseline: `infra-security-review/references/`.
- No `PORT_MAP.md` exists in this repo; `docs/ARCHITECTURE.md`'s Deployment Topology section was used as
  the closest equivalent and found to be out of date (see network-exposure 🔴 above).
- Live server state (ufw, ss, file permissions, nginx vhost contents) was read directly, since this audit
  session runs on the same Contabo box the app is deployed on — not via a separate SSH hop.
