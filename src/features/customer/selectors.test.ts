import { describe, it, expect } from 'vitest';
import {
  outstandingBalance,
  activeSeries,
  completedTreatmentsForSeries,
  previousAppointment,
  nextAppointment,
} from './selectors';
import { CustomerOrder } from '../../types/Order';
import { TreatmentSeries } from '../../types/TreatmentSeries';
import { Appointment } from '../../types/Appointment';

// ─── outstandingBalance ───────────────────────────────────────────────────────

describe('outstandingBalance', () => {
  it('returns 0 for empty orders array', () => {
    expect(outstandingBalance([])).toBe(0);
  });

  it('returns 0 when all orders are fully paid', () => {
    const orders: CustomerOrder[] = [
      { id: 'o1', customerId: 'c1', totalPrice: '500', amountPaid: '500', remainingBalance: '0', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-01-01', createdByUserId: 'u1' },
      { id: 'o2', customerId: 'c1', totalPrice: '300', amountPaid: '300', remainingBalance: '0', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-02-01', createdByUserId: 'u1' },
    ];
    expect(outstandingBalance(orders)).toBe(0);
  });

  it('sums remainingBalance across open orders', () => {
    const orders: CustomerOrder[] = [
      { id: 'o1', customerId: 'c1', totalPrice: '500', amountPaid: '200', remainingBalance: '300', maxPaymentCount: 2, paymentCount: 1, orderItems: [], createdDate: '2025-01-01', createdByUserId: 'u1' },
      { id: 'o2', customerId: 'c1', totalPrice: '400', amountPaid: '400', remainingBalance: '0', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-02-01', createdByUserId: 'u1' },
      { id: 'o3', customerId: 'c1', totalPrice: '600', amountPaid: '100', remainingBalance: '500', maxPaymentCount: 3, paymentCount: 1, orderItems: [], createdDate: '2025-03-01', createdByUserId: 'u1' },
    ];
    expect(outstandingBalance(orders)).toBe(800);
  });

  it('handles decimal string values correctly', () => {
    const orders: CustomerOrder[] = [
      { id: 'o1', customerId: 'c1', totalPrice: '100.50', amountPaid: '50.25', remainingBalance: '50.25', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-01-01', createdByUserId: 'u1' },
    ];
    expect(outstandingBalance(orders)).toBeCloseTo(50.25);
  });

  it('handles floating point sums correctly across multiple orders', () => {
    const orders: CustomerOrder[] = [
      { id: 'o1', customerId: 'c1', totalPrice: '100', amountPaid: '66.67', remainingBalance: '33.33', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-01-01', createdByUserId: 'u1' },
      { id: 'o2', customerId: 'c1', totalPrice: '100', amountPaid: '66.67', remainingBalance: '33.33', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-02-01', createdByUserId: 'u1' },
      { id: 'o3', customerId: 'c1', totalPrice: '100', amountPaid: '66.66', remainingBalance: '33.34', maxPaymentCount: 1, paymentCount: 1, orderItems: [], createdDate: '2025-03-01', createdByUserId: 'u1' },
    ];
    const result = outstandingBalance(orders);
    expect(result).toBe(100);
    // Ensure no excessive decimal places from floating point accumulation
    expect(result.toString()).not.toMatch(/\.\d{3,}/);
  });
});

// ─── activeSeries ─────────────────────────────────────────────────────────────

describe('activeSeries', () => {
  it('returns empty array for empty input', () => {
    expect(activeSeries([])).toHaveLength(0);
  });

  it('filters out completed quantity series', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'quantity', totalTreatments: 5, completedTreatments: 5, createdDate: '2025-01-01' },
    ];
    expect(activeSeries(series)).toHaveLength(0);
  });

  it('includes active quantity series (not yet completed)', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'quantity', totalTreatments: 10, completedTreatments: 3, createdDate: '2025-01-01' },
    ];
    expect(activeSeries(series)).toHaveLength(1);
  });

  it('filters out completed timer series', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'timer', totalMinutes: 360, usedMinutes: 360, minutesPerTreatment: 60, createdDate: '2025-01-01' },
    ];
    expect(activeSeries(series)).toHaveLength(0);
  });

  it('includes active timer series (not yet used all minutes)', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'timer', totalMinutes: 360, usedMinutes: 90, minutesPerTreatment: 60, createdDate: '2025-01-01' },
    ];
    expect(activeSeries(series)).toHaveLength(1);
  });

  it('handles mixed series correctly', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'quantity', totalTreatments: 5, completedTreatments: 5, createdDate: '2025-01-01' }, // completed
      { id: 's2', orderItemId: 'oi2', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'quantity', totalTreatments: 10, completedTreatments: 2, createdDate: '2025-02-01' }, // active
      { id: 's3', orderItemId: 'oi3', packageTypeId: 'pt3', customerId: 'c1', seriesKind: 'timer', totalMinutes: 360, usedMinutes: 360, minutesPerTreatment: 60, createdDate: '2025-03-01' }, // completed
      { id: 's4', orderItemId: 'oi4', packageTypeId: 'pt3', customerId: 'c1', seriesKind: 'timer', totalMinutes: 360, usedMinutes: 120, minutesPerTreatment: 60, createdDate: '2025-04-01' }, // active
    ];
    const result = activeSeries(series);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(expect.arrayContaining(['s2', 's4']));
  });

  it('treats undefined completedTreatments as 0', () => {
    const series: TreatmentSeries[] = [
      { id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1', seriesKind: 'quantity', totalTreatments: 5, createdDate: '2025-01-01' },
    ];
    expect(activeSeries(series)).toHaveLength(1);
  });
});

