import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../types/Therapist';
import type { User } from '../types/User';
import { therapistAvailabilityApi } from '../api/therapistAvailabilityApi';
import { therapistWorkingHoursApi } from '../api/therapistWorkingHoursApi';
import { therapistCapabilityApi } from '../api/therapistCapabilityApi';
import { therapistUnavailableDatesApi } from '../api/therapistUnavailableDatesApi';
import { ApiRequestError } from '../api/apiError';
import { DomainError } from '../domain/errors';
import { useAuth } from './AuthContext';
import { triggerTherapistsContextRefresh } from './therapistRefreshBus';

const WEEKDAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface TherapistDataContextValue {
  therapists: User[];
  workingHours: TherapistWorkingHours[];
  unavailableDates: TherapistUnavailableDate[];
  capabilities: TherapistCapability[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveTherapistWorkingHours: (userId: string, hours: TherapistWorkingHours[]) => Promise<void>;
  addTherapistUnavailableDate: (entry: TherapistUnavailableDate) => Promise<void>;
  removeTherapistUnavailableDate: (userId: string, date: string) => Promise<void>;
  addTherapistCapability: (userId: string, treatmentTypeId: string) => Promise<void>;
  removeTherapistCapability: (userId: string, treatmentTypeId: string) => Promise<void>;
  cleanupTherapist: (userId: string) => void;
}

const TherapistDataContext = createContext<TherapistDataContextValue | null>(null);

export function TherapistDataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [therapists, setTherapists] = useState<User[]>([]);
  const [workingHours, setWorkingHours] = useState<TherapistWorkingHours[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<TherapistUnavailableDate[]>([]);
  const [capabilities, setCapabilities] = useState<TherapistCapability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 011 Architecture Review Correction #1 / Q4: working hours / unavailable dates /
  // capabilities are read from GET /api/v1/therapists/availability (any authenticated user, not
  // Manager-gated — unlike TherapistsContext's GET /api/v1/users), keyed to real User.Id GUIDs.
  //
  // Phase 012 (RC-1): the three resources now also have a write/management API
  // (/api/v1/therapists/{userId}/working-hours|capabilities|unavailable-dates, Manager-only
  // writes) — see saveTherapistWorkingHours / addTherapistUnavailableDate /
  // removeTherapistUnavailableDate / addTherapistCapability / removeTherapistCapability below,
  // which now persist to the real backend instead of mutating local state only.
  //
  // Bugfix (post-Phase-011): `therapists` here is sourced from GET /api/v1/therapists (name+id
  // only, same non-Manager-gated access level), NOT TherapistsContext's
  // GET /api/v1/users?role=Therapist (Manager-only end-to-end, 403s for a Therapist-role caller).
  // The booking/reschedule/calendar therapist picker (BookAppointmentModal, RescheduleModal,
  // CalendarGrid) reads `therapists` from this context for exactly that reason — and, per Phase
  // 012, GET /api/v1/therapists is always active-only, so a deactivated therapist disappears from
  // the picker automatically without any frontend filtering logic needed here.
  const fetchAvailability = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const [dto, therapistDtos] = await Promise.all([
        therapistAvailabilityApi.get(),
        therapistAvailabilityApi.getTherapists(),
      ]);
      if (isCancelled?.()) return;
      setWorkingHours(dto.workingHours.map(wh => ({
        id: wh.id, userId: wh.userId, weekday: wh.weekday,
        startTime: wh.startTime || null, endTime: wh.endTime || null,
      })));
      setUnavailableDates(dto.unavailableDates.map(ud => ({
        id: ud.id, userId: ud.userId, date: ud.date,
      })));
      setCapabilities(dto.capabilities.map(c => ({
        id: c.id, userId: c.userId, treatmentTypeId: c.treatmentTypeId,
      })));
      setTherapists(therapistDtos.map(t => ({
        id: t.id, fullName: t.fullName, email: '', phone: undefined, role: 'Therapist' as const, isActive: true,
      })));
    } catch (e) {
      if (isCancelled?.()) return;
      const msg = e instanceof ApiRequestError ? e.error.message : 'שגיאה בטעינת נתוני זמינות המטפלות';
      setError(msg);
    } finally {
      if (!isCancelled?.()) setIsLoading(false);
    }
  }, []);

  // Auth-gated fetch (same pattern as CustomersContext/TreatmentTypesContext — v0.10.1 fix).
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchAvailability(() => cancelled);
    return () => { cancelled = true; };
  }, [currentUser, fetchAvailability]);

  const refresh = useCallback(() => fetchAvailability(), [fetchAvailability]);

  /**
   * Phase 012 — persists all 7 weekday rows via PUT (upsert) in parallel. Risk noted in the
   * approved plan ("Batch frontend saves"): report which specific day(s) failed, not just a
   * generic error, since one save action fans out into 7 independent API calls.
   */
  const saveTherapistWorkingHours = useCallback(
    async (userId: string, hours: TherapistWorkingHours[]): Promise<void> => {
      const results = await Promise.allSettled(
        hours.map(h => therapistWorkingHoursApi.upsert(userId, h.weekday, { startTime: h.startTime, endTime: h.endTime }))
      );

      const failedDays = results
        .map((r, i) => ({ r, weekday: hours[i].weekday }))
        .filter(({ r }) => r.status === 'rejected')
        .map(({ weekday }) => WEEKDAY_NAMES_HE[weekday] ?? String(weekday));

      await refresh();
      triggerTherapistsContextRefresh(); // RC-5 — no direct effect today, but keeps both contexts coordinated

      if (failedDays.length > 0) {
        const firstRejection = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
        const detail = firstRejection?.reason instanceof ApiRequestError
          ? firstRejection.reason.error.message
          : undefined;
        throw new DomainError(
          'WORKING_HOURS_SAVE_PARTIAL_FAILURE',
          `שמירת שעות העבודה נכשלה עבור: ${failedDays.join(', ')}${detail ? ` (${detail})` : ''}`
        );
      }
    },
    [refresh]
  );

  const addTherapistUnavailableDate = useCallback(
    async (entry: TherapistUnavailableDate): Promise<void> => {
      try {
        await therapistUnavailableDatesApi.add(entry.userId, entry.date);
        await refresh();
        triggerTherapistsContextRefresh();
      } catch (e) {
        if (e instanceof ApiRequestError) throw new DomainError('UNAVAILABLE_DATE_SAVE_FAILED', e.error.message);
        throw e;
      }
    },
    [refresh]
  );

  const removeTherapistUnavailableDate = useCallback(
    async (userId: string, date: string): Promise<void> => {
      try {
        await therapistUnavailableDatesApi.remove(userId, date);
        await refresh();
        triggerTherapistsContextRefresh();
      } catch (e) {
        if (e instanceof ApiRequestError) throw new DomainError('UNAVAILABLE_DATE_REMOVE_FAILED', e.error.message);
        throw e;
      }
    },
    [refresh]
  );

  const cleanupTherapist = useCallback((userId: string): void => {
    setWorkingHours(prev => prev.filter(h => h.userId !== userId));
    setUnavailableDates(prev => prev.filter(d => d.userId !== userId));
    setCapabilities(prev => prev.filter(c => c.userId !== userId));
  }, []);

  const addTherapistCapability = useCallback(
    async (userId: string, treatmentTypeId: string): Promise<void> => {
      try {
        await therapistCapabilityApi.add(userId, treatmentTypeId);
        await refresh();
        triggerTherapistsContextRefresh();
      } catch (e) {
        if (e instanceof ApiRequestError) throw new DomainError('CAPABILITY_ADD_FAILED', e.error.message);
        throw e;
      }
    },
    [refresh]
  );

  const removeTherapistCapability = useCallback(
    async (userId: string, treatmentTypeId: string): Promise<void> => {
      try {
        await therapistCapabilityApi.remove(userId, treatmentTypeId);
        await refresh();
        triggerTherapistsContextRefresh();
      } catch (e) {
        if (e instanceof ApiRequestError) throw new DomainError('CAPABILITY_REMOVE_FAILED', e.error.message);
        throw e;
      }
    },
    [refresh]
  );

  const value = useMemo<TherapistDataContextValue>(
    () => ({
      therapists,
      workingHours,
      unavailableDates,
      capabilities,
      isLoading,
      error,
      refresh,
      saveTherapistWorkingHours,
      addTherapistUnavailableDate,
      removeTherapistUnavailableDate,
      addTherapistCapability,
      removeTherapistCapability,
      cleanupTherapist,
    }),
    [
      therapists,
      workingHours,
      unavailableDates,
      capabilities,
      isLoading,
      error,
      refresh,
      saveTherapistWorkingHours,
      addTherapistUnavailableDate,
      removeTherapistUnavailableDate,
      addTherapistCapability,
      removeTherapistCapability,
      cleanupTherapist,
    ]
  );

  return (
    <TherapistDataContext.Provider value={value}>
      {children}
    </TherapistDataContext.Provider>
  );
}

export function useTherapistData(): TherapistDataContextValue {
  const ctx = useContext(TherapistDataContext);
  if (!ctx) throw new Error('useTherapistData must be used within TherapistDataProvider');
  return ctx;
}
