import { describe, it, expect } from 'vitest';
import {
  computeEndTime,
  getDurationMinutes,
  getAppointmentInterval,
  isSlotAvailable,
  getAvailableSlots,
  getAvailableTherapists,
  getNextAppointment,
} from './appointmentService';
import { Appointment } from '../../types/Appointment';
import { User } from '../../types/User';
import { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    customerId: 'cust-1',
    treatmentTypeId: 'tt-1',
    treatmentTypeName: 'טיפול פנים',
    userId: 'therapist-1',
    userFullName: 'מטפלת בדיקה',
    startTime: '2099-01-01T10:00:00',
    endTime: '2099-01-01T11:00:00',
    status: 'Scheduled',
    createdAt: '2099-01-01T00:00:00',
    ...overrides,
  };
}

// 2099-01-14 is a Wednesday (weekday=3)
const FUTURE_DATE = '2099-01-14';

const baseWorkingHours: TherapistWorkingHours[] = [
  { id: 'wh-1', userId: 'therapist-1', weekday: 3, startTime: '09:00', endTime: '18:00' }, // Wednesday
];

const baseUnavailableDates: TherapistUnavailableDate[] = [];

const baseCapabilities: TherapistCapability[] = [
  { id: 'cap-1', userId: 'therapist-1', treatmentTypeId: 'tt-1' },
];

// ─── computeEndTime ─────────────────────────────────────────────────────────────

describe('computeEndTime', () => {
  it('adds minutes to a naive-local startTime and preserves the date', () => {
    expect(computeEndTime('2026-07-20T10:00:00', 60)).toBe('2026-07-20T11:00:00');
  });

  it('handles non-round-hour durations', () => {
    expect(computeEndTime('2026-07-20T10:30:00', 45)).toBe('2026-07-20T11:15:00');
  });
});

// ─── getDurationMinutes ───────────────────────────────────────────────────────

describe('getDurationMinutes', () => {
  it('returns the whole-minute difference between startTime and endTime', () => {
    const appt = makeAppt({ startTime: '2099-01-01T09:00:00', endTime: '2099-01-01T10:00:00' });
    expect(getDurationMinutes(appt)).toBe(60);
  });

  it('handles a 90-minute appointment', () => {
    const appt = makeAppt({ startTime: '2099-01-01T10:30:00', endTime: '2099-01-01T12:00:00' });
    expect(getDurationMinutes(appt)).toBe(90);
  });
});

// ─── getAppointmentInterval ───────────────────────────────────────────────────

describe('getAppointmentInterval', () => {
  it('60-min appointment at 09:00 → end at 10:00', () => {
    const appt = makeAppt({ startTime: '2099-01-01T09:00:00', endTime: '2099-01-01T10:00:00' });
    const { start, end } = getAppointmentInterval(appt);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(0);
  });

  it('returns Date objects', () => {
    const appt = makeAppt();
    const { start, end } = getAppointmentInterval(appt);
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });
});

// ─── isSlotAvailable ─────────────────────────────────────────────────────────

