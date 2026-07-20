# Phase 013 — Nginx Reverse Proxy + HTTPS Access

## Status

Approved — Pending Commit

## Architecture Review

**Verdict:** Approve with 4 required corrections (all adopted, reflected below).

**Approved as planned:** aaPanel's existing nginx as the sole entry point (not a second systemd nginx); ufw rollout order (Nginx verified first, port lockdown after); insisting on a real external connectivity test rather than trusting `ufw status`; keeping dev-mode frontend/backend and deferring the production-build switch to a future phase; treating Postgres exposure as a real finding requiring an active fix, not an assumption that it's already closed.

**Required corrections (all adopted, reflected in Scope below):**

1. **RC-1 (relative API base URL):** The plan's entire "same-origin, CORS-irrelevant" argument depends on the frontend calling a *relative* `/api/v1` base. `src/api/apiClient.ts:10` already falls through to `/api/v1` correctly (`import.meta.env.VITE_API_URL ?? '/api/v1'`), and the live `env.development.local` has no `VITE_API_URL` override — so the **running system is fine today**. But `env.example`/`.env.example` both ship `VITE_API_URL=http://localhost:5000/api/v1` (absolute) as the example value — if anyone ever copies that into a real `.env.local`, every API call breaks the moment port 5000 is firewalled (absolute URL bypasses the Vite proxy, is cross-origin so CORS applies, is mixed-content under HTTPS, and points at the caller's own `localhost` for any remote user). Fix the example files to show the relative form, and add an explicit acceptance-criteria check that the deployed env has no absolute `VITE_API_URL` override.
2. **RC-2 (gate `/swagger`):** Routing `/swagger` straight to the backend with no auth in front of it on the public HTTPS hostname re-opens part of what the port-5000 lockdown is meant to close — `https://<hostname>/swagger/v1/swagger.json` would publicly disclose the entire API surface and make `/swagger` a scannable, unauthenticated endpoint. API endpoints themselves still require JWT, so this is disclosure/attack-surface, not direct data exposure, but it contradicts the phase's own stated goal. Fix: add HTTP Basic auth (`auth_basic` + htpasswd) in front of the nginx `/swagger` location. Swagger UI and Postman both still work fine (Basic auth once, JWT for the actual API calls as before).
3. **RC-3 (stage the HSTS rollout):** Do not ship a long `max-age` HSTS header on day one. HSTS is a footgun — once a browser caches it, a cert/config mistake locks that browser out for the full `max-age` with no HTTP fallback, and this is riskier here because TLS validity depends on a third party (sslip.io) and Let's Encrypt has shared rate limits on the sslip.io registered domain (shared by all its users). Fix: ship HTTPS first with a short `max-age` (e.g. 300s) or no HSTS at all, verify cert validity + redirect + auto-renewal over a burn-in window, **then** raise to a long `max-age`. Do not set `preload`; think twice about `includeSubDomains` given the shared suffix.
4. **RC-4 (fix Postgres exposure at the Docker layer, not only ufw):** Docker inserts its own iptables rules (DOCKER chain, evaluated before ufw's INPUT chain) for published ports, which is exactly why a `-p 5432:5432` publish can stay reachable regardless of a `ufw deny 5432` rule. The correct fix is to rebind the published port to loopback — recreate the Postgres container with `-p 127.0.0.1:5432:5432` (the host `dotnet run` backend already connects via `localhost`, so this keeps it working). There is no `docker-compose.yml`/Dockerfile in the repo today, so this container's run configuration is currently un-versioned server state — capture the corrected configuration in the repo (a small `docker-compose.yml` pinning `127.0.0.1:5432:5432`, or a documented run command under `docs/`) so the fix survives a container recreation.

**Recommendations (non-blocking):** pin the ACME mechanism to aaPanel's own SSL UI now rather than deciding at implementation time (keeps issuance/renewal/reload under one consistent owner instead of a standalone certbot potentially fighting aaPanel's config management); explicitly name the Contabo VNC/web console as the SSH-lockout recovery path in the rollback documentation; optionally bind Vite/Kestrel themselves to `127.0.0.1` (defense-in-depth, since ufw *does* govern host processes unlike Docker — not required, since ufw already covers this case, but consistent with the Postgres fix philosophy); optionally add baseline security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) at the nginx layer for the Vite-served HTML, since `SecurityHeadersMiddleware` today only decorates backend responses (partially advances CR-004); note the sslip.io hostname's IP-encoded nature as a known limitation (if the server IP ever changes, hostname/cert/bookmarks all change) — acceptable for an interim setup.

