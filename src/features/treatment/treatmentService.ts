import type { Treatment } from '../../types/Treatment';
import type { TreatmentSeries } from '../../types/TreatmentSeries';
import { DomainError } from '../../domain/errors';
import { newId } from '../../domain/id';

// ─── Deps injection ───────────────────────────────────────────────────────────

interface BuildDeps {
  newId?: () => string;
  now?: () => string;
}

// ─── toFloorMinutes ───────────────────────────────────────────────────────────

/** Converts elapsed seconds to whole minutes, rounding down. */
export function toFloorMinutes(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) return 0;
  return Math.floor(elapsedSeconds / 60);
}

// ─── buildTimerTreatment ──────────────────────────────────────────────────────

interface BuildTimerTreatmentParams {
  seriesId: string;
  customerId: string;
  treatmentTypeId: string;
  therapistId: string;
  durationMinutes: number;
}

export function buildTimerTreatment(
  params: BuildTimerTreatmentParams,
  deps: BuildDeps = {}
): Treatment {
  const genId = deps.newId ?? newId;
  const now = deps.now ?? (() => new Date().toISOString().slice(0, 10));
  return {
    id: genId(),
    customerId: params.customerId,
    treatmentTypeId: params.treatmentTypeId,
    treatmentSeriesId: params.seriesId,
    treatmentDate: now(),
    durationMinutes: params.durationMinutes,
    therapistId: params.therapistId,
    treatmentPhotos: [],
  };
}

// ─── buildQuantityTreatment ───────────────────────────────────────────────────

interface BuildQuantityTreatmentParams {
  seriesId: string;
  customerId: string;
  treatmentTypeId: string;
  therapistId: string;
}

export function buildQuantityTreatment(
  params: BuildQuantityTreatmentParams,
  deps: BuildDeps = {}
): Treatment {
  const genId = deps.newId ?? newId;
  const now = deps.now ?? (() => new Date().toISOString().slice(0, 10));
  return {
    id: genId(),
    customerId: params.customerId,
    treatmentTypeId: params.treatmentTypeId,
    treatmentSeriesId: params.seriesId,
    treatmentDate: now(),
    therapistId: params.therapistId,
    treatmentPhotos: [],
  };
}

// ─── applyTimerTreatmentToSeries ──────────────────────────────────────────────

/**
 * Returns an updated TreatmentSeries with usedMinutes incremented.
 * Does NOT set completedTreatments — that remains derived (floor(usedMinutes / minutesPerTreatment)).
 * Throws DomainError if:
 * - series.seriesKind !== 'timer'
 * - minutesPerTreatment <= 0 (or missing)
 */
export function applyTimerTreatmentToSeries(
  series: TreatmentSeries,
  durationMinutes: number
): TreatmentSeries {
  if (series.seriesKind !== 'timer') {
    throw new DomainError(
      'WRONG_SERIES_KIND',
      'לא ניתן להחיל טיפול מבוסס טיימר על סדרה מבוססת כמות'
    );
  }
  if (!series.minutesPerTreatment || series.minutesPerTreatment <= 0) {
    throw new DomainError(
      'INVALID_MINUTES_PER_TREATMENT',
      'minutesPerTreatment חייב להיות גדול מאפס'
    );
  }
  const newUsedMinutes = (series.usedMinutes ?? 0) + durationMinutes;
  const clampedUsedMinutes = Math.min(newUsedMinutes, series.totalMinutes ?? newUsedMinutes);
  return {
    ...series,
    usedMinutes: clampedUsedMinutes,
  };
}

// ─── applyQuantityTreatmentToSeries ──────────────────────────────────────────

/**
 * Returns an updated TreatmentSeries with completedTreatments incremented.
 * Throws DomainError if completedTreatments >= totalTreatments.
 */
export function applyQuantityTreatmentToSeries(series: TreatmentSeries): TreatmentSeries {
  const completed = series.completedTreatments ?? 0;
  const total = series.totalTreatments ?? 0;
  if (completed >= total) {
    throw new DomainError(
      'SERIES_COMPLETE',
      'הסדרה הושלמה — לא ניתן לרשום טיפול נוסף'
    );
  }
  return {
    ...series,
    completedTreatments: completed + 1,
  };
}
