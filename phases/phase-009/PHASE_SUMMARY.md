# Phase 009 — Orders, Series & Payments

## Status

Approved — Pending Commit

## Goal

חשיפת ליבת הפעילות העסקית: מכירת חבילות טיפולים ורישום תשלומים. חיבור ה-Frontend לב-Backend עבור **PackageType**, **CustomerOrder**, **OrderItem**, **TreatmentSeries**, **Payment**. יצירת סדרת טיפולים אוטומטית מהזמנה מסוג "series", ורישום תשלומים עם עדכון יתרה אטומי.

## Planned

### Backend — REST resources

**PackageType** — Manager CRUD, כולם קוראים
- `GET /api/v1/package-types` — רשימה (Auth)
- `GET /api/v1/package-types/{id}` — יחיד (Auth)
- `POST /api/v1/package-types` — Manager
- `PUT /api/v1/package-types/{id}` — Manager
- `DELETE /api/v1/package-types/{id}` — Manager (409 אם קיים `OrderItem` שמצביע אליו)
- מודל חדש בדומיין: `PackageType.Price` (decimal) — חסר כרגע

**CustomerOrder**
- `GET /api/v1/customers/{customerId}/orders` — רשימה
- `GET /api/v1/orders/{id}` — יחיד (כולל items, series, payments)
- `POST /api/v1/customers/{customerId}/orders` — יצירה (nested items)
- `PUT /api/v1/orders/{id}` — Manager (עדכון `discountPercentage`, `maxPaymentCount` בלבד)
- `DELETE /api/v1/orders/{id}` — Manager (409 אם קיים Payment או Treatment תלוי)

**OrderItem**
- אין endpoint נפרד. נוצרים ב-POST של Order.

**TreatmentSeries** — read-only מבחוץ
- `GET /api/v1/customers/{customerId}/treatment-series?active=true` — סדרות פעילות
- `GET /api/v1/treatment-series/{id}` — יחיד

**Payment**
- `GET /api/v1/orders/{orderId}/payments` — רשימה
- `POST /api/v1/orders/{orderId}/payments` — יצירה
- אין PUT/DELETE (per Domain: תשלומים לא ניתנים לעריכה לאחר שמירה)

### Backend — business logic

**יצירת CustomerOrder**
- חישוב `originalPrice` = סכום `PackageType.Price` על פני items
- חישוב `discountedPrice` = `originalPrice * (1 - discountPercentage/100)`
- `maxPaymentCount` = ערך מהבקשה אם קיים, אחרת `default_max_payment_count` מ-GlobalSettings
- `amountPaid = 0`
- `remainingBalance = discountedPrice` (או computed — ראה CR-018)
- לכל OrderItem שבו `PackageType.IsSeries = true` — יצירת `TreatmentSeries`:
  - כמות: `totalTreatments = PackageType.TreatmentCount`, `completedTreatments = 0`
  - טיימר: `totalMinutes = PackageType.TreatmentCount * PackageType.MinutesPerTreatment`, `usedMinutes = 0`
- הכל בטרנזקציה אחת

**רישום Payment**
- דחה אם `amount <= 0` → 422
- דחה אם `amount > remainingBalance` → 422
- דחה אם מספר תשלומים קיימים ≥ `maxPaymentCount` → 409
- עדכן `amountPaid += amount`, ו-`remainingBalance` (או תלוי בהחלטת CR-018)
- הכל בטרנזקציה אחת

**מחיקת CustomerOrder**
- 409 אם קיים Payment תלוי
- 409 אם קיים Treatment שמצביע ל-Series של ה-Order

### Backend — CR closures

- **CR-018** (RemainingBalance computed) — ראה Open Questions Q1
- **CR-021** (DomainConflictException) — הוספת typed exception; `ExceptionHandlingMiddleware` תופס אותו במפורש; הסרת `.Contains("CONFLICT")`
- **CR-025 (חלקית)**:
  - `globalSettingsApi.updateSetting` return type → `Promise<GlobalSettingDto>` (לא array)
  - `AuthController` / `UsersController` — קריאה ל-claims דרך `ICurrentUserService` (יצירה אם חסר)

### Frontend — API layer

- `src/api/packageTypesApi.ts`
- `src/api/customerOrdersApi.ts`
- `src/api/paymentsApi.ts`
- `src/api/treatmentSeriesApi.ts`
- עדכון `src/api/index.ts` barrel

