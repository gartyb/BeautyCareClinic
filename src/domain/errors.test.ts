import { describe, it, expect } from 'vitest';
import { DomainError } from './errors';

describe('DomainError', () => {
  it('is an instance of Error', () => {
    const err = new DomainError('TEST_CODE', 'test message');
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct code property', () => {
    const err = new DomainError('PAYMENT_COUNT_EXCEEDED', 'תשלום נדחה');
    expect(err.code).toBe('PAYMENT_COUNT_EXCEEDED');
  });

  it('has name equal to DomainError', () => {
    const err = new DomainError('ANY_CODE', 'any message');
    expect(err.name).toBe('DomainError');
  });

  it('has the correct message', () => {
    const err = new DomainError('CODE', 'my error message');
    expect(err.message).toBe('my error message');
  });

  it('is an instance of DomainError', () => {
    const err = new DomainError('CODE', 'msg');
    expect(err).toBeInstanceOf(DomainError);
  });
});
