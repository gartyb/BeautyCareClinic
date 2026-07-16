import { describe, it, expect } from 'vitest';
import {
  buildAppointment,
  cancelAppointmentInList,
  getAppointmentInterval,
  isSlotAvailable,
  getAvailableSlots,
  getNextAppointment,
} from './appointmentService';
import { DomainError } from '../../domain/errors';
import { Appointment } from '../../types/Appointment';
import { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    customerId: 'cust-1',
    treatmentTypeId: 'tt-1',
    therapistId: 'therapist-1',
    appointmentDateTime: '2099-01-01T10:00:00',
    durationMinutes: 60,
    status: 'Scheduled',
    createdDate: '2099-01-01T00:00:00',
    ...overrides,
  };
}

// 2099-01-14 is a Wednesday (weekday=3)
const FUTURE_DATE = '2099-01-14';
const FUTURE_DATETIME = '2099-01-14T10:00:00';
const PAST_DATETIME = '2000-01-01T10:00:00';

const testDeps = {
  newId: () => 'test-appt-id',
  now: () => '2026-07-15T12:00:00',
};

const baseWorkingHours: TherapistWorkingHours[] = [
  { id: 'wh-1', userId: 'therapist-1', weekday: 3, startTime: '09:00', endTime: '18:00' }, // Wednesday
];

const baseUnavailableDates: TherapistUnavailableDate[] = [];

const baseCapabilities: TherapistCapability[] = [
  { id: 'cap-1', userId: 'therapist-1', treatmentTypeId: 'tt-1' },
];

// 2099-01-14 is a Wednesday (weekday=3)

// ─── buildAppointment ─────────────────────────────────────────────────────────

describe('buildAppointment', () => {
  it('creates appointment with status Scheduled for valid inputs', () => {
    const appt = buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, 60, testDeps);
    expect(appt.status).toBe('Scheduled');
    expect(appt.customerId).toBe('cust-1');
    expect(appt.treatmentTypeId).toBe('tt-1');
    expect(appt.therapistId).toBe('therapist-1');
    expect(appt.appointmentDateTime).toBe(FUTURE_DATETIME);
    expect(appt.durationMinutes).toBe(60);
  });

  it('uses injected newId', () => {
    const appt = buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, 60, testDeps);
    expect(appt.id).toBe('test-appt-id');
  });

  it('uses injected now for createdDate', () => {
    const appt = buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, 60, testDeps);
    expect(appt.createdDate).toBe('2026-07-15T12:00:00');
  });

  it('throws INVALID_CUSTOMER for empty customerId', () => {
    expect.assertions(2);
    try {
      buildAppointment('', 'tt-1', 'therapist-1', FUTURE_DATETIME, 60, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_CUSTOMER');
    }
  });

  it('throws INVALID_TREATMENT_TYPE for empty treatmentTypeId', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', '', 'therapist-1', FUTURE_DATETIME, 60, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_TREATMENT_TYPE');
    }
  });

  it('throws INVALID_THERAPIST for empty therapistId', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', '', FUTURE_DATETIME, 60, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_THERAPIST');
    }
  });

  it('throws INVALID_APPOINTMENT_DATE for past appointmentDateTime', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', 'therapist-1', PAST_DATETIME, 60, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_APPOINTMENT_DATE');
    }
  });

  it('throws INVALID_APPOINTMENT_DATE for empty appointmentDateTime', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', 'therapist-1', '', 60, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_APPOINTMENT_DATE');
    }
  });

  it('throws INVALID_DURATION for durationMinutes = 0', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, 0, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_DURATION');
    }
  });

  it('throws INVALID_DURATION for durationMinutes = -1', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, -1, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_DURATION');
    }
  });

  it('throws INVALID_DURATION for non-integer durationMinutes', () => {
    expect.assertions(2);
    try {
      buildAppointment('cust-1', 'tt-1', 'therapist-1', FUTURE_DATETIME, 1.5, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('INVALID_DURATION');
    }
  });
});

// ─── cancelAppointmentInList ──────────────────────────────────────────────────