**ADR:** `ADR-013-A` created (interim/superseded-by-future-prod-phase) — see below.

### ADR-013-A — Public Entry Topology: aaPanel nginx + sslip.io TLS over dev-mode origin (interim)

**Status:** Accepted for Phase 013 (interim — expected to be superseded by a domain-backed production-build deployment phase).

**Context:** The app was directly exposed on raw dev-server ports (Vite 5174, Kestrel 5000) without HTTPS on a publicly-reachable box (which turned out to be the same machine as the dev environment), with Postgres (5432) accidentally exposed too. No domain was purchased.

**Decision:** Make aaPanel's pre-installed nginx the sole public entry point (80/443), terminate real Let's Encrypt TLS via a free `<ip>.sslip.io` wildcard-DNS hostname, reverse-proxy all paths to the existing Vite dev server (which already proxies `/api`→5000), with a Basic-auth-gated `/swagger` route to 5000 for testing. Lock down ufw and rebind Docker's Postgres port to loopback so only 22/80/443 are externally reachable. Frontend/backend remain in dev mode — only the network path to reach them changes.

**Alternatives rejected:** buy a domain + do the full production-build switch now (larger scope, premature for the current need); expose port 5000 directly for API testing (defeats the lockdown); rely on ufw alone for Postgres (Docker bypasses ufw).

**Consequences / new invariants:** nginx is now the only public surface and the only place TLS, HSTS, and security headers are terminated. The frontend **must** keep a relative API origin (no absolute `VITE_API_URL`) for the same-origin/CORS-free model to hold (RC-1). `/swagger` **must** stay Basic-auth-gated (RC-2). TLS availability now depends on sslip.io and Let's Encrypt rate limits (RC-3 mitigates blast radius via staged HSTS). This topology is explicitly **interim** and is expected to be superseded once a real domain-backed production deployment phase happens.

## Goal

הפיכת aaPanel's nginx לנקודת הכניסה הציבורית היחידה לשרת (פורטים 80/443), עם HTTPS מהימן (ללא אזהרות דפדפן) דרך hostname חינמי מסוג sslip.io + Let's Encrypt — בלי לקנות דומיין ובלי לשנות את מצב ה-dev של ה-frontend/backend.

## Business Value

המערכת נגישה כיום מהאינטרנט הציבורי ישירות דרך dev servers גולמיים (Vite על 5174, `dotnet run` על 5000) ללא HTTPS — חשיפה שתועדה כ"מצב זמני" ב-PROJECT_STATUS.md (M4/M5) וב-CR-014. פאזה זו סוגרת את הפער בעלות מינימלית: ללא שינוי קוד אפליקציה, ללא קניית דומיין, וללא מעבר ל-production build (מוקדם מדי כרגע). התוצאה: גישה מאובטחת, כתובת HTTPS יציבה עם תעודה תקינה, וסגירת יציאות גישה ישירות (כולל Postgres שנמצא חשוף בטעות).

## Background — ממצאי בדיקה