### Frontend — wire-up (mock → API)

- **New Order** (`src/features/order/`) → POST `/customers/{id}/orders`
- **Record Payment** (`src/features/payment/`) → POST `/orders/{id}/payments`
- **Customer Card → Active Series tab** → GET `/customers/{id}/treatment-series?active=true`
- **Customer Card → Treatment History tab** — הצגת Orders + Payments בלבד (Treatments נשארים mock, יטופלו ב-Phase 010)
- **Manager — Package Types admin** (`src/features/packages/`) — CRUD מלא, אותו pattern כמו TreatmentTypes admin
- Loading skeletons + Hebrew error toasts באותו pattern של Phase 008

### Frontend — types reconciliation

לזיהוי בזמן implementation:
- `src/types/Order.ts` — `totalPrice`, `createdDate`, `createdByUserId` לא קיימים בדומיין. יוחלפו ב-`originalPrice`, `discountedPrice`, `orderDate`
- `src/types/Payment.ts` — `createdDate`, `createdByUserId` לא קיימים בדומיין. יוחלפו ב-`paymentDate`
- `PackageType` — הוספת שדה `price` (חסר בדומיין הנוכחי)

## Out of Scope

- **Treatments recording** (רישום ביצוע טיפול על סדרה) — Phase 010
- **Notes API** ו-Notes UI wire-up — Phase 010
- **Photos API** — Phase 011 (דורש החלטת אחסון קבצים)
- **Appointments backend** — Phase 011 (Calendar נשאר mock)
- **Refresh tokens** (CR-012) — Phase 11+
- **Payment method enum enforcement** — מקבלים string חופשי כרגע
- **Payment reversal / refund** — לא בסקופ
- **Order cancellation** (בניגוד למחיקה) — Phase 010+
- **דוחות פיננסיים / סיכומי הכנסות** — Phase 12+

## Resolved Decisions

- **Q1 (CR-018)**: `RemainingBalance` = PostgreSQL `GENERATED ALWAYS AS (discounted_price - amount_paid) STORED`. EF Core mapping: `.ValueGeneratedOnAddOrUpdate()`.
- **Q2**: כל שדות הכסף — `DECIMAL(10, 2)`.
- **Q3**: `POST /orders/{id}/payments` מחזיר `PaymentDto` בלבד. Frontend מרענן Order בקריאה נפרדת.
- **Q4**: `PackageType.Price` (מחיר קטלוג) + `OrderItem.UnitPrice` (snapshot בהזמנה). שינוי מחיר לא משפיע רטרואקטיבית.
- **Q5**: אין `quantity` ב-`OrderItem`. row לכל PackageType נרכש.

## Risks

- **Financial calculation drift** — חובה `decimal` (לא `float`/`double`) בכל שרשרת החישוב. Postgres `numeric`, C# `decimal`, JSON `string` בהעברה כדי למנוע דיוק כפול-float.
- **Concurrent payments race** — שני תשלומים במקביל יכולים לחצות את `maxPaymentCount` או `remainingBalance`. פתרון: טרנזקציה + row-level lock (`SELECT ... FOR UPDATE`) על ה-Order בזמן INSERT ל-Payment.
- **Series creation atomicity** — כשל אמצע יצירת Order → Items → Series → יוצר הזמנה בלי סדרות. חובה טרנזקציה אחת סביב כל התהליך.
- **Delete cascades** — מחיקת PackageType/Order בלי בדיקת FK תיצור fail חסר-מובן. חובה בדיקת existence מפורשת + 409 עם הודעה בעברית.
- **Frontend Types migration** — שינוי `Order`/`Payment` types יכול לשבור imports רבים. חיפוש-והחלפה קפדני בכל `src/features/order/`, `src/features/payment/`, tests.

## Dependencies

- Phase 008 auth infrastructure (JWT, `apiClient`, `AuthContext`)
- Phase 008 error handling pattern (Hebrew toasts, error codes)
- Phase 008 UI pattern (loading skeletons, RTL forms)
- Backend Domain entities מ-Phase 007 (קיימים; רק מוסיפים repositories + controllers + DTOs)
- `GlobalSettings.default_max_payment_count` (קיים; ישמש כברירת מחדל)

## Testing Strategy