describe('cancelAppointmentInList', () => {
  it('returns new array with status Cancelled for the found appointment', () => {
    const appts = [makeAppt({ id: 'a1' }), makeAppt({ id: 'a2' })];
    const result = cancelAppointmentInList(appts, 'a1');
    expect(result.find(a => a.id === 'a1')?.status).toBe('Cancelled');
    expect(result.find(a => a.id === 'a2')?.status).toBe('Scheduled');
  });

  it('does not mutate original array', () => {
    const appts = [makeAppt({ id: 'a1' })];
    cancelAppointmentInList(appts, 'a1');
    expect(appts[0].status).toBe('Scheduled');
  });

  it('throws APPOINTMENT_NOT_FOUND when id not in list', () => {
    expect.assertions(2);
    const appts = [makeAppt({ id: 'a1' })];
    try {
      cancelAppointmentInList(appts, 'unknown');
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('APPOINTMENT_NOT_FOUND');
    }
  });

  it('returns a new array reference (immutable)', () => {
    const appts = [makeAppt({ id: 'a1' })];
    const result = cancelAppointmentInList(appts, 'a1');
    expect(result).not.toBe(appts);
  });
});

// ─── getAppointmentInterval ───────────────────────────────────────────────────

describe('getAppointmentInterval', () => {
  it('60-min appointment at 09:00 → end at 10:00', () => {
    const appt = makeAppt({ appointmentDateTime: '2099-01-01T09:00:00', durationMinutes: 60 });
    const { start, end } = getAppointmentInterval(appt);
    expect(start.getHours()).toBe(9);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(10);
    expect(end.getMinutes()).toBe(0);
  });

  it('90-min appointment at 10:30 → end at 12:00', () => {
    const appt = makeAppt({ appointmentDateTime: '2099-01-01T10:30:00', durationMinutes: 90 });
    const { start, end } = getAppointmentInterval(appt);
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(30);
    expect(end.getHours()).toBe(12);
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
        therapistId: 'therapist-1',
        appointmentDateTime: '2099-01-14T09:30:00',
        durationMinutes: 60,
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
        therapistId: 'therapist-1',
        appointmentDateTime: '2099-01-14T10:00:00',
        durationMinutes: 60,
        status: 'Cancelled',
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
        therapistId: 'therapist-1',
        appointmentDateTime: '2099-01-14T10:00:00',
        durationMinutes: 60,
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
        therapistId: 'therapist-1',
        appointmentDateTime: '2099-01-14T10:00:00',
        durationMinutes: 60,
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

// ─── getNextAppointment ───────────────────────────────────────────────────────

describe('getNextAppointment', () => {
  it('returns earliest upcoming scheduled appointment', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', appointmentDateTime: '2099-03-01T10:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'a2', customerId: 'cust-1', appointmentDateTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
    ];
    const result = getNextAppointment('cust-1', appts);
    expect(result?.id).toBe('a2');
  });

  it('returns null when no upcoming scheduled appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', appointmentDateTime: '2000-01-01T10:00:00', status: 'Completed' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('returns null for empty list', () => {
    expect(getNextAppointment('cust-1', [])).toBeNull();
  });

  it('ignores cancelled appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', appointmentDateTime: '2099-02-01T10:00:00', status: 'Cancelled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('ignores past appointments', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', appointmentDateTime: '2000-01-01T10:00:00', status: 'Scheduled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('ignores appointments for other customers', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-2', appointmentDateTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
    ];
    expect(getNextAppointment('cust-1', appts)).toBeNull();
  });

  it('returns appointment for specific customer only', () => {
    const appts: Appointment[] = [
      makeAppt({ id: 'a1', customerId: 'cust-1', appointmentDateTime: '2099-02-01T10:00:00', status: 'Scheduled' }),
      makeAppt({ id: 'a2', customerId: 'cust-2', appointmentDateTime: '2099-01-01T10:00:00', status: 'Scheduled' }),
    ];
    const result = getNextAppointment('cust-1', appts);
    expect(result?.id).toBe('a1');
  });
});