- שרת: Contabo VPS, IP `169.58.26.157`, hostname `vmi3444167`, Ubuntu 24.04.4 — **אותה מכונה בדיוק שעליה רץ סביבת הפיתוח**.
- Frontend: `vite` dev server גולמי על פורט 5174, לא production build. `vite.config.ts` כבר מגדיר `server.proxy['/api'] -> http://localhost:5000`, כך שקריאות ה-API מה-frontend הן same-origin (`/api/v1/...`) ומועברות server-side ל-backend — **לא כפופות ל-CORS של הדפדפן**.
- Backend: `dotnet run` עם `ASPNETCORE_ENVIRONMENT=Development` על פורט 5000 (Swagger פעיל, CORS policy ב-`Program.cs` מתיר רק `http://localhost:5174`).
- שני הפורטים (5174, 5000) נגישים כרגע ישירות מהאינטרנט. ufw מתיר 5174 במפורש (מתויג `# TEMP - manual site check`); 5000 מאזין על `0.0.0.0` ולא מופיע מפורשות ב-ufw allow list — נגישות בפועל מבחוץ טרם אומתה.
- aaPanel מותקן (`/www/server/panel`) עם nginx משלו (`/www/server/nginx`, לא systemd package — לכן `systemctl is-active nginx` מחזיר `inactive`). כרגע לא קיים vhost שמצביע לאפליקציה; nginx של aaPanel משרת רק את דף ברירת המחדל שלו.
- Postgres (5432) מאזין על `0.0.0.0` דרך `docker-proxy`. לא רשום מפורשות ב-ufw, אך Docker ידוע כמכניס כללי iptables שעוקפים ufw — נגישות בפועל מבחוץ טעונה בדיקה ישירה (לא רק קריאת כללי ufw).
- אין דומיין, והוחלט שלא לקנות אחד.

## Scope

### 1. DNS / Hostname

- שימוש ב-hostname מסוג `<ip-with-dashes>.sslip.io` (למשל `169-58-26-157.sslip.io`) שמצביע אוטומטית ל-IP הציבורי של השרת, ללא רישום.

### 2. תעודת SSL

- הפקת תעודת Let's Encrypt (דרך aaPanel's ACME UI או certbot — להחליט בזמן ההטמעה, מה שזמין בפועל) עבור ה-hostname הנ"ל.

### 3. aaPanel Vhost (Nginx)

- יצירת vhost חדש (דרך ממשק aaPanel או קובץ קונפיגורציה תחת `/www/server/panel/vhost/nginx/`) הכולל:
  - Listen 80 → redirect 301 ל-HTTPS.
  - Listen 443 עם התעודה שהופקה.
  - `Strict-Transport-Security` header (HSTS).
  - Reverse proxy ל-`http://127.0.0.1:5174` (Vite dev server) עבור כל הנתיבים הכלליים.
  - **`location /swagger`** (ותתי-הנתיבים שלו, כולל `/swagger/v1/swagger.json`) מנותב ישירות ל-`http://127.0.0.1:5000` — כדי לאפשר גישת בדיקות ל-backend (Swagger UI/Postman) דרך HTTPS, בלי לפתוח את פורט 5000 עצמו לאינטרנט. **מוגן ב-HTTP Basic Auth (RC-2)** — `auth_basic` + `htpasswd` — כדי לא לחשוף את כל ה-API surface (`swagger.json`) ללא הזדהות לכל האינטרנט.
  - תמיכת WebSocket מלאה (`proxy_http_version 1.1`, `Upgrade`/`Connection` headers) עבור Vite HMR.
  - וידוא שרק nginx של aaPanel רץ (לא systemd nginx מקביל).
  - **HSTS מדורג (RC-3):** בהתקנה הראשונית — `max-age` קצר (למשל 300 שניות) או ללא HSTS כלל. רק אחרי "burn-in" שמאשר תעודה תקינה, redirect תקין, וחידוש אוטומטי — להעלות ל-`max-age` ארוך. ללא `preload`; לשקול פעמיים `includeSubDomains` (הסיומת sslip.io משותפת).

### 4. תיקון `VITE_API_URL` לדוגמה (RC-1)

- `env.example`/`.env.example` כיום מציגים `VITE_API_URL=http://localhost:5000/api/v1` (כתובת מוחלטת) כערך לדוגמה — למרות שהמערכת הרצה בפועל (`env.development.local`) לא דורסת את ברירת המחדל, ולכן כבר משתמשת נכון בכתובת יחסית (`/api/v1`, `src/api/apiClient.ts:10`). לתקן את קובצי ה-example לערך יחסי, כדי שאף אחד לא יעתיק בטעות כתובת מוחלטת שתשבור את כל קריאות ה-API ברגע שפורט 5000 ייסגר חיצונית (עוקף proxy, cross-origin, mixed-content תחת HTTPS, ומצביע על ה-`localhost` של המשתמש ולא של השרת).

### 5. תיקון חשיפת Postgres ברמת Docker (RC-4)

