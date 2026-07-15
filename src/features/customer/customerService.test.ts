import { describe, it, expect } from 'vitest';
import { buildCustomer } from './customerService';
import { DomainError } from '../../domain/errors';

const testDeps = {
  newId: () => 'test-cust-id',
  today: () => '2026-07-15',
};

describe('buildCustomer — validation', () => {
  it('throws CUSTOMER_NAME_REQUIRED when fullName is empty', () => {
    expect(() => buildCustomer('', '0501234567', undefined, testDeps))
      .toThrow(DomainError);
    try {
      buildCustomer('', '0501234567', undefined, testDeps);
    } catch (e) {
      expect((e as DomainError).code).toBe('CUSTOMER_NAME_REQUIRED');
    }
  });

  it('throws CUSTOMER_NAME_REQUIRED when fullName is whitespace', () => {
    expect(() => buildCustomer('   ', '0501234567', undefined, testDeps))
      .toThrow(DomainError);
    try {
      buildCustomer('   ', '0501234567', undefined, testDeps);
    } catch (e) {
      expect((e as DomainError).code).toBe('CUSTOMER_NAME_REQUIRED');
    }
  });

  it('throws CUSTOMER_PHONE_REQUIRED when phone is empty', () => {
    expect(() => buildCustomer('רחל אברהם', '', undefined, testDeps))
      .toThrow(DomainError);
    try {
      buildCustomer('רחל אברהם', '', undefined, testDeps);
    } catch (e) {
      expect((e as DomainError).code).toBe('CUSTOMER_PHONE_REQUIRED');
    }
  });

  it('throws CUSTOMER_PHONE_REQUIRED when phone is whitespace', () => {
    expect(() => buildCustomer('רחל אברהם', '   ', undefined, testDeps))
      .toThrow(DomainError);
    try {
      buildCustomer('רחל אברהם', '   ', undefined, testDeps);
    } catch (e) {
      expect((e as DomainError).code).toBe('CUSTOMER_PHONE_REQUIRED');
    }
  });

  it('throws CUSTOMER_NAME_TOO_LONG when fullName exceeds 80 chars', () => {
    expect.assertions(2);
    const longName = 'א'.repeat(81);
    try {
      buildCustomer(longName, '0501234567', undefined, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CUSTOMER_NAME_TOO_LONG');
    }
  });

  it('throws CUSTOMER_PHONE_INVALID when phone has invalid format', () => {
    expect.assertions(2);
    try {
      buildCustomer('רחל אברהם', 'abc!@#', undefined, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CUSTOMER_PHONE_INVALID');
    }
  });

  it('throws CUSTOMER_PHONE_INVALID when phone has fewer than 7 digits', () => {
    expect.assertions(2);
    try {
      buildCustomer('רחל אברהם', '12345', undefined, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CUSTOMER_PHONE_INVALID');
    }
  });

  it('throws CUSTOMER_EMAIL_INVALID when email has invalid format', () => {
    expect.assertions(2);
    try {
      buildCustomer('רחל אברהם', '0501234567', 'not-an-email', testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CUSTOMER_EMAIL_INVALID');
    }
  });

  it('throws CUSTOMER_EMAIL_INVALID when email exceeds 120 chars', () => {
    expect.assertions(2);
    const longEmail = 'a'.repeat(115) + '@test.com'; // 115 + 9 = 124 chars, exceeds 120
    try {
      buildCustomer('רחל אברהם', '0501234567', longEmail, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('CUSTOMER_EMAIL_INVALID');
    }
  });

  it('does not throw when email is omitted', () => {
    expect(() => buildCustomer('רחל אברהם', '0501234567', undefined, testDeps)).not.toThrow();
  });

  it('does not throw when email is empty string', () => {
    expect(() => buildCustomer('רחל אברהם', '0501234567', '', testDeps)).not.toThrow();
  });
});

describe('buildCustomer — happy path', () => {
  it('builds customer with first and last name split on first space', () => {
    const customer = buildCustomer('רחל אברהם', '0501234567', undefined, testDeps);
    expect(customer.firstName).toBe('רחל');
    expect(customer.lastName).toBe('אברהם');
  });

  it('handles single-word name (no space)', () => {
    const customer = buildCustomer('שרה', '0500000001', undefined, testDeps);
    expect(customer.firstName).toBe('שרה');
    expect(customer.lastName).toBe('');
  });

  it('handles multi-word last name (only splits on first space)', () => {
    const customer = buildCustomer('מרים בן דוד', '0501111111', undefined, testDeps);
    expect(customer.firstName).toBe('מרים');
    expect(customer.lastName).toBe('בן דוד');
  });

  it('sets phone correctly', () => {
    const customer = buildCustomer('רחל אברהם', '0501234567', undefined, testDeps);
    expect(customer.phone).toBe('0501234567');
  });

  it('sets optional email when provided', () => {
    const customer = buildCustomer('רחל אברהם', '0501234567', 'rachel@test.com', testDeps);
    expect(customer.email).toBe('rachel@test.com');
  });

  it('sets email to empty string when not provided', () => {
    const customer = buildCustomer('רחל אברהם', '0501234567', undefined, testDeps);
    expect(customer.email).toBe('');
  });

  it('uses injected newId and today', () => {
    const customer = buildCustomer('רחל אברהם', '0501234567', undefined, testDeps);
    expect(customer.id).toBe('test-cust-id');
    expect(customer.createdDate).toBe('2026-07-15');
  });

  it('trims whitespace from inputs', () => {
    const customer = buildCustomer('  רחל אברהם  ', '  0501234567  ', undefined, testDeps);
    expect(customer.firstName).toBe('רחל');
    expect(customer.phone).toBe('0501234567');
  });
});
