# Phase 008 — Frontend-Backend Integration

## Status

Implementation

## Goal

חיבור ה-Frontend הקיים (Phases 1–6) לב-Backend האמיתי (Phase 7). החלפת כל ה-mock data ב-API calls אמיתיים עבור: Auth, Customers, TreatmentTypes, Users, GlobalSettings.

## Planned

### Backend (CR-015)
- תיקון Customer search — escaping של `%`, `_`, `\` בפרמטר החיפוש לפני ILike

### Frontend — Auth
- דף Login חדש בנתיב `/login` (email + password, RTL, Hebrew)
- `AuthContext` — מצב אימות גלובלי (currentUser, token, login, logout)
- `TokenManager` — שמירת JWT ב-localStorage עם expiry tracking
- `authService` — `login()`, `logout()`, `getCurrentUser()` (קורא `/auth/me`)
- `PrivateRoute` — wrapper לנתיבים מאומתים
- שדרוג Header — הסרת dev user switcher, הצגת fullName + כפתור logout
- הפניה אוטומטית: 401 → logout → `/login`

### Frontend — API Layer
- `src/api/apiClient.ts` — HTTP client עם Bearer header injection ו-error mapping
- `src/api/apiError.ts` — טיפוס שגיאה אחיד
- `src/api/tokenManager.ts` — localStorage token management
- משתני סביבה: `VITE_API_URL` ב-`.env.example`

### Frontend — Wire-up
- Customers: GET list + search, POST, PUT (Manager), DELETE (Manager)
- TreatmentTypes: GET list, POST, PUT, DELETE (Manager)
- Users: GET list, POST, PUT, DELETE (Manager only)
- GlobalSettings: GET, PUT (Manager only)
- Loading skeletons בכל רשימה
- Error toasts בעברית לכל קוד שגיאה (401, 403, 404, 409, 429, 5xx, network)

### CR-011 — fullName reconciliation
- החלפת `firstName`/`lastName` ב-`fullName` בכל ה-Frontend types, forms ו-displays

## Out of Scope

- Orders, Payments, TreatmentSeries, Treatments, Notes, Photos — API טרם קיים
- Appointments — Phase 9+
- TherapistWorkingHours / Capabilities / PackageTypes — Phase 9+
- Refresh tokens — Phase 9+ (CR-012)
- Password reset UI — Phase 9+
- HTTPS / HSTS — Phase 11 (CR-014)
- 2FA / MFA — Phase 12+

## Open Questions

| שאלה | המלצה |
|------|-------|
| Auto-retry על 5xx? | Retry פעם אחת; אל תנסה שוב על 4xx |
| Mock fallback כשה-backend ירד? | לא — שגיאה בלבד; אין fallback ל-mock |
| Session timeout על חוסר פעילות? | Phase 9+ עם refresh tokens |
| URL בפרודקשן? | Phase 11 — נקבע ב-appsettings per environment |

## Acceptance Criteria

### Auth
- [ ] ניתן לנווט ל-`/login` ללא token
- [ ] כניסה עם credentials תקינים → token ב-localStorage → redirect ל-`/search`
- [ ] ריענון עמוד לא מחייב כניסה מחדש (token קיים + `/auth/me` שקט)
- [ ] Logout → מחיקת token → redirect ל-`/login`
- [ ] credentials שגויים → toast שגיאה בעברית
- [ ] 401 מכל API call → logout אוטומטי → `/login`

### Customers
- [ ] רשימת לקוחות טוענת מהשרת (לא mock)
- [ ] חיפוש קורא `?search=term` ל-API
- [ ] יצירת לקוח → POST → מופיע ברשימה
- [ ] Manager יכול לערוך ולמחוק לקוח
- [ ] Therapist לא רואה כפתורי עריכה/מחיקה
- [ ] מחיקת לקוח עם נתונים קשורים → toast 409

### TreatmentTypes
- [ ] רשימת טיפולים טוענת מהשרת
- [ ] Manager: יצירה, עריכה, מחיקה דרך API
- [ ] Therapist אינו יכול לגשת לעמוד ניהול טיפולים

### Users
- [ ] Manager: רשימת משתמשים מהשרת
- [ ] Manager: יצירה, עריכה, מחיקה דרך API
- [ ] Manager לא יכול למחוק את עצמו (שגיאה מהשרת)
- [ ] Therapist אינו יכול לגשת לעמוד ניהול משתמשים

### Global Settings
- [ ] ערכי הגדרות טוענים מהשרת
- [ ] Manager יכול לעדכן הגדרה דרך API
- [ ] Therapist אינו יכול לגשת לעמוד הגדרות

### UI & Types
- [ ] Header מציג `fullName` (לא firstName/lastName)
- [ ] כל הטפסים עם שדה `fullName` יחיד
- [ ] `tsc --noEmit` עובר ללא שגיאות
- [ ] `npm run build` עובר ללא שגיאות
- [ ] RTL + Hebrew נשמרים בדף Login ובכל העמודים

### Error Handling
- [ ] Network error → toast "קשר אינו יציב"
- [ ] 403 → toast "אין לך הרשאה לפעולה זו"
- [ ] 404 → toast "הפריט לא קיים"
- [ ] 409 → toast עם הודעת השרת
- [ ] 429 → toast "חשבון נעול"

## Architecture Review

**סטטוס:** הושלם — ממתין לאישור משתמש

### מה אושר

- `apiClient` / `tokenManager` / `authService` — ארכיטקטורה נכונה ומתאימה
- `AuthContext` + `PrivateRoute` + React Router v6 — pattern קנוני, עובד עם `RoleGuard` הקיים
- CORS backend — קונפיגורציה נכונה ל-`localhost:5173`
- CR-015 escaping — גישה נכונה

### תיקונים נדרשים (RC)

**RC-1 — TreatmentType.DefaultDurationMinutes חסר בBackend**
החלטה: **הוסף לBackend** — עמודה nullable + migration + DTO

**RC-2 — User.Phone חסר בBackend**
החלטה: **הוסף לBackend** — עמודה nullable + migration + DTO + Create/UpdateUserRequest

**RC-3 — GlobalSettings: calendarStartHour/calendarEndHour חסרים בBackend**
החלטה: **הוסף לBackend** — `calendar_start_hour` + `calendar_end_hour` ל-KnownKeys + seed + mapping בFrontend

**RC-4 — CR-011 fullName scope מורחב**
יש לכלול: מחיקת name-splitting ב-`buildCustomer`, עדכון initials ב-`CustomerCardHeader`, עדכון כל ה-tests, collapse שני שדות בטפסים לשדה `fullName` יחיד

**RC-5 — CR-015 סדר escaping**
חובה לסדר: `\` ← `%` ← `_`, ועם ESCAPE clause: `ILike(pattern, "\\\\")`

**RC-6 — Header.tsx imports mock therapists**
להסיר import chain של `therapists` מ-`Header.tsx` ו-`App.tsx` במפורש

### המלצות שאומצו

- R-2: 401 → navigate to `/login` עם שמירת `location.state.from` — יממש ב-`apiClient` (חנק יחיד)
- R-4: `loading` + `error` בכל context — חובה למנוע blank render
- R-5: `initializing` flag ב-`AuthContext` — מונע redirect מוקדם לפני `/auth/me` חוזר
- R-8: `AuthProvider` חייב להיות בתוך `<BrowserRouter>` כדי לאפשר `useNavigate`

### ADRs נדרשים

- **ADR-008a**: Frontend Authentication Strategy (localStorage JWT, /auth/me hydration, 401 auto-logout)
- **ADR-008b**: Data Model Migration — fullName rename (CR-011)

### סיכום שינויים לסקופ

ה-Architecture Review מוסיף לסקופ Phase 008:
- Backend migration עם 3 שדות חדשים: `TreatmentType.DefaultDurationMinutes`, `User.Phone`, `calendar_start_hour`/`calendar_end_hour` ב-GlobalSettings seed

## Status

Approved — Pending Commit

## Implemented

כל הפריטים מה-Planned הושלמו.

## Deferred or Not Implemented

כמוגדר ב-Out of Scope.

## Database Changes

Migration `Phase008Changes` (EF Core 10):
- `TreatmentTypes.DefaultDurationMinutes` — `int?` nullable column
- `Users.Phone` — `nvarchar(50)?` nullable column

GlobalSettings seed (no migration): `calendar_start_hour = "8"`, `calendar_end_hour = "20"`

## Backend Changes

- CR-015: `CustomerRepository.SearchAsync` — escaping `\`, `%`, `_` לפני ILike (סדר חובה: `\` ראשון) + ESCAPE clause
- RC-1: `TreatmentType.DefaultDurationMinutes` (int?) + DTO + migration + seed
- RC-2: `User.Phone` (string?) + AuthDto/UserDtos + migration + seed
- RC-3: `calendar_start_hour` + `calendar_end_hour` ב-`GlobalSettingsKeys.KnownKeys` + seed

## API Changes

אין endpoints חדשים. Wire-up לכל endpoints קיימים.

## UI Changes

- `src/features/auth/LoginPage.tsx` — דף Login חדש (RTL Hebrew, `/login`)
- `src/contexts/AuthContext.tsx` — מצב אימות גלובלי
- `src/api/` — 9 קבצים (apiClient, tokenManager, apiError, authApi, customersApi, treatmentTypesApi, usersApi, globalSettingsApi, index)
- `src/components/shared/PrivateRoute.tsx` — Outlet wrapper
- `src/components/shared/Header.tsx` — ללא user switcher, עם logout
- Loading skeletons + error states ב-SearchScreen
- CR-011: fullName בכל הטפסים, displays, types, ו-mock data

## Automated Tests

| Test Type | Files | Passed | Failed | Notes |
|-----------|------:|-------:|-------:|-------|
| Unit (frontend) | 13 | 252 | 0 | כולל fetch mock ב-setup.ts |
| Unit (backend) | — | 58 | 0 | xUnit, InMemory DB |
| Integration | 0 | — | — | Phase 9+ |
| End-to-End | 0 | — | — | Manual בלבד |

## Manual Validation

אושר על ידי המשתמש ב-2026-07-17. כניסה עם manager + therapist עברו בהצלחה. כל המסכים נטענים מהשרת.

## Code Review

**ממצאים:** 1 P0, 5 P1, 7 P2, 6 P3.

תוקנו לפני commit: P0 (GlobalSettingsController upsert guard), כל P1 (tokenManager expiry, apiClient 401 dispatch, AuthController int.Parse, AuthContext redirect, seed password). TreatmentTypeRepository ILike escaping (P2), GlobalSettingsController bulk-update transaction (P2).

דחוי לCR-025: שאר P2/P3 items.

## Security Review

**ממצאים:** 0 Critical, 4 High, 8 Medium, 7 Low.

תוקנו לפני commit: H1 (JWT ValidAlgorithms pinned to HS256), H3 (seed password הוסר מgit), H4 (Cache-Control: no-store על auth endpoints), M2 (explicit lockout config), L1 (password removed from API logs).

ממצאים מאושרים ודחויים: H2 (localStorage JWT) → CR-012 (Phase 9+); CR-022 (user enumeration timing); CR-023 (first-login password change); CR-024 (GlobalSettings race); M1/CR-017 (PII in JWT); M4/M5 (0.0.0.0 binding — נדרש לסביבת dev נוכחית).

## Documentation Updated

- `docs/ARCHITECTURE.md` — Frontend structure (Phase 8), API Layer Pattern, State Management table
- `docs/UI.md` — Login screen added, Global Settings updated
- `CHANGE_REQUESTS.md` — CR-008, CR-011, CR-015 closed; Completed section populated

## Version

- Version: v0.8.0
- Commit: —
- Tag: —

## Lessons Learned

- AuthContext requires `<BrowserRouter>` as ancestor (uses `useNavigate`); AuthProvider must sit inside BrowserRouter and outside all other providers.
- Global `fetch` mock in `vitest.config.ts` setup file is the cleanest way to isolate API-wired contexts in unit tests — each context's `useEffect` fires but hits the mock instead of the network.
- CR-011 scope was broader than initially estimated: name-splitting in `buildCustomer`, initials in `CustomerCardHeader`, and 8 display components across appointment/customer feature modules all needed updating.

## Deferred Requests

- CR-012: Refresh tokens — Phase 9+
- CR-013: Production CORS policy — Phase 11
- CR-014: HTTPS/HSTS — Phase 11
- CR-016: JWT typed options — Phase 9+
- CR-017: PII in JWT — Phase 9+
- CR-018: RemainingBalance computed — Phase 9+
- CR-019: DateTime → DateTimeOffset — Phase 9+
- CR-020: AuthController use IUserRepository — Phase 9+
- CR-021: DomainConflictException — Phase 9+
- CR-022: User enumeration timing — Phase 9+
- CR-023: First-login password change — Phase 9+
- CR-024: GlobalSettings unique constraint — Phase 9+
- CR-025: Phase 008 P2/P3 code quality — Phase 9+