**Backend Unit (xUnit + InMemory DB)**
- `CustomerOrderService.CreateAsync` — יוצר Order + Items + Series בהתאם ל-`is_series`
- `CustomerOrderService.CreateAsync` — חישוב `discountedPrice` נכון עם discount שונים
- `PaymentService.CreateAsync` — דוחה `amount > remainingBalance`
- `PaymentService.CreateAsync` — דוחה כשמספר תשלומים ≥ `maxPaymentCount`
- `PaymentService.CreateAsync` — מעדכן `amountPaid` ו-`remainingBalance` באטומיות
- `CustomerOrderService.DeleteAsync` — מחזיר 409 (`DomainConflictException`) כשקיים Payment/Treatment
- `PackageTypeRepository.ExistsByNameAsync` — ILike escaping (אותו pattern כ-CustomerRepository)

**Frontend Unit (Vitest + fetch mock)**
- כל API module — mapping נכון של DTO ↔ Type
- `useOrder` / `usePayment` hooks — טיפול בשגיאות 409/422/404
- `NewOrderScreen` — חישוב `discountedPrice` תואם לשרת (client-side preview)
- `RecordPaymentScreen` — validation שגיאות (סכום שלילי, מעל היתרה)

**Integration** — לא בסקופ Phase 009.
**E2E** — Manual בלבד.

## Acceptance Criteria

### Backend — PackageType
- [ ] `GET /package-types` מחזיר את כל החבילות (מאומת בלבד)
- [ ] Manager יכול ליצור/לעדכן/למחוק PackageType דרך API
- [ ] Therapist מקבל 403 על יצירה/עריכה/מחיקה
- [ ] מחיקת PackageType עם `OrderItem` תלוי → 409 עם הודעה בעברית
- [ ] `PackageType.Price` נוסף לדומיין ו-DTO
- [ ] Validation: `is_timer_based=true` דורש `is_series=true` ו-`minutes_per_treatment > 0`

### Backend — CustomerOrder
- [ ] `POST /customers/{id}/orders` יוצר Order + Items + Series בטרנזקציה אחת
- [ ] יצירת Order של package `is_series=true` יוצרת TreatmentSeries תואמת
- [ ] `discountedPrice` מחושב נכון מ-`originalPrice` ו-`discountPercentage`
- [ ] `maxPaymentCount` = ערך בקשה, או `default_max_payment_count`
- [ ] Manager יכול לעדכן discount/maxPaymentCount
- [ ] Manager יכול למחוק Order שאין לו תשלומים/טיפולים
- [ ] מחיקת Order עם Payment קיים → 409
- [ ] מחיקת Order עם Treatment שמצביע ל-Series שלו → 409

### Backend — Payment
- [ ] `POST /orders/{id}/payments` יוצר Payment ומעדכן `amountPaid`/`remainingBalance`
- [ ] `amount <= 0` → 422 VALIDATION_ERROR
- [ ] `amount > remainingBalance` → 422 VALIDATION_ERROR
- [ ] מספר תשלומים קיים ≥ `maxPaymentCount` → 409 CONFLICT
- [ ] תשלומים מקבילים לא יוצרים race condition (row-level lock)
- [ ] אין endpoint לעדכן/למחוק תשלום

### Backend — TreatmentSeries
- [ ] `GET /customers/{id}/treatment-series?active=true` מחזיר רק סדרות פעילות
- [ ] סדרת quantity מוגדרת "פעילה" כש-`completedTreatments < totalTreatments`
- [ ] סדרת timer מוגדרת "פעילה" כש-`usedMinutes < totalMinutes`
- [ ] אין endpoint ליצור/לעדכן/למחוק ידנית

### Backend — CRs
- [ ] `DomainConflictException` — typed exception נוצר; middleware תופס במפורש (CR-021)
- [ ] `RemainingBalance` — GENERATED column או computed EF property (CR-018) — לפי החלטת Q1
- [ ] `globalSettingsApi.updateSetting` return type = `Promise<GlobalSettingDto>` (CR-025)
- [ ] `AuthController`/`UsersController` משתמשים ב-`ICurrentUserService` (CR-025)

### Frontend — Orders
- [ ] מסך "New Order" קורא מהשרת (`packageTypesApi.list`) — לא mock
- [ ] יצירת Order → POST → מופיע ב-Customer Card
- [ ] חישוב `discountedPrice` בצד הלקוח תואם לשרת (client preview)
- [ ] Manager יכול לערוך/למחוק Order מ-Customer Card
- [ ] Therapist לא רואה כפתורי עריכה/מחיקת Order

