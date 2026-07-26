import { describe, it, expect } from 'vitest';
import {
  toFloorMinutes,
  buildTimerTreatment,
  buildQuantityTreatment,
  applyTimerTreatmentToSeries,
  applyQuantityTreatmentToSeries,
  buildTreatmentPhoto,
} from './treatmentService';
import { DomainError } from '../../domain/errors';
import type { TreatmentSeries } from '../../types/TreatmentSeries';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const testDeps = {
  newId: () => 'test-treatment-id',
  now: () => '2026-07-14',
};

function makeTimerSeries(overrides: Partial<TreatmentSeries> = {}): TreatmentSeries {
  return {
    id: 'series-timer-1',
    orderItemId: 'oi-1',
    packageTypeId: 'pt-3',
    customerId: 'cust-1',
    seriesKind: 'timer',
    totalMinutes: 360,
    usedMinutes: 0,
    minutesPerTreatment: 60,
    createdDate: '2026-01-01',
    ...overrides,
  };
}

function makeQuantitySeries(overrides: Partial<TreatmentSeries> = {}): TreatmentSeries {
  return {
    id: 'series-qty-1',
    orderItemId: 'oi-2',
    packageTypeId: 'pt-1',
    customerId: 'cust-1',
    seriesKind: 'quantity',
    totalTreatments: 10,
    completedTreatments: 0,
    createdDate: '2026-01-01',
    ...overrides,
  };
}

// ─── toFloorMinutes ───────────────────────────────────────────────────────────

