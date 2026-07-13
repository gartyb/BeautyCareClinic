# Phase 003 — Treatment Recording

## Status

Approved — Pending Commit

## Goal

Enable therapists to record treatments in real time: functional timer for timer-based series, and one-click mark-complete for quantity-based series. Transform the Treatment Timer from disabled scaffold to fully working component.

## Planned

### Feature A — Treatment Timer (timer-based series)
- "התחל טיימר" button in Active Series tab activates the TimerPanel
- TimerPanel: Start / Pause / Resume / Reset / End Treatment (סיים טיפול)
- End Treatment:
  - Calculates `durationMinutes = Math.ceil(elapsedSeconds / 60)`
  - If `durationMinutes === 0` → no Treatment created, timer resets silently
  - Otherwise → increments `TreatmentSeries.usedMinutes` by `durationMinutes`, recalculates `completedTreatments = floor(usedMinutes / minutesPerTreatment)`, creates `Treatment` record
- Only one active timer globally at a time
- If a timer is already running and the user tries to start another → "התחל טיימר" is disabled on all other series; user must end the current treatment first
- Reset available at any time (running or paused) — clears elapsed, no Treatment created

### Feature B — Mark Complete (quantity-based series)
- "סמן טיפול כבוצע" button enabled when `completedTreatments < totalTreatments`
- Increments `completedTreatments` by 1, creates `Treatment` record
- Single-click, no confirmation modal
- Button disabled when series complete

### Feature C — Navbar layout fix
- Logo + clinic name → RIGHT (RTL visual prominence)
- User selector → LEFT
- Currently reversed

## Out of Scope

- Backend / persistence
- Timer state surviving page refresh
- Treatment notes or photos (Phase 4)
- Appointment-based treatments
- Editing / deleting treatments after save
- Book Appointment, Add Note (Phase 4)
- Manager admin screens (Phase 5)
- CR-001, CR-004 (backend phases)

## User Workflows

### Timer Treatment
1. Active Series tab → timer-based series card → "התחל טיימר"
2. TimerPanel activates → Start → timer runs
3. Pause / Resume / Reset as needed (Reset available mid-run)
4. "סיים טיפול":
   - elapsed = 0 → nothing saved, timer resets
   - elapsed > 0 → `durationMinutes = ceil(elapsed/60)`, `usedMinutes` updated, `completedTreatments` recalculated, Treatment created
5. While timer is running → "התחל טיימר" on all other series is disabled

### Quantity Treatment
1. Active Series tab → quantity series card → "סמן טיפול כבוצע"
2. completedTreatments +1, Treatment created immediately

## Domain Changes

- `TreatmentSeries.usedMinutes` — incremented on timer end (already in type)
- `TreatmentSeries.completedTreatments` — incremented on quantity mark-complete (already in type)
- `Treatment` records created for both kinds — type unchanged
- `CustomerContext` upgraded: `treatments` moved to `useState`, new `addTreatment(treatment)` method

## UI Changes

| Component | Change |
|---|---|
| `ActiveTimerContext.tsx` | Replace all no-ops with real timer state + setInterval logic |
| `TimerPanel.tsx` | Enable all buttons; add "סיים טיפול" button |
| `ActiveSeriesTab.tsx` | Enable "התחל טיימר" + "סמן טיפול כבוצע" buttons; wire to context/service |
| `Header.tsx` | Swap layout: logo+name RIGHT, user selector LEFT |
| `CustomerContext.tsx` | Add `addTreatment`, move treatments to useState, add series update method |

## New Files

| File | Purpose |
|---|---|
| `src/features/treatment/treatmentService.ts` | `createTimerTreatment()`, `createQuantityTreatment()`, `roundUpMinutes()` — pure functions |

## Validation Rules

1. `elapsedSeconds >= 0` — no upper bound
2. `durationMinutes = Math.ceil(elapsedSeconds / 60)`
3. If `durationMinutes === 0` → no Treatment created (silent reset)
4. Mark-complete blocked when `completedTreatments >= totalTreatments`
5. Only one timer running globally at a time; "התחל טיימר" disabled on all other series while one is active
6. Switching between timers is not allowed — user must end current treatment first
7. Reset available at any time (running or paused) — never creates a Treatment
8. `treatmentDate` = today (ISO date, no time)
9. `therapistId` = `currentUser.id`

