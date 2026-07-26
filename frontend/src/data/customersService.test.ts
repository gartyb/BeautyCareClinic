import { describe, it, expect } from 'vitest';
import { searchCustomers } from './customersService';

describe('searchCustomers', () => {
  it('returns empty array for empty query', () => {
    expect(searchCustomers('')).toHaveLength(0);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchCustomers('   ')).toHaveLength(0);
  });

  it('finds customer by Hebrew first name', () => {
    const results = searchCustomers('רחל');
    expect(results.some(c => c.id === 'cust-1')).toBe(true);
  });

  it('finds customer by Hebrew last name', () => {
    const results = searchCustomers('אברהם');
    expect(results.some(c => c.id === 'cust-1')).toBe(true);
  });

  it('finds customer by full name', () => {
    const results = searchCustomers('דנה שפירא');
    expect(results.some(c => c.id === 'cust-2')).toBe(true);
  });

  it('finds customer by phone prefix', () => {
    const results = searchCustomers('050');
    // cust-1 has 0501234567, cust-5 has 0503334455
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(c => c.id === 'cust-1')).toBe(true);
  });

  it('finds customer by partial phone number', () => {
    const results = searchCustomers('1234567');
    expect(results.some(c => c.id === 'cust-1')).toBe(true);
  });

  it('returns empty array when no customers match', () => {
    const results = searchCustomers('xxxxxxnonexistent');
    expect(results).toHaveLength(0);
  });

  it('partial name match works', () => {
    const results = searchCustomers('נוע');
    expect(results.some(c => c.id === 'cust-5')).toBe(true);
  });

  it('returned items have expected CustomerSummary shape', () => {
    const results = searchCustomers('רחל');
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('fullName');
    expect(results[0]).toHaveProperty('phone');
    expect(results[0]).toHaveProperty('email');
  });
});