### Frontend — Payments
- [ ] מסך "Record Payment" מציג יתרה נוכחית מ-API
- [ ] רישום Payment → POST → יתרה מתעדכנת ב-UI
- [ ] סכום שלילי / מעל היתרה → toast validation בעברית
- [ ] מספר תשלומים חורג → toast 409 בעברית

### Frontend — TreatmentSeries
- [ ] Customer Card → טאב "סדרות פעילות" קורא מהשרת (לא mock)
- [ ] טאב מציג נכון סדרות quantity (`X/Y טיפולים`) וטיימר (`X/Y דקות`)
- [ ] סדרה מלאה (completed = total) לא מופיעה בטאב "פעילות"

### Frontend — PackageType admin
- [ ] Manager: רשימת PackageTypes מהשרת
- [ ] Manager: יצירה/עריכה/מחיקה דרך API
- [ ] Manager: עריכת מחיר, סוג חבילה, כמות טיפולים
- [ ] Therapist אינו יכול לגשת לעמוד ניהול חבילות

### UI & Types
- [ ] `tsc --noEmit` עובר ללא שגיאות
- [ ] `npm run build` עובר ללא שגיאות
- [ ] `src/types/Order.ts` ו-`Payment.ts` מותאמים לדומיין (הסרת `createdByUserId`, `totalPrice`)
- [ ] RTL + Hebrew נשמרים בכל המסכים החדשים
- [ ] Loading skeletons בכל רשימה חדשה

