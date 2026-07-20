# E2E Behavioral Security Findings — BeautyCareClinic — 2026-07-20

> Drove the **running** app through attack/abuse playbooks via browser-mcp (`lean-chronoscope`,
> already running on this server as a per-session Chrome-automation container — resolves the
> "undocumented container" item flagged in `INFRA-SECURITY-FINDINGS.md`/`SERVER-HARDENING-FINDINGS.md`).
> Verified end-to-end from the capture and, for a subset of scenarios, from the real app Postgres DB.
> Target: `https://169-58-26-157.sslip.io` — **not a formal production deployment** (backend runs
> `ASPNETCORE_ENVIRONMENT=Development`, frontend is the raw Vite dev server; production-build migration
> is explicitly deferred, CR-034), but it **is** the clinic's only live environment with real customer
> data — tested with explicit user approval, throwaway/seed accounts, bounded volume (~25 requests
> total across all scenarios), and full cleanup of every row created (see Cleanup below). Assert mode:
> **dual-db** (capture + direct read-only/cleanup SQL against the real Postgres, via `docker exec`).

## Summary

| Verdict | Count |
|---|---|
| 🔴 vulnerable-confirmed | 3 |
| ✅ safe | 5 |
| ❔ inconclusive | 1 |

Confirmed-exploitable (fix first):
1. 🔴 **IDOR / broken object-level authz** — any authenticated Therapist reads any customer's full financial data (orders, payments, balance) with no ownership/scoping check. Evidence: `GET /api/v1/customers/{id}/orders` → `200` + real ₪1,000 order for a customer with zero relation to the calling therapist, confirmed with **two independent therapist accounts**.
2. 🔴 **Unauthenticated exposure** — the Vite dev server behind the proxy serves arbitrary repo files with **no auth at all**, bypassing the `/swagger` Basic-Auth gate entirely. Evidence: `GET /@fs/home/runner/Projects/BeautyCareClinic/backend/BeautyCareClinic.Api/appsettings.Development.json` → `200` + full file content, from a fresh unauthenticated session.
3. 🔴 **Data-subject deletion blocked with no alternative** — a customer with any related record (order/appointment/treatment/note) cannot be deleted or anonymized by any means. Evidence: `DELETE /api/v1/customers/{id}` → `409 Conflict` on a throwaway customer with one attached note; no anonymization path exists in the API.

---

## Scenario results