- שכתוב הפעלת קונטיינר ה-Postgres כך שהפורט המפורסם יהיה `-p 127.0.0.1:5432:5432` במקום `0.0.0.0` — כי Docker מכניס כללי iptables משלו (DOCKER chain) שמוערכים **לפני** ufw's INPUT chain, ולכן `ufw deny 5432` לבדו לא בהכרח סוגר את הגישה בפועל. ה-backend (`dotnet run` על ה-host) מתחבר דרך `localhost` ולכן ימשיך לעבוד ללא שינוי.
- **לתעד את הקונפיגורציה המתוקנת בריפו** (קובץ `docker-compose.yml` קטן שנועל `127.0.0.1:5432:5432`, או פקודת ההרצה מתועדת תחת `docs/`) — כרגע אין `docker-compose.yml`/Dockerfile בריפו כלל, כך שההפעלה הנוכחית היא server state לא-מתועד; בלי לתעד זאת, התיקון עלול ללכת לאיבוד בהפעלה מחדש של הקונטיינר.

### 6. הקשחת Firewall (ufw) — רק אחרי אימות Nginx מלא

- להשאיר: 22 (SSH — קריטי, לא לגעת), 80, 443.
- להסיר גישה חיצונית ל-5174 ו-5000 (localhost-only דרך Nginx בלבד).
- לוודא ש-Postgres (5432) לא נגיש מבחוץ בפועל אחרי RC-4 (בדיקה חיצונית אמיתית, לא רק קריאת ufw).

## Out of Scope

- מעבר ל-production build של ה-frontend (`npm run build`).
- מעבר ה-backend ל-`ASPNETCORE_ENVIRONMENT=Production`.
- קניית/רישום דומיין.
- הקשחת aaPanel panel עצמו (הפאנל האדמיניסטרטיבי על פורט 888, חשוף כיום לכל האינטרנט) — נשאר כפי שהוא, מועמד לפאזה/CR נפרדת.
- שינוי מדיניות CORS (CR-013) — לא נדרש בפאזה זו כי תעבורת דפדפן הופכת ל-same-origin דרך שרשרת ה-proxy; CR-013 נשאר פתוח לפרודקשן עתידי.
- Backup/version-control לקובצי הקונפיגורציה של Nginx.

## Database / Domain / API / UI Changes

אין. פאזה תשתיתית בלבד — ללא שינוי קוד אפליקציה, סכימת DB, או ממשקי API/UI.

## Validation Rules

לא רלוונטי (תשתית).

## Main Implementation Components