### Error Handling
- [ ] Network error → toast "קשר אינו יציב"
- [ ] 403 → toast "אין לך הרשאה לפעולה זו"
- [ ] 404 → toast "הפריט לא קיים"
- [ ] 409 → toast עם הודעת השרת בעברית (למשל: "לא ניתן למחוק — קיימים תשלומים")
- [ ] 422 → toast עם פירוט השגיאה (סכום לא תקין וכו')

## Architecture Review

**סטטוס:** הושלם — ממתין לאישור משתמש

### מה אושר

- REST layout — nested `POST /customers/{customerId}/orders`, `POST /orders/{orderId}/payments`, flat `GET /orders/{id}` — תואם pattern של Phase 008 ו-API_SPECIFICATION.
- Q4 (catalog `PackageType.Price` + snapshot `OrderItem.UnitPrice`) — invariant נכון. הזמנות היסטוריות לא יזוזו כשמחיר קטלוג משתנה.
- Q5 (אין `quantity` ב-`OrderItem`) — תואם ERD (1:1 `ORDER_ITEM → TREATMENT_SERIES`).
- Q3 (POST payment מחזיר `PaymentDto` בלבד) — תואם single-resource REST convention של Phase 008.
- Transaction scope ליצירת Order + Items + Series — נדרש וזוהה נכון.
- CR-021 typed exception + explicit middleware catch — תיקון נכון; מסיר את `.Contains("CONFLICT")` ב-`ExceptionHandlingMiddleware.cs:40`.
- `PackageType.Price` לדומיין — נדרש; ה-Frontend כבר מחזיק `price` (`src/types/PackageType.ts:5`) אבל הדומיין לא.

### תיקונים נדרשים (RC)

**RC-1 — Q1 GENERATED column לא תואם InMemory test provider**
`GENERATED ALWAYS AS ... STORED` דורש PostgreSQL. הטסטים משתמשים ב-`Microsoft.EntityFrameworkCore.InMemory` שמתעלם מ-computed SQL. טסטים של "מעדכן `remainingBalance` באטומיות" יעברו false-positive.
**החלטה:** לשמר Q1 (GENERATED STORED דרך `HasComputedColumnSql("discounted_price - amount_paid", stored: true)`) + `.ValueGeneratedOnAddOrUpdate()` + `[DatabaseGenerated(Computed)]`. ב-service layer: לא לכתוב `RemainingBalance` ב-C#; אחרי `SaveChangesAsync()` — `Entry(order).ReloadAsync()`. חובה **integration test אחד לפחות מול Postgres אמיתי** (Testcontainers) עבור `remaining_balance` — InMemory לא מספיק כיסוי ל-CR-018.

**RC-2 — Race על תשלומים מקבילים: `SELECT FOR UPDATE` דורש raw SQL ב-EF Core + Npgsql**
EF Core לא נותן pessimistic-lock API. חובה `_context.Database.SqlQueryRaw<Guid>("SELECT id FROM \"CustomerOrders\" WHERE id = {0} FOR UPDATE", orderId).ToListAsync()` בתוך אותה טרנזקציה, לפני קריאת ה-Order.
**החלטה:** `Database.BeginTransactionAsync(IsolationLevel.ReadCommitted)` + raw `FOR UPDATE` על שורת ה-Order, ואז קריאה + count תשלומים + INSERT + save. לא `SERIALIZABLE` — retry semantics מסובכים ו-middleware לא מטפל ב-serialization failures. תיעוד ב-code comment על `PaymentService.CreateAsync`.

**RC-3 — `paymentCount` חסר מה-DTO של Order**
Frontend `CustomerOrder.paymentCount` (`src/types/Order.ts:17`) בשימוש ב-`OrdersTab.tsx:53` כדי להשבית כפתור "Record Payment" כשהוא ≥ `maxPaymentCount`. התוכנית לא מציינת איך המספר מגיע ללקוח.
**החלטה:** להוסיף `paymentCount: int` ל-`OrderDto`, computed server-side ב-read query (aggregation cheap; N+1 אם עומסים payments). Load-bearing acceptance criterion.

**RC-4 — `createdByUserId` על Payment הוא audit trail בשימוש UI — לא type debt**
`PaymentsTab.tsx:31` מציג "נרשם ע"י {therapist.fullName}". התוכנית מציעה למחוק את השדה. זו רגרסיה של audit trail עסקי אמיתי (Manager בודק Therapist).
**החלטה:** לא למחוק. להוסיף `RecordedByUserId (Guid)` + `RecordedByFullName (string)` ל-Payment entity + DTO. הערך מגיע מ-`ICurrentUserService.GetCurrentUserId()` ב-POST (never trust client — CR-008). Order-side audit נשאר deferred (CR חדש בעתיד; לא מרחיב סקופ עכשיו).

**RC-5 — Discount UI לא קיים ב-Frontend**
`src/features/order/NewOrderModal.tsx` לא כולל שדה `discountPercentage`. חישוב server-side בלי UI = המנהל לא יכול להשתמש בפיצ'ר.
**החלטה:** להוסיף input "אחוז הנחה" (0–100, decimal) ב-`NewOrderModal` — Manager-only (`RoleGuard`). Therapist יוצר עם `discountPercentage = 0`. Client-side preview עם `toCents/fromCents` (קיים ב-`src/domain/money.ts`) לתאימות מדויקת לשרת.

**RC-6 — `default_max_payment_count` הוא string ב-GlobalSettings**
הערך נשמר כ-string. צריך parse-ב-Order creation עם fallback ושגיאה מסודרת (לא 500 שקט).
**החלטה:** להוסיף `GlobalSettingsKeys.GetDefaultMaxPaymentCount(IGlobalSettingsRepository)` שמחזיר `int` עם fallback `12`.

**RC-7 — Delete Order check על Treatment עובר 3 hops**
`OrderItem → TreatmentSeries → Treatment`. עבור DELETE יחיד — מקובל. יש לוודא `OrderRepository.HasDependentDataAsync(orderId)` בפורמט של `CustomerRepository.HasRelatedDataAsync` (`CustomerRepository.cs:70`) עם 3 קריאות `AnyAsync`.
**החלטה:** מאושר as-is. תיעוד ה-3 roundtrips בשם המתודה בממשק הרפוזיטורי כדי שבודק בעתיד יזהה.

### המלצות שאומצו

- **R-1** — `DomainConflictException` ב-`BeautyCareClinic.Domain/Exceptions/` (לא Application). זה domain rule violation.
- **R-2** — Money precision `decimal(10,2)` כבר קיים ב-`AppDbContext.cs:171-188` ל-CustomerOrder. אין שינוי לעמודות קיימות. `PackageType.Price` ו-`OrderItem.UnitPrice` — אותה precision דרך `HasColumnType`.
- **R-3** — Pagination — endpoints קיימים לא paginate. מתאים כרגע; CR עתידי אם נדרש.
- **R-4** — DTO location — `BeautyCareClinic.Application/DTOs/OrderDtos.cs`, `PaymentDtos.cs`, `PackageTypeDtos.cs`, `TreatmentSeriesDtos.cs`. positional `record`, אחד לכל resource.
- **R-5** — `DateTime` (CR-019 deferred). לא לחרוג ב-Phase 009; timezone-fix ייטופל ב-CR-019 עתידי.
- **R-6** — `ICurrentUserService` **כבר קיים** ורשום ב-`Program.cs:157`. CR-025 קטן יותר ממה שחשבנו — רק refactor של `AuthController.Me()` ו-`UsersController` (self-delete).

### ADRs נדרשים

- **ADR-009a** — Financial atomicity: computed `RemainingBalance` + row-level lock ב-Payment insert. חובה — החלטה load-bearing שאסור לפרק בטעות.
- **ADR-009b** — Payment audit fields (`RecordedByUserId`) — conditional על אימוץ RC-4. סוגר CR-008 עבור Payment (Order נשאר פתוח).

### סיכום שינויים לסקופ

תוספות ל-Phase 009:
- Backend: `OrderDto.paymentCount` (RC-3); `Payment.RecordedByUserId` + `RecordedByFullName` (RC-4); `GlobalSettingsKeys.GetDefaultMaxPaymentCount` helper (RC-6); לפחות integration test אחד מול Postgres אמיתי (RC-1).
- Frontend: `discountPercentage` input ב-`NewOrderModal` — Manager-only (RC-5); שמירת `Payment.recordedByUserId` + `recordedByFullName` ב-`src/types/Payment.ts` (RC-4).
- אין endpoints חדשים מעבר ל-12 שכבר תוכננו.
- אין CRs חדשים. CR-018/CR-021/CR-025 נסגרים (RC-1 מדייק את test approach של CR-018).
- הערכת delta effort: ~15%.

## Implemented

### Backend
- `DomainConflictException` ב-`BeautyCareClinic.Domain/Exceptions/` (CR-021)
- `PackageTypesController` — CRUD מלא (5 endpoints), Manager-only לכתיבה
- `CustomerOrdersController` — 5 endpoints, יצירה עם טרנזקציה + Series אוטומטי
- `PaymentsController` — POST עם row-level lock (`SELECT FOR UPDATE`), GET רשימה
- `TreatmentSeriesController` — GET active + GET by id
- DTOs: `OrderDtos`, `PackageTypeDtos`, `PaymentDtos`, `TreatmentSeriesDtos`
- Repositories: `CustomerOrderRepository`, `PackageTypeRepository`, `PaymentRepository`, `TreatmentSeriesRepository`
- `GlobalSettingsKeys.GetDefaultMaxPaymentCountAsync` (RC-6)
- `ExceptionHandlingMiddleware` — טיפול מפורש ב-`DomainConflictException` (ללא `.Contains`)
- `AuthController` / `UsersController` — שימוש ב-`ICurrentUserService` (CR-025)
- `Payment.RecordedByUserId` + `RecordedByFullName` — server-derived מ-JWT (RC-4)
- `OrderDto.paymentCount` — computed server-side (RC-3)
- Validation: allowlist PaymentMethod, upper-bound Amount, precision check, PaymentDate bounds, Items count cap ≤ 50
- Batch payment count: `GetPaymentCountsByOrderIdsAsync` (מונע N+1 ב-ListByCustomer)
- Migration: `Phase009OrdersPayments`

### Frontend
- API modules: `customerOrdersApi`, `packageTypesApi`, `paymentsApi`, `treatmentSeriesApi`
- Money type system: `fromCents` מחזיר string מעוצב (`'200.00'`), `toCents` מנרמל string|number
- Types: `CustomerOrder`, `PackageType`, `Payment` — money fields: `string | number`
- `selectors.ts` — `outstandingBalance`, `openOrders`, `totalPaid` משתמשים ב-`toCents`
- `applyPaymentToOrder` — תיקון baseline: `discountedPrice` לפני `originalPrice` (C3)
- `packageTypeService.buildPackageType` — מחיר קנוני כ-string מעוצב
- `CustomerContext.tsx` — guard על `series.customerId` לפני שימוש

## Deferred or Not Implemented

- Treatments recording (Phase 010)
- Notes API wire-up (Phase 010)
- Photos API (Phase 011)
- Appointments backend (Phase 011)
- Per-therapist customer scoping (CR-029)
- Clean Architecture: extract controller logic to services (CR-026)
- Batch package-type lookup on Create (CR-030)
- Payment validation tests → integration tests (CR-028)

## Database Changes

- `PackageTypes` — עמודה `Price decimal(10,2)` NOT NULL
- `OrderItems` — עמודה `UnitPrice decimal(10,2)` NOT NULL (snapshot)
- `CustomerOrders` — `RemainingBalance` GENERATED STORED (`DiscountedPrice - AmountPaid`)
- `Payments` — `RecordedByUserId uuid`, `RecordedByFullName varchar`
- Migration: `20260717115926_Phase009OrdersPayments`

## API Changes

12 endpoints חדשים:
- `GET/POST/PUT/DELETE /api/v1/package-types`, `GET /api/v1/package-types/{id}`
- `GET /api/v1/customers/{id}/orders`, `GET /api/v1/orders/{id}`, `POST /api/v1/customers/{id}/orders`, `PUT/DELETE /api/v1/orders/{id}`
- `GET /api/v1/customers/{id}/treatment-series` (active only), `GET /api/v1/treatment-series/{id}`
- `GET /api/v1/orders/{id}/payments`, `POST /api/v1/orders/{id}/payments`

## UI Changes

- `src/api/` — 4 API modules חדשים
- Money type system — string|number union, fromCents כ-string
- `selectors.ts`, `orderService.ts`, `paymentService.ts`, `packageTypeService.ts` — money-safe
- `CustomerContext.tsx` — guards על series.customerId

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Backend (xUnit) | 105 | 0 | כולל 21 טסטים חדשים לPhase 009 |
| Frontend (Vitest) | 254 | 0 | כולל 2 טסטים חדשים ל-C3 fix |
| Integration | 0 | 0 | RC-1 Testcontainers — CR-028 |
| E2E | 0 | 0 | Manual בלבד |

## Manual Validation

- ולידציה ידנית בוצעה על ידי המשתמש.
- המשתמש אישר את Phase 009 ב-2026-07-17.
- אישור סופי: מאושר לקומיט וטאג.

## Code Review

**הושלם.** ממצאים שתוקנו:
- C1: N+1 על payment count → batch query
- C2: TreatmentSeriesController active parameter → removed, always active
- C3: applyPaymentToOrder baseline → discountedPrice before originalPrice
- C4: English error messages → Hebrew

ממצאים שנדחו ל-CR:
- C5/CR-026: AppDbContext in controllers (Clean Architecture)
- C6/CR-027: IPaymentRepository.AddAsync dead surface
- C7/CR-028: Payment validation tests quality

## Security Review

**הושלם.** ממצאים שתוקנו:
- S1: PaymentMethod allowlist (Cash/Credit Card/Bank Transfer/Check/Other)
- S2: Amount upper bound (≤99,999,999.99) + precision check
- S3: PaymentDate bounds (not future, not >10 years past)
- S4: Items count cap (≤50)

ממצאים שנדחו / documented:
- IDOR/CR-029: all-authenticated-read by design (clinic-wide model, no per-therapist scoping). מתועד ב-WORKFLOWS.md.

## Documentation Updated

- `CHANGE_REQUESTS.md` — CR-026 עד CR-030
- `docs/WORKFLOWS.md` — trust boundary section
- `phases/phase-009/PHASE_SUMMARY.md` — זה הקובץ

## Version

- Version: v0.9.0 (feature מרכזי חדש — Orders, Payments, Series backend + frontend)
- Commit: —
- Tag: —

## Lessons Learned

- Money values ב-TypeScript — עדיף `string | number` union עם `toCents`/`fromCents` adapters מאשר `number` בלבד, כי mock data ו-formatted display צריכים strings
- `fromCents` צריך להחזיר string מעוצב (`toFixed(2)`) כדי לתמוך בהשוואות ו-assertions בטסטים
- RC-1 (GENERATED column): InMemory provider לא מחשב — דורש Testcontainers. יש לתכנן integration tests מראש

## Deferred Requests

- CR-026: Clean Architecture — extract controller business logic
- CR-027: Dead IPaymentRepository.AddAsync surface
- CR-028: Payment validation integration tests
- CR-029: Per-therapist customer scoping
- CR-030: Batch package type lookup on Order Create
