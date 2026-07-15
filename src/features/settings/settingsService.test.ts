import { describe, it, expect } from 'vitest';
import { updateDefaultMaxPaymentCount } from './settingsService';
import { DomainError } from '../../domain/errors';

describe('updateDefaultMaxPaymentCount — validation', () => {
  it('throws SETTINGS_INVALID_MAX_PAYMENT_COUNT when value is 0', () => {
    expect.assertions(2);
    try {
      updateDefaultMaxPaymentCount(0);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('SETTINGS_INVALID_MAX_PAYMENT_COUNT');
    }
  });

  it('throws SETTINGS_INVALID_MAX_PAYMENT_COUNT when value is negative', () => {
    expect.assertions(2);
    try {
      updateDefaultMaxPaymentCount(-1);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('SETTINGS_INVALID_MAX_PAYMENT_COUNT');
    }
  });

  it('throws SETTINGS_INVALID_MAX_PAYMENT_COUNT when value is a float', () => {
    expect.assertions(2);
    try {
      updateDefaultMaxPaymentCount(1.5);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('SETTINGS_INVALID_MAX_PAYMENT_COUNT');
    }
  });

  it('throws SETTINGS_INVALID_MAX_PAYMENT_COUNT when value is NaN', () => {
    expect.assertions(2);
    try {
      updateDefaultMaxPaymentCount(NaN);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('SETTINGS_INVALID_MAX_PAYMENT_COUNT');
    }
  });

  it('throws SETTINGS_INVALID_MAX_PAYMENT_COUNT when value exceeds 24', () => {
    expect.assertions(2);
    try {
      updateDefaultMaxPaymentCount(25);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('SETTINGS_INVALID_MAX_PAYMENT_COUNT');
    }
  });
});

describe('updateDefaultMaxPaymentCount — happy path', () => {
  it('returns valid positive integer', () => {
    expect(updateDefaultMaxPaymentCount(5)).toBe(5);
  });

  it('returns 1 (minimum valid value)', () => {
    expect(updateDefaultMaxPaymentCount(1)).toBe(1);
  });

  it('returns 24 (maximum valid value)', () => {
    expect(updateDefaultMaxPaymentCount(24)).toBe(24);
  });
});
