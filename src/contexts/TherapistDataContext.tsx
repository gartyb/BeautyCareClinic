import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../types/Therapist';
import type { User } from '../types/User';
import { therapistAvailabilityApi } from '../api/therapistAvailabilityApi';
import { ApiRequestError } from '../api/apiError';
import {
  addUnavailableDate,
  removeUnavailableDate,
  updateTherapistCapabilities,
} from '../features/therapists/therapistDataService';
import { useAuth } from './AuthContext';

interface TherapistDataContextValue {
  therapists: User[];
  workingHours: TherapistWorkingHours[];
  unavailableDates: TherapistUnavailableDate[];
  capabilities: TherapistCapability[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  saveTherapistWorkingHours: (userId: string, hours: TherapistWorkingHours[]) => void;
  addTherapistUnavailableDate: (entry: TherapistUnavailableDate) => void;
  removeTherapistUnavailableDate: (userId: string, date: string) => void;
  saveTherapistCapabilities: (userId: string, caps: TherapistCapability[]) => void;
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

  // Phase 011 Architecture Review Correction #1 / Q4: this data is now read from the real
  // GET /api/v1/therapists/availability endpoint (any authenticated user, not Manager-gated —
  // unlike TherapistsContext's GET /api/v1/users), replacing the mock seed arrays
  // (`data/therapistWorkingHours.ts` etc.), keyed to real User.Id GUIDs. There is still no
  // write/management API for this data (Q4 stays deferred) — saveTherapistWorkingHours /
  // addTherapistUnavailableDate / removeTherapistUnavailableDate / saveTherapistCapabilities
  // remain local-state-only mutations used by the Manager-only TherapistDetail management screen,
  // same as before.
  //
  // Bugfix (post-Phase-011): `therapists` here is now also sourced from GET /api/v1/therapists
  // (name+id only, same non-Manager-gated access level), NOT TherapistsContext's
  // GET /api/v1/users?role=Therapist (which is Manager-only end-to-end and 403s for a
  // Therapist-role caller — see TherapistsContext.tsx). The booking/reschedule/calendar therapist
  // picker (BookAppointmentModal, RescheduleModal, CalendarGrid) reads `therapists` from this
  // context instead of TherapistsContext for exactly that reason. TherapistsContext itself is
  // unchanged and remains the source for the Manager-only /therapists management screen, which
  // needs full email/phone detail that this narrow endpoint intentionally does not carry.
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
        id: wh.id, userId: wh.userId, weekday: wh.weekday, startTime: wh.startTime, endTime: wh.endTime,
      })));
      setUnavailableDates(dto.unavailableDates.map(ud => ({
        id: ud.id, userId: ud.userId, date: ud.date,
      })));
      setCapabilities(dto.capabilities.map(c => ({
        id: c.id, userId: c.userId, treatmentTypeId: c.treatmentTypeId,
      })));
      setTherapists(therapistDtos.map(t => ({
        id: t.id, fullName: t.fullName, email: '', phone: undefined, role: 'Therapist' as const,
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

  const saveTherapistWorkingHours = useCallback(
    (userId: string, hours: TherapistWorkingHours[]) => {
      // hours are already validated TherapistWorkingHours entries — replace all for this user
      setWorkingHours(prev => [
        ...prev.filter(h => h.userId !== userId),
        ...hours,
      ]);
    },
    []
  );

  const addTherapistUnavailableDate = useCallback(
    (entry: TherapistUnavailableDate) => {
      setUnavailableDates(prev => addUnavailableDate(entry.userId, entry.date, prev));
    },
    []
  );

  const removeTherapistUnavailableDate = useCallback(
    (userId: string, date: string) => {
      setUnavailableDates(prev => removeUnavailableDate(userId, date, prev));
    },
    []
  );

  const cleanupTherapist = useCallback((userId: string): void => {
    setWorkingHours(prev => prev.filter(h => h.userId !== userId));
    setUnavailableDates(prev => prev.filter(d => d.userId !== userId));
    setCapabilities(prev => prev.filter(c => c.userId !== userId));
  }, []);

  const saveTherapistCapabilities = useCallback(
    (userId: string, caps: TherapistCapability[]) => {
      setCapabilities(prev => {
        const treatmentTypeIds = caps.map(c => c.treatmentTypeId);
        return updateTherapistCapabilities(userId, treatmentTypeIds, prev);
      });
    },
    []
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
      saveTherapistCapabilities,
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
      saveTherapistCapabilities,
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