describe('toFloorMinutes', () => {
  it('returns 0 for 0 seconds', () => {
    expect(toFloorMinutes(0)).toBe(0);
  });

  it('returns 0 for 1 second (floor)', () => {
    expect(toFloorMinutes(1)).toBe(0);
  });

  it('returns 0 for 59 seconds (floor)', () => {
    expect(toFloorMinutes(59)).toBe(0);
  });

  it('returns 1 for exactly 60 seconds', () => {
    expect(toFloorMinutes(60)).toBe(1);
  });

  it('returns 1 for 61 seconds (floor)', () => {
    expect(toFloorMinutes(61)).toBe(1);
  });

  it('returns 1 for 119 seconds (floor)', () => {
    expect(toFloorMinutes(119)).toBe(1);
  });

  it('returns 2 for 120 seconds', () => {
    expect(toFloorMinutes(120)).toBe(2);
  });

  it('returns 0 for negative seconds', () => {
    expect(toFloorMinutes(-5)).toBe(0);
  });

  it('returns 60 for 3600 seconds (1 hour)', () => {
    expect(toFloorMinutes(3600)).toBe(60);
  });

  it('returns 0 for NaN', () => {
    expect(toFloorMinutes(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(toFloorMinutes(Infinity)).toBe(0);
  });

  it('returns 0 for -Infinity', () => {
    expect(toFloorMinutes(-Infinity)).toBe(0);
  });

  it('returns 0 for -1', () => {
    expect(toFloorMinutes(-1)).toBe(0);
  });
});

// ─── buildTimerTreatment ──────────────────────────────────────────────────────

describe('buildTimerTreatment', () => {
  it('creates a Treatment with correct fields', () => {
    const treatment = buildTimerTreatment(
      {
        seriesId: 'series-1',
        customerId: 'cust-1',
        treatmentTypeId: 'tt-3',
        therapistId: 'user-therapist-1',
        durationMinutes: 60,
      },
      testDeps
    );

    expect(treatment.id).toBe('test-treatment-id');
    expect(treatment.customerId).toBe('cust-1');
    expect(treatment.treatmentTypeId).toBe('tt-3');
    expect(treatment.treatmentSeriesId).toBe('series-1');
    expect(treatment.treatmentDate).toBe('2026-07-14');
    expect(treatment.durationMinutes).toBe(60);
    expect(treatment.therapistId).toBe('user-therapist-1');
    expect(treatment.treatmentPhotos).toEqual([]);
  });

  it('does not set notes by default', () => {
    const treatment = buildTimerTreatment(
      {
        seriesId: 'series-1',
        customerId: 'cust-1',
        treatmentTypeId: 'tt-3',
        therapistId: 'user-1',
        durationMinutes: 45,
      },
      testDeps
    );
    expect(treatment.notes).toBeUndefined();
  });

  it('uses injected newId', () => {
    const deps = { ...testDeps, newId: () => 'custom-id-abc' };
    const treatment = buildTimerTreatment(
      { seriesId: 's1', customerId: 'c1', treatmentTypeId: 'tt1', therapistId: 'u1', durationMinutes: 30 },
      deps
    );
    expect(treatment.id).toBe('custom-id-abc');
  });

  it('uses injected now for treatmentDate', () => {
    const deps = { ...testDeps, now: () => '2025-12-25' };
    const treatment = buildTimerTreatment(
      { seriesId: 's1', customerId: 'c1', treatmentTypeId: 'tt1', therapistId: 'u1', durationMinutes: 30 },
      deps
    );
    expect(treatment.treatmentDate).toBe('2025-12-25');
  });
});

// ─── buildQuantityTreatment ───────────────────────────────────────────────────

describe('buildQuantityTreatment', () => {
  it('creates a Treatment with correct fields and no durationMinutes', () => {
    const treatment = buildQuantityTreatment(
      {
        seriesId: 'series-2',
        customerId: 'cust-2',
        treatmentTypeId: 'tt-1',
        therapistId: 'user-therapist-2',
      },
      testDeps
    );

    expect(treatment.id).toBe('test-treatment-id');
    expect(treatment.customerId).toBe('cust-2');
    expect(treatment.treatmentTypeId).toBe('tt-1');
    expect(treatment.treatmentSeriesId).toBe('series-2');
    expect(treatment.treatmentDate).toBe('2026-07-14');
    expect(treatment.therapistId).toBe('user-therapist-2');
    expect(treatment.treatmentPhotos).toEqual([]);
  });

  it('does not set durationMinutes', () => {
    const treatment = buildQuantityTreatment(
      { seriesId: 's1', customerId: 'c1', treatmentTypeId: 'tt1', therapistId: 'u1' },
      testDeps
    );
    expect(treatment.durationMinutes).toBeUndefined();
  });

  it('does not set notes', () => {
    const treatment = buildQuantityTreatment(
      { seriesId: 's1', customerId: 'c1', treatmentTypeId: 'tt1', therapistId: 'u1' },
      testDeps
    );
    expect(treatment.notes).toBeUndefined();
  });
});

// ─── applyTimerTreatmentToSeries ──────────────────────────────────────────────

describe('applyTimerTreatmentToSeries', () => {
  it('increments usedMinutes by durationMinutes', () => {
    const series = makeTimerSeries({ usedMinutes: 60 });
    const updated = applyTimerTreatmentToSeries(series, 45);
    expect(updated.usedMinutes).toBe(105);
  });

  it('handles usedMinutes starting at 0', () => {
    const series = makeTimerSeries({ usedMinutes: 0 });
    const updated = applyTimerTreatmentToSeries(series, 60);
    expect(updated.usedMinutes).toBe(60);
  });

  it('handles undefined usedMinutes as 0', () => {
    const series = makeTimerSeries({ usedMinutes: undefined });
    const updated = applyTimerTreatmentToSeries(series, 30);
    expect(updated.usedMinutes).toBe(30);
  });

  it('does NOT set completedTreatments', () => {
    const series = makeTimerSeries();
    const updated = applyTimerTreatmentToSeries(series, 60);
    expect(updated.completedTreatments).toBeUndefined();
  });

  it('does not mutate the original series', () => {
    const series = makeTimerSeries({ usedMinutes: 60 });
    applyTimerTreatmentToSeries(series, 60);
    expect(series.usedMinutes).toBe(60);
  });

  it('throws DomainError with code WRONG_SERIES_KIND for quantity series', () => {
    const series = makeQuantitySeries();
    expect(() => applyTimerTreatmentToSeries(series, 60)).toThrow(DomainError);
  });

  it('DomainError has correct code WRONG_SERIES_KIND', () => {
    const series = makeQuantitySeries();
    try {
      applyTimerTreatmentToSeries(series, 60);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('WRONG_SERIES_KIND');
    }
  });

  it('throws DomainError with code INVALID_MINUTES_PER_TREATMENT when minutesPerTreatment is 0', () => {
    const series = makeTimerSeries({ minutesPerTreatment: 0 });
    try {
      applyTimerTreatmentToSeries(series, 60);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('INVALID_MINUTES_PER_TREATMENT');
    }
  });

  it('throws DomainError when minutesPerTreatment is undefined', () => {
    const series = makeTimerSeries({ minutesPerTreatment: undefined });
    expect(() => applyTimerTreatmentToSeries(series, 60)).toThrow(DomainError);
  });

  it('clamps usedMinutes to totalMinutes when recording would overrun the series', () => {
    // 60 totalMinutes, 50 usedMinutes, recording 20 minutes → clamp to 60, not 70
    const series = makeTimerSeries({ totalMinutes: 60, usedMinutes: 50, minutesPerTreatment: 60 });
    const updated = applyTimerTreatmentToSeries(series, 20);
    expect(updated.usedMinutes).toBe(60);
  });

  it('allows recording up to exactly totalMinutes without clamping', () => {
    const series = makeTimerSeries({ totalMinutes: 60, usedMinutes: 30, minutesPerTreatment: 60 });
    const updated = applyTimerTreatmentToSeries(series, 30);
    expect(updated.usedMinutes).toBe(60);
  });

  it('does not clamp when totalMinutes is undefined (no overrun guard)', () => {
    const series = makeTimerSeries({ totalMinutes: undefined, usedMinutes: 50, minutesPerTreatment: 60 });
    const updated = applyTimerTreatmentToSeries(series, 20);
    expect(updated.usedMinutes).toBe(70);
  });
});

// ─── buildTreatmentPhoto ─────────────────────────────────────────────────────

const photoDeps = {
  newId: () => 'test-photo-id',
  today: () => '2026-07-14',
};

describe('buildTreatmentPhoto', () => {
  it('creates a TreatmentPhoto with correct fields', () => {
    const photo = buildTreatmentPhoto('treatment-1', 'blob:http://localhost/abc', photoDeps);
    expect(photo.id).toBe('test-photo-id');
    expect(photo.treatmentId).toBe('treatment-1');
    expect(photo.photoUrl).toBe('blob:http://localhost/abc');
    expect(photo.uploadedDate).toBe('2026-07-14');
  });

  it('uses injected newId', () => {
    const deps = { ...photoDeps, newId: () => 'custom-photo-id' };
    const photo = buildTreatmentPhoto('t-1', 'blob:url', deps);
    expect(photo.id).toBe('custom-photo-id');
  });

  it('uses injected today for uploadedDate', () => {
    const deps = { ...photoDeps, today: () => '2025-12-25' };
    const photo = buildTreatmentPhoto('t-1', 'blob:url', deps);
    expect(photo.uploadedDate).toBe('2025-12-25');
  });

  it('stores the treatmentId', () => {
    const photo = buildTreatmentPhoto('treatment-xyz', 'blob:url', photoDeps);
    expect(photo.treatmentId).toBe('treatment-xyz');
  });

  it('stores the photoUrl', () => {
    const photo = buildTreatmentPhoto('t-1', 'blob:http://localhost/unique-photo', photoDeps);
    expect(photo.photoUrl).toBe('blob:http://localhost/unique-photo');
  });

  it('uses real newId when deps not provided', () => {
    const photo = buildTreatmentPhoto('t-1', 'blob:url');
    expect(photo.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses real today when deps not provided', () => {
    const today = new Date().toISOString().slice(0, 10);
    const photo = buildTreatmentPhoto('t-1', 'blob:url');
    expect(photo.uploadedDate).toBe(today);
  });
});

// ─── applyQuantityTreatmentToSeries ──────────────────────────────────────────

describe('applyQuantityTreatmentToSeries', () => {
  it('increments completedTreatments by 1', () => {
    const series = makeQuantitySeries({ completedTreatments: 3 });
    const updated = applyQuantityTreatmentToSeries(series);
    expect(updated.completedTreatments).toBe(4);
  });

  it('handles completedTreatments starting at 0', () => {
    const series = makeQuantitySeries({ completedTreatments: 0 });
    const updated = applyQuantityTreatmentToSeries(series);
    expect(updated.completedTreatments).toBe(1);
  });

  it('handles undefined completedTreatments as 0', () => {
    const series = makeQuantitySeries({ completedTreatments: undefined });
    const updated = applyQuantityTreatmentToSeries(series);
    expect(updated.completedTreatments).toBe(1);
  });

  it('does not mutate the original series', () => {
    const series = makeQuantitySeries({ completedTreatments: 2 });
    applyQuantityTreatmentToSeries(series);
    expect(series.completedTreatments).toBe(2);
  });

  it('allows completing the last remaining treatment', () => {
    const series = makeQuantitySeries({ completedTreatments: 9, totalTreatments: 10 });
    const updated = applyQuantityTreatmentToSeries(series);
    expect(updated.completedTreatments).toBe(10);
  });

  it('throws DomainError with code SERIES_COMPLETE when series is full', () => {
    const series = makeQuantitySeries({ completedTreatments: 10, totalTreatments: 10 });
    expect(() => applyQuantityTreatmentToSeries(series)).toThrow(DomainError);
  });

  it('DomainError has correct code SERIES_COMPLETE', () => {
    const series = makeQuantitySeries({ completedTreatments: 10, totalTreatments: 10 });
    try {
      applyQuantityTreatmentToSeries(series);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('SERIES_COMPLETE');
    }
  });

  it('throws when completedTreatments exceeds totalTreatments', () => {
    const series = makeQuantitySeries({ completedTreatments: 11, totalTreatments: 10 });
    expect(() => applyQuantityTreatmentToSeries(series)).toThrow(DomainError);
  });
});
