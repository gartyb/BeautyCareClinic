import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../types/Therapist';
import { therapistWorkingHours as seedWorkingHours } from '../data/therapistWorkingHours';
import { therapistUnavailableDates as seedUnavailableDates } from '../data/therapistUnavailableDates';
import { therapistCapabilities as seedCapabilities } from '../data/therapistCapabilities';
import {
  addUnavailableDate,
  removeUnavailableDate,
  updateTherapistCapabilities,
} from '../features/therapists/therapistDataService';

interface TherapistDataContextValue {
  workingHours: TherapistWorkingHours[];
  unavailableDates: TherapistUnavailableDate[];
  capabilities: TherapistCapability[];
  saveTherapistWorkingHours: (userId: string, hours: TherapistWorkingHours[]) => void;
  addTherapistUnavailableDate: (entry: TherapistUnavailableDate) => void;
  removeTherapistUnavailableDate: (userId: string, date: string) => void;
  saveTherapistCapabilities: (userId: string, caps: TherapistCapability[]) => void;
  cleanupTherapist: (userId: string) => void;
}

const TherapistDataContext = createContext<TherapistDataContextValue | null>(null);

export function TherapistDataProvider({ children }: { children: React.ReactNode }) {
  const [workingHours, setWorkingHours] = useState<TherapistWorkingHours[]>(seedWorkingHours);
  const [unavailableDates, setUnavailableDates] = useState<TherapistUnavailableDate[]>(seedUnavailableDates);
  const [capabilities, setCapabilities] = useState<TherapistCapability[]>(seedCapabilities);

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
      workingHours,
      unavailableDates,
      capabilities,
      saveTherapistWorkingHours,
      addTherapistUnavailableDate,
      removeTherapistUnavailableDate,
      saveTherapistCapabilities,
      cleanupTherapist,
    }),
    [
      workingHours,
      unavailableDates,
      capabilities,
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
