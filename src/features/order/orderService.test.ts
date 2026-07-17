import { describe, it, expect } from 'vitest';
import { buildNewOrder } from './orderService';
import type { PackageType } from '../../types/PackageType';
import type { User } from '../../types/User';

const DEFAULT_MAX_PAYMENT_COUNT = 3;

// ─── Test fixtures ────────────────────────────────────────────────────────────

const manager: User = { id: 'user-manager-1', fullName: 'שרה כהן', email: 'manager@clinic.com', role: 'Manager' };
const therapist: User = { id: 'user-therapist-1', fullName: 'מיכל לוי', email: 'therapist@clinic.com', role: 'Therapist' };

const nonSeriesPkg: PackageType = {
  id: 'pt-non-series',
  name: 'טיפול בודד',
  treatmentTypeId: 'tt-1',
  price: '200',
  isSeries: false,
  isTimerBased: false,
};

const quantitySeriesPkg: PackageType = {
  id: 'pt-quantity',
  name: 'סדרת פנים',
  treatmentTypeId: 'tt-1',
  price: '350',
  isSeries: true,
  isTimerBased: false,
  treatmentCount: 10,
};

const timerSeriesPkg: PackageType = {
  id: 'pt-timer',
  name: 'עיסוי שוודי',
  treatmentTypeId: 'tt-3',
  price: '480',
  isSeries: true,
  isTimerBased: true,
  treatmentCount: 6,
  minutesPerTreatment: 60,
};

// Deterministic deps for testing
let idCounter = 0;
const testDeps = {
  newId: () => `test-id-${++idCounter}`,
  now: () => '2026-01-01T00:00:00.000Z',
};

function resetCounter() {
  idCounter = 0;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildNewOrder — non-series package', () => {
  it('creates order with correct total price and no series', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);

    expect(result.order.totalPrice).toBe('200.00');
    expect(result.order.amountPaid).toBe('0.00');
    expect(result.order.remainingBalance).toBe('200.00');
    expect(result.order.customerId).toBe('cust-1');
    expect(result.series).toHaveLength(0);
  });

  it('creates order item with no treatmentSeriesId for non-series package', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);

    expect(result.order.orderItems).toHaveLength(1);
    expect(result.order.orderItems![0].packageTypeId).toBe('pt-non-series');
    expect(result.order.orderItems![0].treatmentSeriesId).toBeUndefined();
  });

  it('sets createdByUserId from currentUser', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.createdByUserId).toBe('user-therapist-1');
  });
});

describe('buildNewOrder — quantity series package', () => {
  it('creates series with seriesKind quantity and completedTreatments 0', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-quantity'], [quantitySeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);

    expect(result.series).toHaveLength(1);
    const s = result.series[0];
    expect(s.seriesKind).toBe('quantity');
    expect(s.completedTreatments).toBe(0);
    expect(s.totalTreatments).toBe(10);
    expect(s.customerId).toBe('cust-1');
  });

  it('links OrderItem.treatmentSeriesId to the created series id', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-quantity'], [quantitySeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);

    const item = result.order.orderItems![0];
    expect(item.treatmentSeriesId).toBe(result.series[0].id);
  });

  it('sets correct total price', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-quantity'], [quantitySeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.totalPrice).toBe('350.00');
  });
});

describe('buildNewOrder — timer series package', () => {
  it('creates series with seriesKind timer and usedMinutes 0', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-timer'], [timerSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);

    expect(result.series).toHaveLength(1);
    const s = result.series[0];
    expect(s.seriesKind).toBe('timer');
    expect(s.usedMinutes).toBe(0);
    expect(s.minutesPerTreatment).toBe(60);
    // totalMinutes = treatmentCount * minutesPerTreatment = 6 * 60 = 360
    expect(s.totalMinutes).toBe(360);
  });

  it('does not set completedTreatments for timer series', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-timer'], [timerSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.series[0].completedTreatments).toBeUndefined();
    expect(result.series[0].totalTreatments).toBeUndefined();
  });
});

describe('buildNewOrder — multiple packages', () => {
  it('sums totalPrice across all selected packages', () => {
    resetCounter();
    const allPkgs = [nonSeriesPkg, quantitySeriesPkg, timerSeriesPkg];
    const result = buildNewOrder(
      'cust-1',
      ['pt-non-series', 'pt-quantity', 'pt-timer'],
      allPkgs,
      therapist,
      DEFAULT_MAX_PAYMENT_COUNT,
      undefined,
      testDeps
    );

    // 200 + 350 + 480 = 1030
    expect(result.order.totalPrice).toBe('1030.00');
    expect(result.order.orderItems).toHaveLength(3);
    expect(result.series).toHaveLength(2); // only 2 series packages
  });

  it('links each order item to its correct packageTypeId', () => {
    resetCounter();
    const allPkgs = [nonSeriesPkg, quantitySeriesPkg];
    const result = buildNewOrder(
      'cust-1',
      ['pt-non-series', 'pt-quantity'],
      allPkgs,
      therapist,
      DEFAULT_MAX_PAYMENT_COUNT,
      undefined,
      testDeps
    );

    const pkgIds = (result.order.orderItems ?? []).map(i => i.packageTypeId);
    expect(pkgIds).toContain('pt-non-series');
    expect(pkgIds).toContain('pt-quantity');
  });
});

describe('buildNewOrder — maxPaymentCount', () => {
  it('uses DEFAULT_MAX_PAYMENT_COUNT when no override given', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.maxPaymentCount).toBe(DEFAULT_MAX_PAYMENT_COUNT);
  });

  it('uses override value when provided (Manager)', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], manager, DEFAULT_MAX_PAYMENT_COUNT, 5, testDeps);
    expect(result.order.maxPaymentCount).toBe(5);
  });

  it('initialises paymentCount to 0', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.paymentCount).toBe(0);
  });
});

describe('buildNewOrder — deps injection', () => {
  it('uses injected newId and now for deterministic output', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-non-series'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.id).toBe('test-id-1');
    expect(result.order.createdDate).toBe('2026-01-01T00:00:00.000Z');
  });

  it('skips unrecognised package type ids silently', () => {
    resetCounter();
    const result = buildNewOrder('cust-1', ['pt-unknown'], [nonSeriesPkg], therapist, DEFAULT_MAX_PAYMENT_COUNT, undefined, testDeps);
    expect(result.order.orderItems).toHaveLength(0);
    expect(result.order.totalPrice).toBe('0.00');
  });
});