## Testing Strategy

### Unit
- `treatmentService`: `createTimerTreatment` (various elapsed times, rounding), `createQuantityTreatment`, `roundUpMinutes` edge cases (0s, 59s, 60s, 61s)
- `ActiveTimerContext`: start/pause/resume/reset state transitions, single-timer lock, reset mid-run

### Manual (acceptance criteria)
- Full timer workflow end-to-end
- Timer end at 0 seconds → no Treatment created
- Quantity mark-complete
- "התחל טיימר" disabled on second series while first is running
- Navbar layout visual check

## Risks

| Risk | Mitigation |
|---|---|
| Interval leak on unmount | `useEffect` cleanup in ActiveTimerContext |
| Double-click End Treatment | Disable button during save |
| RTL navbar regression | Visual validation before commit |

## Implemented

- `ActiveTimerContext.tsx` — טיימר אמיתי עם setInterval, `selectAndStart`, `endAndGetElapsed`, single-timer lock
- `treatmentService.ts` — פונקציות טהורות: build/apply לשני סוגי הטיפולים, roundUpMinutes, guards
- `CustomerContext.tsx` — `recordTimerTreatment` + `recordQuantityTreatment`, treatments ב-useState, allSeriesRef
- `TimerPanel.tsx` — כל הכפתורים פעילים + "סיים טיפול"
- `ActiveSeriesTab.tsx` — כפתורי פעולה מחוברים
- `Header.tsx` — לוגו+שם ימין, בורר משתמש שמאל (RTL)

## Architecture Review

- ADR-002 אושר
- `endAndGetElapsed` מנקה state אטומית
- `selectAndStart` — פתרון ל-stale closure bug
- `completedTreatments` לסדרות זמן נשאר נגזר (selector)
- overrun clamp: `usedMinutes` מוגבל ל-`totalMinutes`

## Automated Tests

| Test Type | Passed | Failed | Notes |
|---|---:|---:|---|
| Unit | 126 | 0 | כולל 38 טסטים חדשים ב-treatmentService |
| Build | ✓ | — | 0 TypeScript errors |

## Code Review

- Critical (1): תוקן — stale `targetSeriesId` בטיפול ב-`selectAndStart`
- High (3): תוקנו — overrun guard, dead ref, elapsed=0 feedback
- Medium: דחויים (allSeriesRef הוסף, DomainError נתפס)
- Nits: דחויים

## Security Review

- High (P1): CR-008 — therapistId ב-backend phase
- Medium (2): תוקנו — NaN guard, DomainError catch
- Low/Informational: דחויים

## Decisions (Closed Questions)

1. **Multi-timer:** Cannot switch — "התחל טיימר" disabled on all other series while one is active. User must end the current treatment first.
2. **Reset mid-run:** Available at any time (running or paused). No Treatment created.
3. **Treatment notes/photos:** Deferred to Phase 4.

## Acceptance Criteria

### Timer Series
1. Active timer series card → "התחל טיימר" enabled; clicking activates TimerPanel
2. TimerPanel: Start → timer increments in real time (m:ss / h:mm:ss)
3. Pause → elapsed freezes; Resume → continues from pause point
4. Reset → available mid-run or paused → elapsed resets to 0, no Treatment created
5. "סיים טיפול" with elapsed = 0 → no Treatment created, timer resets silently
6. "סיים טיפול" with elapsed > 0 → `usedMinutes` updated, `completedTreatments` recalculated, Treatment created with `durationMinutes = ceil(elapsed/60)`
7. Treatment appears in Treatment History tab immediately
8. Active Series progress bar updates immediately after end
9. Series that reaches completion shows no more timer button
10. While a timer is active → "התחל טיימר" disabled on all other timer series

### Quantity Series
11. "סמן טיפול כבוצע" enabled when not complete
12. Single click → `completedTreatments` +1, Treatment created, progress bar updates
13. Button disabled when `completedTreatments >= totalTreatments`

### Navbar
13. RIGHT side: logo immediately followed by clinic name
14. LEFT side: user selector dropdown, fully functional
15. No layout breakage, no truncation

### Quality
16. `npm run build` — clean
17. `npm run test` — all pass
18. No interval leaks (timer cleans up on context unmount)

## Dependencies

- No new npm packages
- No backend

## Version

- Approved: v0.3.0
