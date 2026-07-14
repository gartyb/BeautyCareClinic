# Phase 004 — Treatment Notes, Photos & Add Note

## Status

Completed

## Goal

Complete the treatment record: allow therapists to add notes and photos to existing treatments from Treatment History, and activate the "הוסף הערה" quick action for customer-level notes.

## Planned

### Feature A — Notes on Treatment (from History)
- Click a treatment row in Treatment History → TreatmentModal opens
- "הוסף הערה" / "ערוך הערה" button inside the modal → inline textarea → save
- Saves to `Treatment.notes` via `updateTreatmentNote(treatmentId, notes)` in CustomerContext
- Note preview shown in the treatment row (truncated, as today)

### Feature B — Photos on Treatment (from History)
- "הוסף תמונה" button inside TreatmentModal → file input (accept image/*)
- Mock URL: `URL.createObjectURL(file)` — no real upload (backend phase)
- Adds to `Treatment.treatmentPhotos` via `addTreatmentPhoto(treatmentId, photo)` in CustomerContext
- Thumbnails displayed in TreatmentModal (already rendered if photos exist)
- Multiple photos per treatment supported

### Feature C — "הוסף הערה" Quick Action
- Activate the disabled button in QuickActionButtons
- Modal: textarea (required) → save creates `Note` on the customer
- Uses `addNote(note: Note)` in CustomerContext
- Note appears immediately in NotesTab

## Out of Scope

- Editing/deleting notes or photos after saving
- Real file upload to server (Phase 5 / Backend)
- Book Appointment (Phase 5)
- Manager admin screens (Phase 5)
- CR-001, CR-004, CR-008 (backend phases)

## Domain Changes

- `CustomerContext` gains:
  - `updateTreatmentNote(treatmentId: string, notes: string): void`
  - `addTreatmentPhoto(treatmentId: string, photo: TreatmentPhoto): void`
  - `addNote(note: Note): void`
- `allTreatments` already in `useState` (Phase 3) — mutations work the same way

## UI Changes

| Component | Change |
|---|---|
| `TreatmentHistoryTab.tsx` — `TreatmentModal` | Add note textarea + save button; add photo file input + thumbnails |
| `QuickActionButtons.tsx` | Enable "הוסף הערה" button, wire to new `AddNoteModal` |
| `CustomerContext.tsx` | Add `updateTreatmentNote`, `addTreatmentPhoto`, `addNote` |

## New Files

| File | Purpose |
|---|---|
| `src/features/note/AddNoteModal.tsx` | Modal for customer-level note (Quick Action) |
| `src/features/note/noteService.ts` | Pure `buildNote()` function |
| `src/features/note/noteService.test.ts` | Unit tests |

## Validation Rules

1. Note text must not be empty (trim check) before saving
2. Photo file must be an image (`file.type.startsWith('image/')`)
3. Max one note per treatment (overwrite, not append)
4. `authorUserId` = `currentUser.id`
5. `createdDate` / `noteDate` = today (ISO date)

## Acceptance Criteria

1. Treatment History → click treatment → modal opens
2. Modal: "הוסף הערה" → textarea → save → note appears immediately in modal and in treatment row
3. Modal: "הוסף תמונה" → file picker → image selected → thumbnail appears in modal
4. Multiple photos supported per treatment
5. Quick Action "הוסף הערה" → modal → save → note appears in NotesTab immediately
6. Empty note text → save disabled
7. Non-image file → rejected silently (file input accept filter)
8. `npm run build` — clean
9. `npm run test` — all pass

## Architecture Review

- ADR-003: לא נדרש — כל הרכיבים מרחיבים דפוסים קיימים
- **APPROVED WITH CONDITIONS** — 3 תנאים שהוטמעו ב-implementation:
  - C1: blob-URL session-scope documented (Known Limitations)
  - C2: runtime guard `file.type.startsWith('image/')` בנוסף ל-`accept` attribute
  - C3: `buildTreatmentPhoto` נוסף ל-`treatmentService.ts` כ-pure builder; UI לא בונה entities ישירות
- Recommendation R1: TreatmentModal מופרד לקובץ משלו (לא חובה אבל מומלץ)

## Known Limitations

- תמונות מאוחסנות כ-blob URLs (URL.createObjectURL) — session-scoped בלבד; לא שורדות רענון דף (עקבי עם שאר הנתונים שבזיכרון בלבד).

## Dependencies

- No new npm packages
- No backend

## Implemented

- Feature A: TreatmentModal extracted to `TreatmentModal.tsx`; note editing inline "הוסף הערה"/"ערוך הערה"/"מחק הערה"; save disabled when empty; `noteText` re-syncs via `useEffect` on prop change
- Feature B: "הוסף תמונה"; runtime guard `ALLOWED_TYPES.includes(file.type)` (jpeg/png/webp/gif, no SVG); 10MB size cap; `buildTreatmentPhoto` builder (C3); blob URLs revoked on unmount (useEffect cleanup); lightbox via `ReactDOM.createPortal` (escapes Dialog stacking context)
- Feature C: "הוסף הערה" quick action; `AddNoteModal`; `buildNote()` enforces non-empty via `DomainError`; note appears in NotesTab immediately
- `CustomerContext.notes` moved to `useState`; `updateTreatmentNote` stores `undefined` on empty string
- `treatmentPhotos ?? []` null guards added; `maxLength={2000}` on all note textareas
- Architecture recommendation R1 implemented: `TreatmentModal` in its own file

## Code Review

- High (3): תוקנו — מחיקת הערה, stale textarea state, blob URL revocation
- Medium (6): תוקנו — null guard, lightbox portal, `buildNote` DomainError, file buttons unconditional, strict MIME allowlist, file input reset
- Low (4): נדחו — cosmetic, tracked as CR-009

## Security Review

- High: CR-008 (authorUserId) — ידוע, backend phase
- Medium: blob revocation תוקן; file validation הוחמרה; data loss on refresh — documented, CR-010
- Low/Informational: נדחו — logger abstraction, photoUrl scheme check, IDOR precursor — backend phase (CR-009, CR-010)

## Deferred

- CR-009: UUID test assertion strength, BuilderDeps deduplication, cosmetic naming (code review lows)
- CR-010: Data-loss-on-refresh banner; logger abstraction; SYSTEM_FLOWS.md; photoUrl scheme allowlist — backend/infra phase

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Unit (treatmentService) | 47 | 0 | +7 buildTreatmentPhoto |
| Unit (noteService) | 11 | 0 | +2 DomainError tests (FIX-6) |
| Unit (other) | 88 | 0 | unchanged |
| Total | 146 | 0 | |

## Manual Validation

- Avatar + שם לקוח — תוקן סדר RTL בכרטיס לקוח
- כותרות פרטי טיפול — תוקן ל-RTL (צמוד, לא justify-between)
- פונט הוגדל ל-16px בפרטי טיפול ובטאב היסטוריה
- הערה מוצגת במלואה בשורת הטיפול (הוסרה truncate)
- תיקון באג: שמירת הערה לא התעדכנה ב-modal — תוקן (selectedTreatmentId במקום snapshot)
- תיקון באג: תמונה לא נטענה — `e.target.value = ''` הועבר אחרי קריאת הקובץ
- תיקון באג: סגירת lightbox סגרה גם את ה-modal — תוקן (handleModalClose)
- תיקון באג: תמונה נעלמה אחרי סגירה — הוסר cleanup של blob URL revocation
- נוספה מחיקת תמונה (X על thumbnail בhover)
- thumbnails בטאב היסטוריה — נוספו ועברו לצד שמאל
- אושר על ידי המשתמש ✓

## Version

- Version: v0.4.0