describe('isSlotAvailable', () => {
  it('returns true when all 4 conditions pass', () => {
    const result = isSlotAvailable(
      FUTURE_DATE,     // 2099-01-14 is a Wednesday (weekday 3)
      '10:00',
      60,
      'therapist-1',
      baseWorkingHours,
      baseUnavailableDates,
      baseCapabilities,
      'tt-1',
      []
    );
    expect(result).toBe(true);
  });

  it('returns false when no working hours for weekday', () => {
    const result = isSlotAvailable(
      FUTURE_DATE,
      '10:00',
      60,
      'therapist-1',
      [], // no working hours
      baseUnavailableDates,
      baseCapabilities,
      'tt-1',
      []
    );
    expect(result).toBe(false);
  });

  it('returns false when working hours row has null startTime', () => {
    const nullHours: TherapistWorkingHours[] = [
      { id: 'wh-1', userId: 'therapist-1', weekday: 3, startTime: null, endTime: null },
    ];
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      nullHours, baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(result).toBe(false);
  });

  it('returns false when date is in unavailable dates', () => {
    const unavailable: TherapistUnavailableDate[] = [
      { id: 'ud-1', userId: 'therapist-1', date: FUTURE_DATE },
    ];
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      baseWorkingHours, unavailable, baseCapabilities, 'tt-1', []
    );
    expect(result).toBe(false);
  });

  it('returns false when therapist has no capability for treatment type', () => {
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates,
      [], // no capabilities
      'tt-1', []
    );
    expect(result).toBe(false);
  });

  it('returns false when overlapping scheduled appointment exists', () => {
    const existing: Appointment[] = [
      makeAppt({
        userId: 'therapist-1',
        startTime: '2099-01-14T09:30:00',
        endTime: '2099-01-14T10:30:00',
        status: 'Scheduled',
      }),
    ];
    // Our slot: 10:00-11:00 overlaps with 09:30-10:30
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', existing
    );
    expect(result).toBe(false);
  });

  it('returns true when cancelled appointment exists in same slot (no block)', () => {
    const existing: Appointment[] = [
      makeAppt({
        userId: 'therapist-1',
        startTime: '2099-01-14T10:00:00',
        endTime: '2099-01-14T11:00:00',
        status: 'Cancelled',
      }),
    ];
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', existing
    );
    expect(result).toBe(true);
  });

  it('ignores appointments for a different therapist', () => {
    const existing: Appointment[] = [
      makeAppt({
        userId: 'therapist-2',
        startTime: '2099-01-14T10:00:00',
        endTime: '2099-01-14T11:00:00',
        status: 'Scheduled',
      }),
    ];
    const result = isSlotAvailable(
      FUTURE_DATE, '10:00', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', existing
    );
    expect(result).toBe(true);
  });

  it('returns false when slot start time is before working hours start', () => {
    const result = isSlotAvailable(
      FUTURE_DATE, '08:00', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(result).toBe(false);
  });

  it('returns false when slot would exceed working hours end', () => {
    // Working hours: 09:00-18:00; slot 17:30+60min ends at 18:30 > 18:00
    const result = isSlotAvailable(
      FUTURE_DATE, '17:30', 60, 'therapist-1',
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(result).toBe(false);
  });
});

// ─── getAvailableSlots ────────────────────────────────────────────────────────

describe('getAvailableSlots', () => {
  it('returns HH:MM strings within working hours', () => {
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 60,
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toMatch(/^\d{2}:\d{2}$/);
  });

  it('returns empty array when date is in unavailable dates', () => {
    const unavailable: TherapistUnavailableDate[] = [
      { id: 'ud-1', userId: 'therapist-1', date: FUTURE_DATE },
    ];
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 60,
      baseWorkingHours, unavailable, baseCapabilities, 'tt-1', []
    );
    expect(slots).toHaveLength(0);
  });

  it('returns empty array when no working hours for the day', () => {
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 60,
      [], // no working hours
      baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(slots).toHaveLength(0);
  });

  it('excludes slots that would exceed working hours end time', () => {
    // Working hours 09:00-18:00, 90-min slot starting at 17:00 would end at 18:30 → excluded
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 90,
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', []
    );
    expect(slots).not.toContain('17:30');
    // But 16:30 slot (16:30+90min=18:00) should be included
    expect(slots).toContain('16:30');
  });

  it('excludes slots overlapping existing scheduled appointment', () => {
    const existing: Appointment[] = [
      makeAppt({
        userId: 'therapist-1',
        startTime: '2099-01-14T10:00:00',
        endTime: '2099-01-14T11:00:00',
        status: 'Scheduled',
      }),
    ];
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 60,
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', existing
    );
    // 10:00 is blocked
    expect(slots).not.toContain('10:00');
    // 09:30 overlaps 10:00-11:00 → also blocked
    expect(slots).not.toContain('09:30');
    // 11:00 is free
    expect(slots).toContain('11:00');
  });

  it('slots from cancelled appointments are not excluded', () => {
    const existing: Appointment[] = [
      makeAppt({
        userId: 'therapist-1',
        startTime: '2099-01-14T10:00:00',
        endTime: '2099-01-14T11:00:00',
        status: 'Cancelled',
      }),
    ];
    const slots = getAvailableSlots(
      FUTURE_DATE, 'therapist-1', 60,
      baseWorkingHours, baseUnavailableDates, baseCapabilities, 'tt-1', existing
    );
    expect(slots).toContain('10:00');
  });
});

