# Project Status

## Current State

- Current phase: 013 — Nginx Reverse Proxy + HTTPS Access
- Phase status: Completed
- Current branch: security/comprehensive-audit (off main @ 91c17bd — audit reports + live remediation, not yet merged)
- Latest approved version: v0.14.1
- Latest approved tag: v0.14.1

## Current Activity

**Bug fixes completed (2026-07-20), bundled and released as v0.14.1:**

1. "חיפוש לקוח" screen — "סדרות פעילות" column showed no data (and "יתרת חוב" silently showed
   "שולם" even with a real debt) because `SearchResults.tsx` read unused Phase-1 mock arrays
   instead of live data. Fixed by extending `GET /api/v1/customers` to return
   `activeSeriesCount`/`outstandingBalance` per customer (new `ICustomerRepository.
   GetAggregatesAsync`, no N+1); deleted the now-dead `src/data/series.ts`/`src/data/orders.ts`.
   Resolves FOLLOWUPS.md FU-007.
2. Refinement (same area): a customer with **zero orders at all** now shows "-" in "יתרת חוב"
   (distinct from "שולם", which now means "has orders, fully paid"). `OutstandingBalance` made
   nullable end-to-end (`null` = no orders, `0` = paid off, `>0` = real debt).
3. Customer Card — after any action (payment, note, order) the UI silently jumped back to
   "חבילות פעילות"/"היסטוריית טיפולים", discarding the tab the user was actually on. Fixed in
   `CustomerCard.tsx` via `userSelectedTabRef`/`prevCustomerIdRef`: the CR-007 smart-default tab
   logic now only auto-applies until the user manually picks a tab for the customer currently
   being viewed, and resets correctly on a genuine customer switch.