### 🔴 idor / broken-object-level-authz — vulnerable-confirmed
- **property:** a Therapist reads only customers/financial records relevant to their own work, not every customer in the clinic.
- **drive:** logged in as `therapist1@clinic.local`; the search list itself already returns **all** customers with financial summaries (active-series count, outstanding balance); opened `מיכל כהן` (a customer with no seed/appointment link to therapist1) and captured `GET /api/v1/customers/{id}/orders`.
- **http:** `200` on `GET /api/v1/customers/f8db82fc-5a15-4b80-8ffc-4a023cd22d55/orders`.
- **capture:** response body: `{"id":"848e47ac-...","customerId":"f8db82fc-...","originalPrice":1000.00,"remainingBalance":1000.00,"amountPaid":0.00,...}` — full financial detail, order id, payment count.
- **cross-account confirmation:** repeated the identical request logged in as a **second, independent** therapist account (`therapist2@clinic.local`) — also `200`, same data (520-byte body).
- **note:** discovered endpoint `GET /api/v1/customers/{id}/orders` (also reproduces for `/notes`, `/treatments`, `/treatment-series` — all `[Authorize]`-only, no ownership filter, per `CustomersController.cs`/`PaymentsController.cs`). Maps directly to the static findings already in `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` §ג (access-logging, תק' 8(א)) and `CHANGE_REQUESTS.md` CR-029 — this run converts those from "suspected via code reading" to **proven via live behavior with two real accounts**.

### 🔴 unauth-exposure — vulnerable-confirmed
- **property:** sensitive files/endpoints require authentication.
- **drive:** fresh unauthenticated `fetch` (no `Authorization` header, no prior login) to the Vite `/@fs/` path serving arbitrary repo files.
- **http:** `200` on `GET /@fs/home/runner/Projects/BeautyCareClinic/backend/BeautyCareClinic.Api/appsettings.Development.json`.
- **capture:** response body begins `{"Logging":{"LogLevel":{"Default":"Information",...` — real config file content, no `/swagger`-style Basic-Auth challenge encountered.
- **note:** reproduces (via the browser this time, not just `curl`) the finding already logged in `SERVER-HARDENING-FINDINGS.md` (edge category) — the dev-mode Vite server bypasses the reverse-proxy's only auth gate entirely. `GET /api/v1/customers` (the real data API) correctly returned `401` unauthenticated — the gap is specific to the Vite dev-server escape hatch, not the API surface itself.

### ✅ broken-func-authz (privilege escalation) — safe
- **property:** a Therapist (low-priv) cannot perform Manager-only actions.
- **drive:** as `therapist1`, attempted `PUT /api/v1/customers/{id}` (edit), `DELETE /api/v1/customers/{id}`, and `POST /api/v1/users` (create a new Manager account) via `script_evaluate(fetch)`.
- **http:** `403` on all three.
- **capture:** empty body on each — no partial leak, no stack trace.
- **db:** confirmed no new row was created in `Users` (count unchanged at 12 before/after) and `מיכל כהן`'s record unchanged.

### ✅ token-exposure — safe (with two already-tracked exceptions, not new)
- **property:** no token in URL; auth transport doesn't leak the session.
- **drive:** `localStorage_list` + `cookies_list` post-login; inspected the `/api/v1/auth/login` response body.
- **capture:** `authToken` (raw JWT) stored in `localStorage` — **not** a new finding, matches the already-accepted risk H2/CR-012 ("JWT stored in localStorage"). Decoded JWT payload includes `email` + full Hebrew `name` claim — **not** a new finding, matches CR-017 ("PII in JWT payload"). `cookies_list` → 0 cookies (pure Bearer-token design, no cookie-flag issue since no cookie is used). No token found in any captured URL query string.
- **note:** this run supplies live confirmation of two already-open CRs rather than a new issue — no action beyond what's already tracked.

### 🔴/✅ sensitive-data-in-response — same evidence as idor above
- Covered by the idor scenario (the financial data exposed there IS the sensitive-data-in-response instance). No additional distinct scenario run.

### ❔ mass-assignment — inconclusive
- **property:** privileged fields (role, isActive) are not client-settable via a self-update endpoint.
- **drive:** searched for a Therapist self-update endpoint; `GET /api/v1/auth/me` exists (read-only, 200) but no PUT/PATCH self-update route was discovered for the Therapist role in the time budget (a guessed `PUT /api/v1/therapists/{ownId}` returned `404` — not a real route, not evidence of anything).
- **verdict rationale:** genuinely could not confirm a self-update endpoint exists at all for this role within the bounded request budget — **inconclusive**, not "safe". A follow-up run with UI-driven discovery (find the actual "edit my profile" screen, if any, and capture its real save request via `network_list`) would resolve this.

### ✅ rate-limit — safe
- **property:** the login endpoint throttles repeated failures.
- **drive:** 10 rapid wrong-password `POST /api/v1/auth/login` attempts against `therapist1@clinic.local`.
- **http:** attempts 1-4 → `401` (normal invalid-credential response); attempts 5-10 → `429` (Too Many Requests).
- **note:** this is a genuinely good result — login rate-limiting is implemented and works under a live burst. Worth noting as a positive control alongside the SSH-layer brute-force finding in `SERVER-HARDENING-FINDINGS.md` (that attack targets SSH, a different layer — this confirms the app's own login endpoint is separately protected).

### ✅ error-leak — safe
- **property:** malformed requests don't leak stack traces/internal details.
- **drive:** `GET /api/v1/customers/not-a-valid-guid` (malformed id) and `POST /api/v1/customers` with intentionally-broken JSON body.
- **http:** `404` (routing constraint rejects non-GUID before reaching any handler, empty body) and `400` (standard ASP.NET Core `ProblemDetails` response) respectively.
- **capture:** the 400 body is a standard RFC-9110 problem-details object (`{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.",...,"traceId":"..."}`) — a JSON-parser line/position message and a `traceId` for log correlation, but **no stack trace, no SQL error, no file path, no framework version banner**. Judged safe.

### 🔴 data-deletion (privacy) — vulnerable-confirmed (dual-db)
- **property:** a data-subject deletion request actually removes/anonymizes personal data (Sec 14).
- **drive (as Manager, throwaway customers only):**
  1. Created customer A (`E2E-TEST-מחיקה-נקי`, zero related records) → `DELETE` → `204 No Content`. **Safe/expected** — a customer with no history is genuinely hard-deleted, confirmed removed via DB (`SELECT count(*) ... = 0`).
  2. Created customer B (`E2E-TEST-מחיקה-עם-נתונים`), attached one `Note` to it → `DELETE` → **`409 Conflict`**, body: `{"code":"CONFLICT","message":"Cannot delete customer with existing orders, appointments, treatments, or notes."}`.
- **db:** confirmed no anonymization occurred — the customer row and its note remained fully intact (real name/phone/email, real note content) after the refused deletion; no code path exists to anonymize instead.
- **note:** live proof of the finding already documented in `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md` §ה (סעיף 14(א)) — this run demonstrates it end-to-end rather than only from code reading. Customer B and its note were cleaned up manually afterward via direct SQL delete (see Cleanup) since the API itself cannot remove them.

---

## Cleanup performed

All throwaway data created during this run was removed:
- `E2E-TEST-מחיקה-נקי` (customer, no related data) — removed by the API itself (`204`), confirmed gone via DB.
- `E2E-TEST-מחיקה-עם-נתונים` (customer) + its attached `Note` — the API refused deletion (the finding above), so both rows were removed directly via SQL (`DELETE FROM "Notes" WHERE "Id"=...` then `DELETE FROM "Customers" WHERE "Id"=...`), verified `count(*) = 0` for both afterward.
- The `POST /api/v1/users` mass-assignment/escalation attempt and the `PUT`/`DELETE` privilege-escalation attempts against a real customer (`מיכל כהן`) all returned `403` and made **no** state change — verified via DB (`Users` count unchanged at 12; `מיכל כהן`'s record byte-for-byte unchanged) — nothing to clean up there.
- No other real customer/order/payment/note data was modified. All IDOR/sensitive-data-in-response evidence came from **read-only** requests against pre-existing real data (`מיכל כהן`), consistent with the fact that read access to all customers is already the documented status quo for any authenticated staff account — this run did not create new read exposure, only proved the existing one behaviorally.

**Housekeeping note (not part of this run, observed in passing):** the `Users`/`Customers` tables already contain several leftover synthetic test rows from earlier manual browser-validation sessions in prior phases (e.g. `phase12test@clinic.local`, `note-test-...@test.com`, `appt-manager-...@test.com`, `לקוחה חדשה לנסיון`, `בדיקת תורים` ×2, `בדיקת הערה`). These predate this audit and were not created or touched by it — flagging for the user's awareness as a general data-hygiene item, not a security finding.

## Coverage gaps & follow-ups
What this run did **not** exercise:
- **Roles:** only Manager + Therapist (the app's only two roles) were driven — no additional privilege tiers exist to test.
- **Flows not driven:** appointment booking, treatment recording (timer/quantity), payment recording, order creation — the write-heavy flows most likely to have their own authz/validation edge cases. Not tested this round to keep total request volume bounded and blast radius on the live system minimal.
- **Mass-assignment:** inconclusive (see above) — no self-update endpoint discovered for Therapist in the time budget.
- **Not yet in the generic playbook (residual, per skill definition):** CSRF, SSRF, stored-XSS, file-upload type bypass, open-redirect, CORS reflection.
- **Business-logic correctness / multi-step races:** not exercised (e.g. concurrent booking/double-booking edge cases already covered by Phase 011's own ADR-011-A design, not re-tested here).
- This report should feed the same blind-spot ledger as the other three reports (`/security-ledger`, if the user wants a consolidated coverage view across all four).

## Method
- Driver: this session, one browser-mcp (`lean-chronoscope`) page, sequential role-switching (login/logout) rather than concurrent multi-session, since the MCP connection is bound to its own session.
- Capture: browser-mcp per-session SQLite, queried via `network_list`/`network_get`/`console_list`.
- Dual-db: direct read/write SQL via `docker exec` into `beautycare-postgres` (the real, live database) — used read-only for verification and narrowly-scoped writes only for creating/removing the run's own throwaway rows, never touching pre-existing real records.
- Accounts: seed accounts already present in the database (`manager@clinic.local`, `therapist1@clinic.local`, `therapist2@clinic.local`) — no new accounts created for this run.
- Total requests across all scenarios: ~25, within the skill's bounded-volume guidance (~10-15 per scenario, kept well under that per scenario here).