- **Nginx/aaPanel**: vhost + SSL + WebSocket passthrough + HSTS.
- **ufw**: כללי firewall מעודכנים, בשלבים (Nginx קודם, נעילת פורטים אחרי אימות).
- **Postgres exposure**: אימות ותיקון נגישות חיצונית.
- אין שינוי קוד `vite.config.ts` או `Program.cs` בהיקף הבסיסי (ראה שאלה פתוחה #2 לגבי Vite HMR מעל HTTPS).

## Testing Strategy

אין שינויי קוד אפליקציה — לכן אין טסטים אוטומטיים חדשים (xUnit/Vitest). האימות הוא **ידני**, כולל:

1. Resolve ה-hostname (מהשרת ומבחוץ).
2. `curl` מבחוץ: HTTP→HTTPS redirect (301), ואז 200 עם תוכן תקין.
3. בדיקת תעודה בדפדפן: מנעול ירוק, ללא אזהרה, מונפקת ע"י Let's Encrypt.
4. גלישה מלאה באפליקציה דרך ה-URL החדש: טעינת דפים, קריאות `/api/v1/...`, ותפקוד HMR של Vite (WebSocket) ללא שגיאות ב-Console.
5. בדיקת HSTS header בתגובה.
6. **בדיקה חיצונית קריטית** (ממחשב אחר, לא מהשרת עצמו): 5174/5000/5432 לא נגישים; 22/80/443 כן נגישים.
7. אימות ש-SSH נשאר פעיל אחרי כל שינוי ufw/nginx reload.

## Risks

- **נעילה עצמית מ-SSH** תוך כדי עריכת ufw על אותו חיבור — יש לוודא כלל allow 22 קיים לפני/אחרי כל שינוי, ולבצע שינויי ufw בזהירות, שלב-שלב, לא all-at-once. **Recovery path מתועד**: קונסולת VNC/web של Contabo, לא רק SSH.
- **שגיאת קונפיגורציית Nginx** עלולה להפיל את השירות — יש להריץ `nginx -t` (הבינארי של aaPanel) לפני reload.
- **Postgres עוקף ufw דרך Docker iptables** — טופל ב-RC-4 (rebind ל-`127.0.0.1`); חובה בדיקה חיצונית אמיתית לאימות, לא הסתמכות על `ufw status` בלבד.
- **תלות בצד שלישי בשרשרת האמון של TLS** — sslip.io היא תלות טעונה: אם השירות נופל/משנה התנהגות, HTTPS נפגע. Let's Encrypt מטיל rate limits משותפים על הדומיין הרשום `sslip.io` (משותף לכל המשתמשים שלו) — הפקה/חידוש עלולים להיחסם ברגע לא נוח. זו הסיבה המרכזית ל-RC-3 (HSTS מדורג).
- **חידוש תעודה אוטומטי** — לוודא ש-cron/מנגנון החידוש של aaPanel מוגדר, אחרת התעודה תפוג בעוד ~90 יום.
- **Vite HMR מעל HTTPS reverse proxy** — ייתכן שיידרש עדכון קטן בקונפיגורציית ה-HMR של Vite אם ה-WebSocket לא יעבור נכון (ראה Open Questions #2).
- **sslip.io hostname מקודד-IP** — אם ה-IP של השרת ישתנה אי-פעם, ה-hostname/תעודה/סימניות כולם משתנים. מקובל למצב ביניים זה, מתועד כמגבלה ידועה.

## Dependencies

- aaPanel (כבר מותקן), Let's Encrypt/ACME, ufw, גישת SSH (כבר אומתה).
- Frontend/backend כבר רצים (תלות קיימת, לא נוצרת בפאזה זו).

## Open Questions — Resolved

1. **גישת Swagger/backend אחרי הנעילה — הוחלט: כן, נדרשת גישה לבדיקות.** נוסף `location /swagger` ב-Nginx שמנתב ישירות ל-`127.0.0.1:5000`, כך ש-Swagger UI (ובדיקות ידניות מול ה-backend) נגישים דרך `https://<hostname>/swagger` — בלי לפתוח את פורט 5000 עצמו לאינטרנט. קריאות API בפועל (`/api/v1/...`) ממשיכות לזרום דרך Vite כרגיל, ללא בעיית CORS (same-origin).
2. **Vite HMR מעל HTTPS — מאושר.** אם ה-WebSocket של Vite HMR ידרוש קונפיגורציית `server.hmr` מפורשת (protocol `wss`) כדי לעבוד נכון מאחורי Nginx+HTTPS, זה שינוי קטן ומוצדק בהיקף הפאזה (לא נחשב "production build switch"). ייבדק ויתוקן בזמן ההטמעה אם נדרש.
3. **בדיקת חשיפת Postgres — מאושר.** עצירה זמנית של קונטיינר ה-Postgres בזמן בדיקת ufw החיצונית, וידוא שאר הפורטים, ואז הפעלה מחדש.

## Acceptance Criteria

### הכנה
- [ ] Frontend ו-Backend רצים כרגיל (5174, 5000) — ללא שינוי.

### Nginx + HTTPS
- [ ] Hostname (sslip.io) נפתר לכתובת ה-IP הנכונה, מבחוץ.
- [ ] Vhost נוצר ב-aaPanel's nginx, `nginx -t` עובר ללא שגיאות.
- [ ] תעודת Let's Encrypt תקינה מותקנת ומוצגת בדפדפן ללא אזהרה.
- [ ] HTTP (80) מפנה 301 ל-HTTPS.
- [ ] HSTS מתגלגל בשלבים (RC-3): `max-age` קצר תחילה, מאומת ל-max-age ארוך רק אחרי burn-in; ללא `preload`.
- [ ] מנגנון חידוש תעודה אוטומטי מאומת/מתועד.

### פונקציונליות
- [ ] האפליקציה נטענת במלואה דרך ה-URL החדש (HTTPS) — ללא מסכים ריקים, ללא mixed-content warnings.
- [ ] קריאות `/api/v1/...` עובדות מקצה לקצה דרך ה-proxy.
- [ ] Vite HMR (WebSocket) עובד ללא שגיאות ב-Console.
- [ ] **RC-1**: `env.example`/`.env.example` מתוקנים לכתובת יחסית; מאומת שאין `VITE_API_URL` מוחלט בקובץ ה-env הפעיל בשרת.

### הקשחת רשת
- [ ] ufw: 22/80/443 מותרים; 5174/5000 חסומים לגישה חיצונית **ישירה** (פורט 5000 נגיש רק דרך Nginx `/swagger`, לא כפורט פתוח).
- [ ] בדיקה חיצונית אמיתית (לא מהשרת) מאשרת ש-5174/5000/5432 אינם נגישים כפורטים גולמיים, ו-22/443 כן נגישים.
- [ ] **RC-4**: קונטיינר Postgres מוגדר מחדש עם `-p 127.0.0.1:5432:5432`; קונפיגורציה מתועדת בריפו (`docker-compose.yml` או `docs/`).
- [ ] **RC-2**: `https://<hostname>/swagger` מוגן ב-HTTP Basic Auth, נגיש ומציג Swagger UI תקין (אחרי הזדהות), כולל אפשרות להריץ בקשות ("Try it out") בהצלחה.
- [ ] SSH נשאר תקין ונגיש בכל שלב (אין נעילה עצמית).

### תיעוד
- [ ] מיקום קובץ ה-vhost, שיטת חידוש התעודה, וכללי ה-ufw הסופיים מתועדים ב-`docs/ARCHITECTURE.md` ו/או `docs/TECH_STACK.md`.
- [ ] הליך rollback (איך לפתוח מחדש 5174/5000 לצורך דיבאג, איך להתאושש מנעילת SSH דרך קונסולת Contabo VNC) מתועד.
- [ ] ADR-013-A מתועד (ראה Architecture Review לעיל).

## Implemented

- **aaPanel nginx vhost** (`/www/server/panel/vhost/nginx/beautycare.conf`): port 80 → 301 redirect to HTTPS (excluding `/.well-known/acme-challenge/`); port 443 terminates TLS, reverse-proxies `/` to `127.0.0.1:5174` (Vite, with full WebSocket upgrade support for HMR) and `/swagger` to `127.0.0.1:5000` directly (RC-2: gated by HTTP Basic Auth, credentials at `/www/wwwroot/beautycare-secrets/swagger_htpasswd`).
- **TLS**: Let's Encrypt certificate for `169-58-26-157.sslip.io` via `certbot certonly --webroot`, expires 2026-10-18. Auto-renewal via `certbot.timer` + a deploy-hook (`/etc/letsencrypt/renewal-hooks/deploy/reload-aapanel-nginx.sh`) that reloads aaPanel's nginx specifically. Renewal dry-run verified successful.
- **HSTS (RC-3, staged)**: shipped at `max-age=300` intentionally, not yet raised — tracked as CR-033.
- **`vite.config.ts`**: added `server.allowedHosts`/`server.hmr` (wss/443) so requests proxied through the public hostname aren't blocked by Vite's built-in Host-header check and HMR works correctly behind HTTPS (resolves Open Question #2; Vite's Host-header block was discovered live during implementation, not anticipated in planning). Per code review (below), the public hostname is **not** hardcoded — it's read from `VITE_PUBLIC_HOST`, set only in a local gitignored `.env.local` on this server, so any other/local dev checkout keeps Vite's normal default behavior untouched.
- **RC-1**: `.env.example`/`env.example` corrected from an absolute `VITE_API_URL` to the relative form, with an explanatory comment. Confirmed the live `env.development.local` never had the absolute override — the running system was already correct, only the example files were misleading.
- **RC-4**: `beautycare-postgres` container recreated with `-p 127.0.0.1:5432:5432` (was `0.0.0.0`), same image/volume/env — no data loss (named volume `beautycare-postgres-data` preserved). Also added `--restart unless-stopped` (was previously `no`) as a small, low-risk resilience improvement noticed during the recreation. Configuration captured in new `docker-compose.yml` + `.env.docker.example` (repo root) so it survives future recreation instead of living only as server state.
- **ufw**: removed the temporary `allow 5174/tcp` rule (v4 + v6). Port 5000 had no explicit allow rule to begin with (ufw default-deny already covered it) — confirmed, not assumed.
- **Docs**: `docs/ARCHITECTURE.md` (new "Deployment Topology" section) and `docs/TECH_STACK.md` (Deployment table rewritten) updated to describe the actual interim topology; `CHANGE_REQUESTS.md` gained CR-033 (raise HSTS after burn-in) and CR-034 (future production-build migration).

## Deferred or Not Implemented

- Raising HSTS `max-age` beyond the initial 300s burn-in value (RC-3) — tracked as CR-033, intentionally not done in this session (needs real elapsed stable time, not just a same-session check).
- Production-build migration (frontend `npm run build`, backend `ASPNETCORE_ENVIRONMENT=Production`) — explicitly out of scope per the approved plan, tracked as CR-034.
- aaPanel panel hardening (port 888, currently open to the whole internet) — explicitly out of scope, not touched.
- Nginx-layer baseline security headers for the Vite-served HTML (architecture review recommendation, non-blocking) — not implemented, candidate for CR-004 work.

## Database Changes

אין.

## Domain Changes

אין.

## API Changes

אין.

## UI Changes

אין.

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Unit | 0 | 0 | לא רלוונטי — פאזה תשתיתית, אין שינוי לוגיקה עסקית |
| Integration | 0 | 0 | לא רלוונטי |
| End-to-End | — | — | אימות ידני מלא בוצע — ראה Manual Validation |

## Manual Validation

בוצע במהלך ההטמעה:
- גלישה מלאה דרך `https://169-58-26-157.sslip.io` (Chrome headless, `lean-chronoscope`): התחברות אמיתית (`manager@clinic.local`), טעינת נתוני לקוחות אמיתיים מה-DB, אפס שגיאות Console — גם לפני וגם אחרי שחזור קונטיינר ה-Postgres (RC-4), לוודא שהחיבור התאושש נכון.
- HTTP→HTTPS redirect (301), תעודת Let's Encrypt תקינה (`SSL certificate verify ok`), HSTS header נוכח.
- `/api/v1/...` דרך ה-proxy chain המלא (Nginx→Vite→backend) — 401 תקין לבקשה לא-מזוהה (מוכיח הגעה תקינה לשרת, לא שגיאת חיבור).
- `/swagger` — 401 בלי הזדהות, 200 עם הזדהות (RC-2 מאומת).
- **בדיקת firewall חיצונית אמיתית** — בוצעה ממחשב המשתמשת (PowerShell, `Test-NetConnection`), לא מהשרת עצמו (בדיקה מהשרת עצמו מול ה-IP הציבורי שלו התבררה כמטעה — התעבורה חוזרת דרך loopback ולא משקפת את חוקי ה-firewall האמיתיים). תוצאה: 5174/5000/5432 חסומים (`TcpTestSucceeded=False`), 22/80/443 פתוחים (`TcpTestSucceeded=True`).
- **אומת ע"י המשתמשת בדפדפן האישי שלה** (2026-07-20): גישה תקינה דרך `https://169-58-26-157.sslip.io/login`. בנוסף התגלה שגישה ישירה דרך ה-IP הגולמי (`https://169.58.26.157/login`) גם היא מגיעה לאפליקציה — הדפדפן הציג אזהרת אי-התאמת תעודה כצפוי (התעודה מונפקת ל-hostname ה-sslip.io, לא ל-IP), כי ה-vhost היחיד ב-nginx עונה לכל בקשה ללא תלות ב-Host/SNI. זו לא חשיפת אבטחה אמיתית (HTTPS מוצפן, JWT עדיין נדרש, האזהרה מסמנת נכון שמשהו לא תואם) אבל תועד כשיפור עתידי — **CR-035**. **אושרה הפאזה ע"י המשתמשת.**

## Code Review

`code-reviewer` (read-only) הריץ על כל הדיף בריפו. תוצאה: **ללא P0/blocker**, תוקן הכל:

- **High**: `server.hmr` ב-`vite.config.ts` היה hardcoded ל-hostname הציבורי ללא תנאי — כל dev מקומי (לא דרך ה-proxy) היה שובר לו את ה-HMR websocket. **תוקן**: ה-hostname עבר ל-`VITE_PUBLIC_HOST`, משתנה סביבה מקומי (`.env.local`, gitignored) שמוגדר רק בשרת הזה; ברירת המחדל של Vite נשמרת לכל dev מקומי אחר. אומת מחדש בדפדפן אחרי התיקון (login + נתונים + אפס שגיאות Console).
- **Medium**: `docker-compose.yml` לא תיעד מאיפה אומת ה-image tag. **תוקן**: נוספה הערה עם פקודת ה-`docker inspect` המקורית.
- **Low**: משתני הסביבה של Postgres לא נאכפו כ-required. **תוקן**: `${VAR:?...}` syntax.
- **Low** (לא נדרש תיקון): hardcoding ה-hostname עצמו ב-`allowedHosts` — קביל, מתועד כמגבלה ידועה (ADR-013-A).

## Security Review

`security-reviewer` (read-only) הריץ על כל הדיף בריפו. **Verdict: Approve — ללא ממצאי Critical/High.**

- אישר שהיגיון ה-CORS/same-origin שריר וקיים (`allowedHosts`/`hmr` לא משפיעים על CORS).
- Basic Auth ל-`/swagger` הוערך כמספיק לפרופיל הסיכון (משטח בדיקות פנימי לקליניקה קטנה, ה-endpoints עצמם עדיין דורשים JWT).
- HSTS `max-age=300` אושר כבחירת ביניים נכונה (RC-3/CR-033).
- אומת: אין סיסמת Postgres אמיתית בשום קובץ בריפו (`docker-compose.yml`/`.env.docker.example` — placeholders בלבד).
- **Low (תוקן)**: קובץ ה-`swagger_htpasswd` ישב תחת `/www/wwwroot` (עץ ה-webroot הקונבנציונלי של aaPanel) — סיכון תיאורטי שvhost אחר יגיש אותו. **תוקן**: הועבר ל-`/www/beautycare-secrets/`, מחוץ לכל עץ web-servable לגמרי (ולא, כפי שנוסה תחילה, מקונן תחת `vhost/` — אותה ספרייה עצמה חסומה ל-www עם `drw-------`).

## Documentation Updated

- `docs/ARCHITECTURE.md` — סעיף "Deployment Topology" חדש.
- `docs/TECH_STACK.md` — טבלת Deployment עודכנה למצב האמיתי.
- `CHANGE_REQUESTS.md` — נוספו CR-033 (העלאת HSTS אחרי burn-in) ו-CR-034 (מעבר עתידי ל-production build).
- `.env.example` / `env.example` — תוקנו ל-`VITE_API_URL` יחסי (RC-1).

## Version

- Version: v0.14.0
- Commit: _(ייקבע)_
- Tag: _(ייקבע)_

## Lessons Learned

- בדיקת firewall חיצונית **חייבת** לבוא ממחשב אחר, לא מהשרת עצמו מול ה-IP הציבורי שלו — תעבורה כזו חוזרת דרך loopback ומטעה (התגלה בזמן ההטמעה).
- Docker מכניס כללי iptables (DOCKER chain) שמוערכים **לפני** ufw — `ufw deny` על פורט שקונטיינר פרסם לא סוגר אותו בפועל; יש לתקן ברמת ה-publish (`-p 127.0.0.1:...`) ולא להסתמך על ufw בלבד.
- כשיש vhost HTTPS יחיד ב-nginx בלי `default_server` מפורש, הוא עונה לכל Host/SNI כולל ה-IP הגולמי — גם אם ה-hostname "הרשמי" הוא היחיד שמתועד/משמש בפועל (CR-035).

## Deferred Requests

- מעבר ל-production build (frontend + backend) — מועמד לפאזה עתידית (CR-034).
- הקשחת aaPanel panel (פורט 888 חשוף לאינטרנט) — לא בהיקף פאזה זו.
- CR-033: העלאת HSTS max-age אחרי burn-in.
- CR-035: חסימת גישה דרך IP גולמי (ללא Host/SNI תואם) ב-nginx.
