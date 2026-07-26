import type { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';
import { newId } from '../../domain/id';
import { DomainError } from '../../domain/errors';

interface Deps {
  newId?: () => string;
}

// ─── Working Hours ────────────────────────────────────────────────────────────

export function buildWorkingHours(
  userId: string,
  weekday: number,
  startTime?: string | null,
  endTime?: string | null,
  deps: Deps = {}
): TherapistWorkingHours {
  if (startTime && endTime && startTime >= endTime) {
    throw new DomainError(
      'WORKING_HOURS_INVALID_RANGE',
      'שעת הסיום חייבת להיות אחרי שעת ההתחלה'
    );
  }

  const genId = deps.newId ?? newId;
  return {
    id: genId(),
    userId,
    weekday,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
  };
}

export function updateTherapistWorkingHours(
  userId: string,
  hours: Array<{ weekday: number; startTime: string | null; endTime: string | null }>,
  current: TherapistWorkingHours[],
  deps: Deps = {}
): TherapistWorkingHours[] {
  // Remove existing entries for this user
  const others = current.filter(h => h.userId !== userId);
  // Build new entries — buildWorkingHours validates range for non-day-off rows
  const newEntries: TherapistWorkingHours[] = hours.map(h =>
    buildWorkingHours(userId, h.weekday, h.startTime, h.endTime, deps)
  );
  return [...others, ...newEntries];
}

// ─── Unavailable Dates ────────────────────────────────────────────────────────

export function buildUnavailableDate(
  userId: string,
  date: string,
  deps: Deps = {}
): TherapistUnavailableDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new DomainError('UNAVAILABLE_DATE_INVALID', 'תאריך לא תקין');
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    throw new DomainError('UNAVAILABLE_DATE_INVALID', 'תאריך לא תקין');
  }
  const genId = deps.newId ?? newId;
  return { id: genId(), userId, date };
}

export function addUnavailableDate(
  userId: string,
  date: string,
  current: TherapistUnavailableDate[],
  deps: Deps = {}
): TherapistUnavailableDate[] {
  const genId = deps.newId ?? newId;
  // Avoid duplicate dates for same user
  if (current.some(d => d.userId === userId && d.date === date)) {
    return current;
  }
  return [...current, { id: genId(), userId, date }];
}

export function removeUnavailableDate(
  userId: string,
  date: string,
  current: TherapistUnavailableDate[]
): TherapistUnavailableDate[] {
  return current.filter(d => !(d.userId === userId && d.date === date));
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

export function buildCapability(
  userId: string,
  treatmentTypeId: string,
  deps: Deps = {}
): TherapistCapability {
  const genId = deps.newId ?? newId;
  return { id: genId(), userId, treatmentTypeId };
}

export function updateTherapistCapabilities(
  userId: string,
  treatmentTypeIds: string[],
  current: TherapistCapability[],
  deps: Deps = {}
): TherapistCapability[] {
  const genId = deps.newId ?? newId;
  const others = current.filter(c => c.userId !== userId);
  const newEntries: TherapistCapability[] = treatmentTypeIds.map(ttId => ({
    id: genId(),
    userId,
    treatmentTypeId: ttId,
  }));
  return [...others, ...newEntries];
}
