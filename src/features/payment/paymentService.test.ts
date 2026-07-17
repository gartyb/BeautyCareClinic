import { describe, it, expect } from 'vitest';
import { buildPayment, applyPaymentToOrder } from './paymentService';
import { DomainError } from '../../domain/errors';
import type { CustomerOrder } from '../../types/Order';
import type { User } from '../../types/User';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const therapist: User = { id: 'user-therapist-1', fullName: 'מיכל לוי', email: 'therapist@clinic.com', role: 'Therapist' };

const testDeps = {
  newId: () => 'payment-test-id',
  now: () => '2026-01-15T10:00:00.000Z',
};

function makeOrder(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: 'order-test',
    customerId: 'cust-1',
    totalPrice: '1000.00',
    amountPaid: '0.00',
    remainingBalance: '1000.00',
    maxPaymentCount: 3,
    paymentCount: 0,
    orderItems: [],
    createdDate: '2026-01-01',
    createdByUserId: 'user-manager-1',
    ...overrides,
  };
}

// ─── buildPayment ─────────────────────────────────────────────────────────────

describe('buildPayment', () => {
  it('returns a Payment with correct shape', () => {
    const payment = buildPayment('order-test', '300.00', 'Cash', '2026-01-15', therapist, testDeps);

    expect(payment.id).toBe('payment-test-id');
    expect(payment.customerOrderId).toBe('order-test');
    expect(payment.amount).toBe('300.00');
    expect(payment.method).toBe('Cash');
    expect(payment.paymentDate).toBe('2026-01-15');
    expect(payment.createdDate).toBe('2026-01-15T10:00:00.000Z');
    expect(payment.createdByUserId).toBe('user-therapist-1');
  });

  it('uses Credit Card method correctly', () => {
    const payment = buildPayment('order-test', '500.00', 'Credit Card', '2026-01-15', therapist, testDeps);
    expect(payment.method).toBe('Credit Card');
  });

  it('uses Bank Transfer method correctly', () => {
    const payment = buildPayment('order-test', '200.00', 'Bank Transfer', '2026-01-20', therapist, testDeps);
    expect(payment.method).toBe('Bank Transfer');
  });

  it('uses Other method correctly', () => {
    const payment = buildPayment('order-test', '100.00', 'Other', '2026-01-20', therapist, testDeps);
    expect(payment.method).toBe('Other');
  });
});

// ─── applyPaymentToOrder ──────────────────────────────────────────────────────

describe('applyPaymentToOrder', () => {
  it('increases amountPaid by payment amount', () => {
    const order = makeOrder({ amountPaid: '200.00', remainingBalance: '800.00' });
    const payment = buildPayment('order-test', '300.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    expect(updated.amountPaid).toBe('500.00');
  });

  it('decreases remainingBalance by payment amount', () => {
    const order = makeOrder({ amountPaid: '200.00', remainingBalance: '800.00' });
    const payment = buildPayment('order-test', '300.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    expect(updated.remainingBalance).toBe('500.00');
  });

  it('increments paymentCount by 1', () => {
    const order = makeOrder({ paymentCount: 1 });
    const payment = buildPayment('order-test', '300.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    expect(updated.paymentCount).toBe(2);
  });

  it('does not mutate the original order', () => {
    const order = makeOrder({ amountPaid: '0.00', remainingBalance: '1000.00', paymentCount: 0 });
    const payment = buildPayment('order-test', '500.00', 'Cash', '2026-01-15', therapist, testDeps);
    applyPaymentToOrder(order, payment);

    expect(order.amountPaid).toBe('0.00');
    expect(order.paymentCount).toBe(0);
  });

  it('sets remainingBalance to 0.00 on full payment', () => {
    const order = makeOrder({ amountPaid: '700.00', remainingBalance: '300.00', paymentCount: 2 });
    const payment = buildPayment('order-test', '300.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    expect(updated.remainingBalance).toBe('0.00');
    expect(updated.amountPaid).toBe('1000.00');
  });

  it('throws DomainError with code OVERPAYMENT when payment exceeds remaining balance', () => {
    const order = makeOrder({ amountPaid: '900.00', remainingBalance: '100.00', paymentCount: 2 });
    const payment = buildPayment('order-test', '200.00', 'Cash', '2026-01-15', therapist, testDeps);

    expect(() => applyPaymentToOrder(order, payment)).toThrow(DomainError);
  });

  it('DomainError has correct code OVERPAYMENT', () => {
    const order = makeOrder({ amountPaid: '900.00', remainingBalance: '100.00', paymentCount: 2 });
    const payment = buildPayment('order-test', '200.00', 'Cash', '2026-01-15', therapist, testDeps);

    try {
      applyPaymentToOrder(order, payment);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('OVERPAYMENT');
    }
  });

  it('throws DomainError with code PAYMENT_COUNT_EXCEEDED when paymentCount >= maxPaymentCount', () => {
    const order = makeOrder({ paymentCount: 3, maxPaymentCount: 3 });
    const payment = buildPayment('order-test', '100.00', 'Cash', '2026-01-15', therapist, testDeps);

    expect(() => applyPaymentToOrder(order, payment)).toThrow(DomainError);
  });

  it('DomainError has correct code PAYMENT_COUNT_EXCEEDED', () => {
    const order = makeOrder({ paymentCount: 3, maxPaymentCount: 3 });
    const payment = buildPayment('order-test', '100.00', 'Cash', '2026-01-15', therapist, testDeps);

    try {
      applyPaymentToOrder(order, payment);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('PAYMENT_COUNT_EXCEEDED');
    }
  });

  it('allows payment when paymentCount is one less than maxPaymentCount', () => {
    const order = makeOrder({ paymentCount: 2, maxPaymentCount: 3, amountPaid: '600.00', remainingBalance: '400.00' });
    const payment = buildPayment('order-test', '400.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    expect(updated.paymentCount).toBe(3);
    expect(updated.remainingBalance).toBe('0.00');
  });

  // C3 fix: discountedPrice must take priority over originalPrice as the order total baseline
  it('uses discountedPrice (not originalPrice) as the total when both are present', () => {
    // 20% discount: originalPrice=1000, discountedPrice=800
    // Customer should only be charged up to 800, not 1000
    const order = makeOrder({
      totalPrice: undefined,
      originalPrice: 1000,
      discountedPrice: 800,
      amountPaid: '0.00',
      remainingBalance: '800.00',
      paymentCount: 0,
    });
    const payment = buildPayment('order-test', '800.00', 'Cash', '2026-01-15', therapist, testDeps);
    const updated = applyPaymentToOrder(order, payment);

    // Should succeed — 800 equals discountedPrice, not overpayment
    expect(updated.remainingBalance).toBe('0.00');
    expect(updated.amountPaid).toBe('800.00');
  });

  it('throws OVERPAYMENT when payment exceeds discountedPrice (not originalPrice)', () => {
    // 20% discount: originalPrice=1000, discountedPrice=800
    // Paying 900 must be rejected because the real total is 800
    const order = makeOrder({
      totalPrice: undefined,
      originalPrice: 1000,
      discountedPrice: 800,
      amountPaid: '0.00',
      remainingBalance: '800.00',
      paymentCount: 0,
    });
    const payment = buildPayment('order-test', '900.00', 'Cash', '2026-01-15', therapist, testDeps);

    try {
      applyPaymentToOrder(order, payment);
      expect.fail('should have thrown OVERPAYMENT');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('OVERPAYMENT');
    }
  });
});
