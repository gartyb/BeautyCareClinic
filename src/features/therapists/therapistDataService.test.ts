import { describe, it, expect } from 'vitest';
import {
  buildWorkingHours,
  updateTherapistWorkingHours,
  buildUnavailableDate,
  addUnavailableDate,
  removeUnavailableDate,
  buildCapability,
  updateTherapistCapabilities,
} from './therapistDataService';
import { DomainError } from '../../domain/errors';
import type { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';

let counter = 0;
const testDeps = { newId: () => `id-${++counter}` };
function resetCounter() { counter = 0; }

// ─── buildWorkingHours ────────────────────────────────────────────────────────

describe('buildWorkingHours', () => {
  it('builds a working hours record', () => {
    resetCounter();
    const wh = buildWorkingHours('user-1', 0, '08:00', '17:00', testDeps);
    expect(wh.userId).toBe('user-1');
    expect(wh.weekday).toBe(0);
    expect(wh.startTime).toBe('08:00');
    expect(wh.endTime).toBe('17:00');
  });

  it('throws WORKING_HOURS_INVALID_RANGE when startTime >= endTime', () => {
    resetCounter();
    expect.assertions(2);
    try {
      buildWorkingHours('user-1', 1, '18:00', '09:00', testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('WORKING_HOURS_INVALID_RANGE');
    }
  });

  it('throws WORKING_HOURS_INVALID_RANGE when startTime equals endTime', () => {
    resetCounter();
    expect.assertions(2);
    try {
      buildWorkingHours('user-1', 1, '09:00', '09:00', testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('WORKING_HOURS_INVALID_RANGE');
    }
  });

  it('allows null startTime and endTime (day off)', () => {
    resetCounter();
    const wh = buildWorkingHours('user-1', 5, null, null, testDeps);
    expect(wh.startTime).toBeNull();
    expect(wh.endTime).toBeNull();
  });

  it('allows startTime without endTime', () => {
    resetCounter();
    const wh = buildWorkingHours('user-1', 2, '08:00', null, testDeps);
    expect(wh.startTime).toBe('08:00');
    expect(wh.endTime).toBeNull();
  });
});

// ─── updateTherapistWorkingHours ──────────────────────────────────────────────

describe('updateTherapistWorkingHours', () => {
  it('replaces hours for the given user immutably', () => {
    resetCounter();
    const existing: TherapistWorkingHours[] = [
      { id: 'wh-1', userId: 'user-1', weekday: 0, startTime: '08:00', endTime: '16:00' },
      { id: 'wh-2', userId: 'user-2', weekday: 1, startTime: '09:00', endTime: '17:00' },
    ];
    const newHours = [{ weekday: 0, startTime: '07:00', endTime: '15:00' }];
    const result = updateTherapistWorkingHours('user-1', newHours, existing, testDeps);

    const user1Hours = result.filter(h => h.userId === 'user-1');
    const user2Hours = result.filter(h => h.userId === 'user-2');
    expect(user1Hours).toHaveLength(1);
    expect(user1Hours[0].startTime).toBe('07:00');
    expect(user2Hours).toHaveLength(1);
    expect(existing).toHaveLength(2); // original unchanged
  });

  it('throws WORKING_HOURS_INVALID_RANGE for invalid range in batch update', () => {
    resetCounter();
    expect.assertions(2);
    const existing: TherapistWorkingHours[] = [];
    try {
      updateTherapistWorkingHours(
        'user-1',
        [{ weekday: 2, startTime: '17:00', endTime: '09:00' }],
        existing,
        testDeps
      );
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('WORKING_HOURS_INVALID_RANGE');
    }
  });
});

// ─── Unavailable Dates ────────────────────────────────────────────────────────

describe('buildUnavailableDate', () => {
  it('builds an unavailable date record', () => {
    resetCounter();
    const ud = buildUnavailableDate('user-1', '2026-08-01', testDeps);
    expect(ud.userId).toBe('user-1');
    expect(ud.date).toBe('2026-08-01');
  });

  it('throws UNAVAILABLE_DATE_INVALID for invalid date format', () => {
    resetCounter();
    expect.assertions(2);
    try {
      buildUnavailableDate('user-1', '15/08/2026', testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('UNAVAILABLE_DATE_INVALID');
    }
  });

  it('throws UNAVAILABLE_DATE_INVALID for date with invalid month/day (e.g. 2024-13-99)', () => {
    resetCounter();
    expect.assertions(2);
    try {
      buildUnavailableDate('user-1', '2024-13-99', testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('UNAVAILABLE_DATE_INVALID');
    }
  });
});

describe('addUnavailableDate', () => {
  it('adds a new date immutably', () => {
    resetCounter();
    const current: TherapistUnavailableDate[] = [];
    const result = addUnavailableDate('user-1', '2026-08-01', current, testDeps);
    expect(result).toHaveLength(1);
    expect(current).toHaveLength(0); // original unchanged
  });

  it('does not add duplicate date for same user', () => {
    resetCounter();
    const existing: TherapistUnavailableDate[] = [
      { id: 'ud-1', userId: 'user-1', date: '2026-08-01' },
    ];
    const result = addUnavailableDate('user-1', '2026-08-01', existing, testDeps);
    expect(result).toHaveLength(1);
  });

  it('allows same date for different users', () => {
    resetCounter();
    const existing: TherapistUnavailableDate[] = [
      { id: 'ud-1', userId: 'user-1', date: '2026-08-01' },
    ];
    const result = addUnavailableDate('user-2', '2026-08-01', existing, testDeps);
    expect(result).toHaveLength(2);
  });
});

describe('removeUnavailableDate', () => {
  it('removes the matching date immutably', () => {
    const existing: TherapistUnavailableDate[] = [
      { id: 'ud-1', userId: 'user-1', date: '2026-08-01' },
      { id: 'ud-2', userId: 'user-1', date: '2026-08-10' },
    ];
    const result = removeUnavailableDate('user-1', '2026-08-01', existing);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-08-10');
    expect(existing).toHaveLength(2); // original unchanged
  });
});

// ─── Capabilities ─────────────────────────────────────────────────────────────

describe('buildCapability', () => {
  it('builds a capability record', () => {
    resetCounter();
    const cap = buildCapability('user-1', 'tt-1', testDeps);
    expect(cap.userId).toBe('user-1');
    expect(cap.treatmentTypeId).toBe('tt-1');
  });
});

describe('updateTherapistCapabilities', () => {
  it('replaces capabilities for the given user immutably', () => {
    resetCounter();
    const existing: TherapistCapability[] = [
      { id: 'cap-1', userId: 'user-1', treatmentTypeId: 'tt-1' },
      { id: 'cap-2', userId: 'user-2', treatmentTypeId: 'tt-2' },
    ];
    const result = updateTherapistCapabilities('user-1', ['tt-2', 'tt-3'], existing, testDeps);
    const user1Caps = result.filter(c => c.userId === 'user-1');
    const user2Caps = result.filter(c => c.userId === 'user-2');
    expect(user1Caps).toHaveLength(2);
    expect(user1Caps.map(c => c.treatmentTypeId)).toContain('tt-2');
    expect(user1Caps.map(c => c.treatmentTypeId)).toContain('tt-3');
    expect(user2Caps).toHaveLength(1);
    expect(existing).toHaveLength(2); // original unchanged
  });

  it('clears all capabilities when empty array given', () => {
    resetCounter();
    const existing: TherapistCapability[] = [
      { id: 'cap-1', userId: 'user-1', treatmentTypeId: 'tt-1' },
    ];
    const result = updateTherapistCapabilities('user-1', [], existing, testDeps);
    expect(result.filter(c => c.userId === 'user-1')).toHaveLength(0);
  });
});