All three: code-reviewed clean (no Critical/High; Low findings from fix #1 applied). Security
review (fix #1 only, the one touching a financial field) also clean. Backend 238/238, frontend
344/344. User validated in browser and approved. Commit `b618efb`, tag `v0.14.1`, merged to
`main` (fast-forward, `b618efb`) and pushed to `origin` (branch + tag).

**ביקורת אבטחה מקיפה (2026-07-20), ענף `security/comprehensive-audit`:** לבקשת המשתמשת, בוצעה
ביקורת אבטחה בשלושה תחומים — תשתית (`infra-audit` + `server-audit`), פרטיות (תיקון 13), ו-E2E
חי (דרך הדפדפן, עם ניקוי מלא בסוף). ארבעה דוחות נכתבו: `security/INFRA-SECURITY-FINDINGS.md`,
`security/SERVER-HARDENING-FINDINGS.md`, `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`,
`security/E2E-SECURITY-FINDINGS.md`. 14 CRs חדשים נפתחו (CR-036 עד CR-049).

**שני ממצאים דחופים טופלו מיידית באותה הפעלה** (לפני סיום שאר הביקורת, לבקשת המשתמשת): מתקפת
brute-force פעילה על SSH (51,827 ניסיונות כושלים) — `fail2ban` הותקן והופעל; וסיסמת ה-Postgres
האמיתית שהתגלתה חשופה בטקסט גלוי ב-`/var/log/auth.log` — סובבה, אומתה, הבקאנד הופעל מחדש, והלוג
נוקה. שאר הממצאים (כולל 3 נוספים בחומרה קריטית: חשיפת קוד מקור לא-מאומתת דרך Vite dev server,
היעדר מוחלט של גיבויים ל-DB, והיעדר מנגנון מחיקת-לקוחה תקין מול תיקון 13) מתועדים ב-CRs לתוכנית
פעולה עתידית — לא טופלו בהפעלה זו, ממתינים להחלטת המשתמשת על סדר עדיפויות.

Phase 010 הושלם ואושר (v0.10.0). מאז הוטמעו:
- v0.10.1 — customer/settings/treatment-types/package-types data not loading after first login.
- v0.10.2 — יצירת הזמנה (POST /customers/{id}/orders) נכשלה תמיד עם 500 עקב migration drift:
  עמודת TreatmentSeries.CustomerId הייתה קיימת ב-model/snapshot אך מעולם לא נוספה בפועל
  לטבלה בפוסטגרס. תוקן עם migration חדש (כולל backfill), תוקנה שגיאת קומפילציה שחסמה את
  פרויקט הטסטים (FU-015), ונוסף טסט אינטגרציה אמיתי מול Postgres (FU-017).
- v0.11.0 — bundle של CR-031 + ארבעה תיקונים/שיפורים:
  - CR-031: מספור חבילה קבוע (`OrderItem.PackageNumber`) — ActiveSeriesTab/TreatmentHistoryTab
    מציגים אותו #N לאותה חבילה.
  - תיקון: רישום תשלום והוספת/עריכת הערת-לקוח נכשלו תמיד עם 500 (DateTime Kind=Unspecified
    מול עמודת timestamptz) — PaymentsController + NotesController.
  - תיקון: טאב הזמנות ותשלומים לא הציג שם חבילה/תאריך/סכום כולל (התאמת שדות legacy מול
    ה-API האמיתי: orderItems→items, createdDate→orderDate, totalPrice→discountedPrice).
  - תיקון UI: מיקום האינדקס (#N) ליד שם החבילה בטאב היסטוריית טיפולים, מיושר לתבנית הקיימת
    ב-ActiveSeriesTab.
  - פיצ'ר חדש: עריכת הערה ברמת טיפול מטאב היסטוריית טיפולים (PUT /api/v1/treatments/{id}),
    מורשה למבצע הטיפול או Manager בלבד. תמונות ברמת טיפול נשארות out of scope ל-Phase 011
    (in-memory בלבד, ללא API).

כל התיקונים נבדקו (ראה טבלת טסטים בהמשך), אושרו בדפדפן ע"י המשתמשת, ובוצע commit+tag יחיד
ל-main (v0.11.0, נדחף ל-origin/main).

Phase 011 הוצע ואושר ע"י המשתמשת: **Appointments Backend Integration** — חיבור מסך לוח
השנה (שהוקם ב-Phase 006) ל-API אמיתי. עבר pm-spec, architecture review (ADR-011-A — מניעת
double-booking ע"י נעילת שורת ה-User של המטפלת), מימוש מלא (6 endpoints + AvailabilityService +
seed data אמיתי ל-TherapistWorkingHours/Capability), code review ו-security review — כל
הממצאים טופלו (ראה `phases/phase-011/PHASE_SUMMARY.md`).

בהמשך לכך, בבדיקה ידנית עם המשתמשת (2026-07-20) נמצאו ותוקנו שני באגים נוספים:
- **BookAppointmentModal לא רענן חבילות פעילות בפתיחה חוזרת** — הרכיב לא מתפרק בסגירה (רק prop
  `open` משתנה), אז רכישת חבילה חדשה תוך כדי שהמודל סגור לא השתקפה עד רענון מלא של הדף. תוקן
  ע"י תלות ה-effect גם ב-`open`.
- **תור שנקבע ל-12:00 הוצג ב-15:00 בלוח הזמנים** (offset של +3 שעות, UTC+3 ישראל) — הבקאנד סימן
  `StartTime`/`EndTime` כ-`DateTimeKind.Utc` (בלי המרה אמיתית, רק תיוג שגוי) ושמר בעמודת
  `timestamptz`, מה שגרם ל-Postgres לשמור זמן UTC אמיתי. תוקן ע"י מעבר לעמודת
  `timestamp without time zone` + `DateTimeKind.Unspecified` בעקביות, כך שהאחסון תואם בפועל
  את הכוונה המתועדת מראש ("naive local"). כלל עסקי נוסף נוסף באותה הזדמנות, לבקשת המשתמשת:
  קביעת תור מוגבלת לסוגי טיפול שיש ללקוחה בהם חבילה פעילה (נאכף כרגע רק ב-Frontend — CR-032
  לאכיפה גם בבקאנד).

כל התיקונים נבדקו: 200/200 טסטים בבקאנד (כולל אינטגרציה מול Postgres אמיתי), 306/306 בפרונטאנד,
`tsc --noEmit` נקי (מלבד FU-016 הקיים והלא-קשור). המשתמשת בדקה ואישרה בדפדפן, כולל שחזור
התרחיש המדויק של באג ה-timezone לאחר התיקון. אושר commit + merge ל-main (v0.12.0).

Phase 012 הוצע ואושר ע"י המשתמשת: **Therapist Management Backend Integration** — סוגר את
Q4 שנדחה מ-Phase 011 (ניהול שעות עבודה/הסמכות/ימי אי-זמינות למטפלות, שהיו seed-only) ואת
FU-008 (יצירת מטפלת הייתה mock-only ב-frontend). עבר pm-spec, architecture review (6 תיקונים
נדרשים — RC-1 עד RC-6, כולם שולבו: namespace ה-API תחת `/therapists/{userId}/...`, ללא
service class חדש, קונבנציית `Kind=Utc` לתאריכי אי-זמינות, חסימת כניסה למטפלת מבוטלת,
רענון cross-context, תיקון מבנה בקשת יצירת משתמש), מימוש מלא (CRUD לשעות עבודה/הסמכות/
ימי אי-זמינות, `User.IsActive` + deactivate endpoint, חסימת login).

בבדיקה ידנית עם המשתמשת נמצאו ותוקנו שני באגים נוספים מאותה משפחה (race condition בין
context-ים א-סינכרוניים נפרדים):
- **TherapistDetail ריק בטעינה ראשונית** — אפקט הזריעה לא רץ מחדש כשנתוני `TherapistsContext`
  הגיעו אחרי ה-mount הראשוני.
- **"שעות עבודה לא נשמרות" (דיווח המשתמשת)** — אותה משפחת באג בדיוק, אך מול context שני
  ונפרד (`TherapistDataContext`): השמירה בפועל תמיד הצליחה בשרת (אומת ישירות מול ה-DB), אך
  התצוגה ננעלה על מצב "כל הימים חופש" אם `workingHours` עדיין היה ריק ברגע שה-`therapist`
  הראשון כבר נטען. תוקן ע"י המתנה לשני ה-context-ים לפני הזרעת הטופס.

כל התיקונים נבדקו: 232/232 טסטים בבקאנד, 339/339 בפרונטאנד, `tsc --noEmit` נקי (מלבד FU-016).
המשתמשת בדקה ואישרה בדפדפן, כולל שחזור התרחיש המדויק של באג "שעות העבודה" לאחר התיקון.
אושרה הפאזה — ממתין ל-commit + tag (v0.13.0) + merge + push.

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
| 011   | Appointments Backend Integration         | v0.12.0 | Completed |
| 012   | Therapist Management Backend Integration | v0.13.0 | Completed |
| 013   | Nginx Reverse Proxy + HTTPS Access       | v0.14.0 | Completed |

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
- CR-030: Batch package type lookup in CustomerOrdersController.Create
- CR-032: Server-side enforcement of active-package booking eligibility (Phase 011)
- CR-033: Raise HSTS max-age after burn-in (Phase 013)
- CR-034: Production-build migration — frontend build + backend Production env (Phase 013)
- CR-035: Reject HTTPS requests to the raw server IP / no matching default_server (Phase 013)
- CR-036: SSH hardening — disable password auth + root login (security audit, Critical)
- CR-037: Close unnecessary open ports — aaPanel panel 888, port 25664, dead FTP rules (security audit, High)
- CR-038: Vite dev server exposes full repo source via `/@fs/`, bypasses `/swagger` auth (security audit, Critical)
- CR-039: Nginx edge hardening — security headers, dot-file blocking, nginx_status, default-site (security audit, Medium)
- CR-040: No backup mechanism for production Postgres data (security audit, Critical)
- CR-041: No MFA for any authenticated role (security audit, High)
- CR-042: No audit-logging mechanism; also closes CR-029's IDOR-class gap (security audit, High)
- CR-043: No data-subject deletion/anonymization mechanism, Sec 14 (security audit, Critical)
- CR-044: No consolidated data-subject access/export endpoint, Sec 13 (security audit, Medium)
- CR-045: No consent/privacy-notice mechanism at customer intake, Sec 11 (security audit, Medium)
- CR-046: Incident-response runbook + docs-vs-reality drift on bind-to-loopback (security audit, Medium)
- CR-047: Data retention policy undefined (security audit, Low)
- CR-048: Postgres data not encrypted at rest (security audit, Low)
- CR-049: Customer search query logged to console with PII when VITE_LOG_API_CALLS is on (security audit, Low)

## Known Risks or Accepted Findings

- H2 (Security): JWT stored in localStorage — deferred to Phase 9+ (CR-012, refresh tokens + HttpOnly cookies)
- M4/M5: Kestrel + Vite bound to 0.0.0.0 in dev — required for current remote-access dev setup
- Active-package booking eligibility enforced client-side only, not by the API — deferred (CR-032)
- Comprehensive security audit (2026-07-20, `security/comprehensive-audit` branch) found the system has
  no per-therapist data scoping (any authenticated Therapist can read any customer's full financial
  history — CR-042), no MFA (CR-041), no audit logging (CR-042), no backups (CR-040), and no working
  data-subject deletion path under Amendment 13 (CR-043) — see `privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`
  and `security/E2E-SECURITY-FINDINGS.md` for full evidence. Not yet remediated — awaiting prioritization.

## Next Step

Phase 013 (Nginx Reverse Proxy + HTTPS Access) **הושלמה במלואה** — commit (`25bfa88`,
`04bd99c`) ו-tag (`v0.14.0`) בוצעו, מוזג ל-`main` (fast-forward, `04bd99c`) ונדחף ל-`origin`
(branch + tag). האפליקציה נגישה כעת דרך `https://169-58-26-157.sslip.io` בלבד (dev servers
הישנים חסומים חיצונית). ראה `phases/phase-013/PHASE_SUMMARY.md` לפירוט מלא.

הפאזה הבאה טרם הוצעה — ממתין לבקשת המשתמשת (`Propose the next phase`). מועמדים טבעיים
מתוך ה-CRs הפתוחים: CR-013/CR-014 (production CORS + HTTPS hardening בקוד עצמו, חופפים
חלקית למה שכבר נסגר ב-Phase 013 ברמת התשתית), CR-032 (אכיפת זכאות חבילה פעילה בבקאנד),
או CR-034 (מעבר ל-production build) כהמשך ישיר לעבודת Phase 013.

המשתמשת אימתה בדפדפן האישי שלה (2026-07-20) — כולל גישה גם דרך ה-hostname (sslip.io) וגם
דרך ה-IP הגולמי; הגישה דרך ה-IP הראתה אזהרת אי-התאמת תעודה כצפוי (תועד כ-CR-035, לא חוסם).
**הפאזה אושרה, בוצע commit + tag** (`25bfa88` / `v0.14.0`) על ענף
`feature/phase-013-nginx-https-access`. טרם בוצע push ל-origin ו/או merge ל-main — ממתין
להנחיית המשתמשת.