// ─── completedTreatmentsForSeries ─────────────────────────────────────────────

describe('completedTreatmentsForSeries', () => {
  it('returns completedTreatments directly for quantity series', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1',
      seriesKind: 'quantity', totalTreatments: 10, completedTreatments: 4,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(4);
  });

  it('returns 0 for quantity series with no completedTreatments', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt1', customerId: 'c1',
      seriesKind: 'quantity', totalTreatments: 10,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(0);
  });

  it('computes floor(usedMinutes / minutesPerTreatment) for timer series', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt3', customerId: 'c1',
      seriesKind: 'timer', totalMinutes: 360, usedMinutes: 90, minutesPerTreatment: 60,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(1); // floor(90/60) = 1
  });

  it('floors the result for timer series', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt3', customerId: 'c1',
      seriesKind: 'timer', totalMinutes: 360, usedMinutes: 150, minutesPerTreatment: 60,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(2); // floor(150/60) = 2
  });

  it('returns 0 for timer series with no usedMinutes', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt3', customerId: 'c1',
      seriesKind: 'timer', totalMinutes: 360, minutesPerTreatment: 60,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(0);
  });

  it('returns 0 for timer series with missing minutesPerTreatment', () => {
    const s: TreatmentSeries = {
      id: 's1', orderItemId: 'oi1', packageTypeId: 'pt3', customerId: 'c1',
      seriesKind: 'timer', totalMinutes: 360, usedMinutes: 120,
      createdDate: '2025-01-01',
    };
    expect(completedTreatmentsForSeries(s)).toBe(0);
  });
});

// ─── previousAppointment / nextAppointment ────────────────────────────────────

// Use fixed dates relative to the mock data
const PAST_DATE_1 = '2020-01-15T10:00:00';
const PAST_DATE_2 = '2020-06-01T14:00:00';
const FUTURE_DATE_1 = '2099-08-10T10:00:00';
const FUTURE_DATE_2 = '2099-09-01T14:00:00';

function makeAppt(id: string, dateTime: string, status: Appointment['status']): Appointment {
  return {
    id,
    customerId: 'c1',
    treatmentTypeId: 'tt-1',
    therapistId: 'u1',
    appointmentDateTime: dateTime,
    status,
    createdDate: '2020-01-01',
  };
}

describe('previousAppointment', () => {
  it('returns null for empty list', () => {
    expect(previousAppointment([])).toBeNull();
  });

  it('returns null when all appointments are future', () => {
    const appts = [makeAppt('a1', FUTURE_DATE_1, 'Scheduled')];
    expect(previousAppointment(appts)).toBeNull();
  });

  it('returns the most recent past completed appointment', () => {
    const appts = [
      makeAppt('a1', PAST_DATE_1, 'Completed'),
      makeAppt('a2', PAST_DATE_2, 'Completed'),
    ];
    const result = previousAppointment(appts);
    expect(result?.id).toBe('a2');
  });

  it('excludes cancelled appointments from previous', () => {
    const appts = [
      makeAppt('a1', PAST_DATE_1, 'Completed'),
      makeAppt('a2', PAST_DATE_2, 'Cancelled'),
    ];
    const result = previousAppointment(appts);
    expect(result?.id).toBe('a1');
  });

  it('returns null when only past appointment is cancelled', () => {
    const appts = [makeAppt('a1', PAST_DATE_1, 'Cancelled')];
    expect(previousAppointment(appts)).toBeNull();
  });

  it('excludes past Scheduled (no-show) appointments from previousAppointment', () => {
    const appts = [makeAppt('a1', PAST_DATE_1, 'Scheduled')];
    expect(previousAppointment(appts)).toBeNull();
  });
});

describe('nextAppointment', () => {
  it('returns null for empty list', () => {
    expect(nextAppointment([])).toBeNull();
  });

  it('returns null when all appointments are past', () => {
    const appts = [makeAppt('a1', PAST_DATE_1, 'Completed')];
    expect(nextAppointment(appts)).toBeNull();
  });

  it('returns the earliest future scheduled appointment', () => {
    const appts = [
      makeAppt('a1', FUTURE_DATE_2, 'Scheduled'),
      makeAppt('a2', FUTURE_DATE_1, 'Scheduled'),
    ];
    const result = nextAppointment(appts);
    expect(result?.id).toBe('a2');
  });

  it('excludes cancelled future appointments', () => {
    const appts = [
      makeAppt('a1', FUTURE_DATE_1, 'Cancelled'),
      makeAppt('a2', FUTURE_DATE_2, 'Scheduled'),
    ];
    const result = nextAppointment(appts);
    expect(result?.id).toBe('a2');
  });

  it('returns null when only future appointment is cancelled', () => {
    const appts = [makeAppt('a1', FUTURE_DATE_1, 'Cancelled')];
    expect(nextAppointment(appts)).toBeNull();
  });
});
