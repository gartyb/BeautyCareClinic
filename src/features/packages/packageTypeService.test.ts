import { describe, it, expect } from 'vitest';
import { buildPackageType, updatePackageType, deletePackageType } from './packageTypeService';
import { DomainError } from '../../domain/errors';
import type { PackageType } from '../../types/PackageType';

const testDeps = { newId: () => 'test-pkg-id' };

const baseSeries: PackageType = {
  id: 'pkg-1',
  name: 'סדרת פנים',
  treatmentTypeId: 'tt-1',
  price: '350',
  isSeries: true,
  treatmentCount: 10,
  isTimerBased: false,
};

const baseNonSeries: PackageType = {
  id: 'pkg-2',
  name: 'טיפול בודד',
  treatmentTypeId: 'tt-1',
  price: '200',
  isSeries: false,
  isTimerBased: false,
};

describe('buildPackageType — validation', () => {
  it('throws PACKAGE_NAME_REQUIRED when name is empty', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: '', treatmentTypeId: 'tt-1', price: '100', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_NAME_REQUIRED');
    }
  });

  it('throws PACKAGE_NAME_REQUIRED when name is whitespace', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: '   ', treatmentTypeId: 'tt-1', price: '100', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_NAME_REQUIRED');
    }
  });

  it('throws PACKAGE_TREATMENT_TYPE_REQUIRED when treatmentTypeId is empty', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: '', price: '100', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_TREATMENT_TYPE_REQUIRED');
    }
  });

  it('throws PACKAGE_INVALID_PRICE when price is NaN string', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: 'abc', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_INVALID_PRICE');
    }
  });

  it('throws PACKAGE_INVALID_PRICE when price is negative', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: '-1', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_INVALID_PRICE');
    }
  });

  it('throws PACKAGE_TIMER_REQUIRES_SERIES when isTimerBased and not isSeries', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: '100', isSeries: false, isTimerBased: true }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_TIMER_REQUIRES_SERIES');
    }
  });

  it('throws PACKAGE_TREATMENT_COUNT_REQUIRED when isSeries and treatmentCount is 0', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: '100', isSeries: true, treatmentCount: 0 }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_TREATMENT_COUNT_REQUIRED');
    }
  });

  it('throws PACKAGE_TREATMENT_COUNT_REQUIRED when isSeries and treatmentCount missing', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: '100', isSeries: true }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_TREATMENT_COUNT_REQUIRED');
    }
  });

  it('throws PACKAGE_MINUTES_REQUIRED when isTimerBased and minutesPerTreatment is 0', () => {
    expect.assertions(2);
    try {
      buildPackageType({
        name: 'חבילה', treatmentTypeId: 'tt-1', price: '100',
        isSeries: true, treatmentCount: 5, isTimerBased: true, minutesPerTreatment: 0
      }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_MINUTES_REQUIRED');
    }
  });

  it('throws PACKAGE_MINUTES_REQUIRED when isTimerBased and minutesPerTreatment missing', () => {
    expect.assertions(2);
    try {
      buildPackageType({
        name: 'חבילה', treatmentTypeId: 'tt-1', price: '100',
        isSeries: true, treatmentCount: 5, isTimerBased: true
      }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_MINUTES_REQUIRED');
    }
  });

  it('throws PACKAGE_INVALID_PRICE for Infinity', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: 'Infinity', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_INVALID_PRICE');
    }
  });

  it('throws PACKAGE_PRICE_TOO_HIGH when price exceeds 999999', () => {
    expect.assertions(2);
    try {
      buildPackageType({ name: 'חבילה', treatmentTypeId: 'tt-1', price: '1000000', isSeries: false }, testDeps);
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('PACKAGE_PRICE_TOO_HIGH');
    }
  });
});

describe('buildPackageType — happy path', () => {
  it('builds non-series package', () => {
    const pkg = buildPackageType({
      name: 'טיפול בודד', treatmentTypeId: 'tt-1', price: '200', isSeries: false
    }, testDeps);
    expect(pkg.id).toBe('test-pkg-id');
    expect(pkg.name).toBe('טיפול בודד');
    expect(pkg.isSeries).toBe(false);
    expect(pkg.treatmentCount).toBeUndefined();
  });

  it('builds series quantity package', () => {
    const pkg = buildPackageType({
      name: 'סדרה', treatmentTypeId: 'tt-1', price: '350', isSeries: true, treatmentCount: 10
    }, testDeps);
    expect(pkg.isSeries).toBe(true);
    expect(pkg.treatmentCount).toBe(10);
    expect(pkg.isTimerBased).toBe(false);
  });

  it('builds timer series package', () => {
    const pkg = buildPackageType({
      name: 'עיסוי', treatmentTypeId: 'tt-3', price: '480',
      isSeries: true, treatmentCount: 6, isTimerBased: true, minutesPerTreatment: 60
    }, testDeps);
    expect(pkg.isTimerBased).toBe(true);
    expect(pkg.minutesPerTreatment).toBe(60);
    expect(pkg.treatmentCount).toBe(6);
  });

  it('trims name whitespace', () => {
    const pkg = buildPackageType({
      name: '  סדרה  ', treatmentTypeId: 'tt-1', price: '100', isSeries: true, treatmentCount: 5
    }, testDeps);
    expect(pkg.name).toBe('סדרה');
  });

  it('canonicalizes price to 2 decimal places (123.456 → 123.46)', () => {
    const pkg = buildPackageType({
      name: 'חבילה', treatmentTypeId: 'tt-1', price: '123.456', isSeries: false
    }, testDeps);
    expect(pkg.price).toBe('123.46');
  });

  it('canonicalizes whole number price (200 → 200.00)', () => {
    const pkg = buildPackageType({
      name: 'חבילה', treatmentTypeId: 'tt-1', price: '200', isSeries: false
    }, testDeps);
    expect(pkg.price).toBe('200.00');
  });
});

describe('updatePackageType', () => {
  it('replaces the matching package immutably', () => {
    const list = [baseSeries, baseNonSeries];
    const updated = { ...baseSeries, name: 'שם חדש' };
    const result = updatePackageType('pkg-1', updated, list);
    expect(result[0].name).toBe('שם חדש');
    expect(result[1]).toBe(baseNonSeries);
    expect(list[0].name).toBe('סדרת פנים'); // original unchanged
  });

  it('preserves id even if updated object has different id field', () => {
    const list = [baseSeries];
    const updated = { ...baseSeries, id: 'wrong-id', name: 'שם חדש' };
    const result = updatePackageType('pkg-1', updated, list);
    expect(result[0].id).toBe('pkg-1');
  });
});

describe('deletePackageType', () => {
  it('removes the matching package immutably', () => {
    const list = [baseSeries, baseNonSeries];
    const result = deletePackageType('pkg-1', list);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pkg-2');
    expect(list).toHaveLength(2); // original unchanged
  });

  it('returns same array when id not found', () => {
    const list = [baseSeries];
    const result = deletePackageType('unknown', list);
    expect(result).toHaveLength(1);
  });
});
