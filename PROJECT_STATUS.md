# Project Status

## Current State

- Current phase: 010 — Treatment Recording & Notes
- Phase status: Completed
- Current branch: main
- Latest approved version: v0.11.0
- Latest approved tag: v0.11.0

## Current Activity

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
ל-main. מוכן להצעת Phase 011 (תמונות טיפול + Appointments backend + CR-019/CR-012 וכו').

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

Phase 010 הושלם (v0.10.2 patches applied). מוכן להצעת Phase 011.
