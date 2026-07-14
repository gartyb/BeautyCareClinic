# Phase 004 — Treatment Notes, Photos & Add Note

## Status

Planning

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

## Dependencies

- No new npm packages
- No backend

## Version

- Planned: v0.4.0