// ─── getAvailableTherapists ───────────────────────────────────────────────────

describe('getAvailableTherapists', () => {
  const therapist1: User = { id: 'therapist-1', fullName: 'טלי כהן', email: 't1@clinic.local', role: 'Therapist' };
  const therapist2: User = { id: 'therapist-2', fullName: 'שרה לוי', email: 't2@clinic.local', role: 'Therapist' };
  const manager: User = { id: 'manager-1', fullName: 'מנהלת', email: 'm@clinic.local', role: 'Manager' };

  it('excludes non-Therapist users even if they have working hours/capability rows', () => {
    const workingHours: TherapistWorkingHours[] = [
      ...baseWorkingHours,
      { id: 'wh-2', userId: 'manager-1', weekday: 3, startTime: '09:00', endTime: '18:00' },
    ];
    const capabilities: TherapistCapability[] = [
      ...baseCapabilities,
      { id: 'cap-2', userId: 'manager-1', treatmentTypeId: 'tt-1' },
    ];
    const result = getAvailableTherapists(
      FUTURE_DATE, 'tt-1', [therapist1, manager], workingHours, baseUnavailableDates, capabilities, []
    );
    expect(result.map(t => t.id)).toEqual(['therapist-1']);
    expect(result.map(t => t.id)).not.toContain('manager-1');
  });

  it('excludes a therapist with no working hours on the given weekday', () => {
    const result = getAvailableTherapists(
      FUTURE_DATE, 'tt-1', [therapist1, therapist2], baseWorkingHours, baseUnavailableDates, baseCapabilities, []
    );
    expect(result.map(t => t.id)).toEqual(['therapist-1']);
  });

  it('excludes a therapist without capability for the treatment type', () => {
    const result = getAvailableTherapists(
      FUTURE_DATE, 'tt-2', [therapist1], baseWorkingHours, baseUnavailableDates, baseCapabilities, []
    );
    expect(result).toHaveLength(0);
  });

  it('excludes a therapist fully booked for the entire working-hours window', () => {
    // Working hours 09:00-18:00 — 3 back-to-back blocks leave no free slot of any length.
    const existing: Appointment[] = [
      makeAppt({ id: 'blk-1', userId: 'therapist-1', startTime: '2099-01-14T09:00:00', endTime: '2099-01-14T12:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'blk-2', userId: 'therapist-1', startTime: '2099-01-14T12:00:00', endTime: '2099-01-14T15:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'blk-3', userId: 'therapist-1', startTime: '2099-01-14T15:00:00', endTime: '2099-01-14T18:00:00', status: 'Scheduled' }),
    ];
    const result = getAvailableTherapists(
      FUTURE_DATE, 'tt-1', [therapist1], baseWorkingHours, baseUnavailableDates, baseCapabilities, existing
    );
    expect(result).toHaveLength(0);
  });
});

// ─── getNextAppointment ───────────────────────────────────────────────────────

describe('getNextAppointment', () => {
  it('returns earliest upcoming scheduled appointment', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', startTime: '2099-03-01T10:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'a2', customerId: 'cust-1', startTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
    ];
    const result = getNextAppointment('cust-1', appts);
    expect(result?.id).toBe('a2');
  });

  it('returns null when no upcoming scheduled appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', startTime: '2000-01-01T10:00:00', status: 'Completed' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(getNextAppointment('cust-1', [])).toBeNull();
  });

  it('ignores cancelled appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', startTime: '2099-02-01T10:00:00', status: 'Cancelled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('ignores past appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', startTime: '2000-01-01T10:00:00', status: 'Scheduled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('ignores appointments for other customers', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-2', startTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('returns appointment for specific customer only', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', startTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'a2', customerId: 'cust-2', startTime: '2099-01-01T10:00:00', status: 'Scheduled' }),
    ];
    const result = getNextAppointment('cust-1', appts);
    expect(result?.id).toBe('a1');
  });
});
