import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { TreatmentType } from '../types/TreatmentType';
import {
  getTreatmentTypes,
  createTreatmentType as apiCreate,
  updateTreatmentType as apiUpdate,
  deleteTreatmentType as apiDelete,
} from '../api/treatmentTypesApi';
import { ApiRequestError } from '../api/apiError';
import { useAuth } from './AuthContext';

interface TreatmentTypesContextValue {
  treatmentTypes: TreatmentType[];
  isLoading: boolean;
  error: string | null;
  createTreatmentType: (name: string, defaultDurationMinutes: number) => Promise<TreatmentType>;
  updateTreatmentType: (id: string, name: string, defaultDurationMinutes: number) => Promise<void>;
  deleteTreatmentType: (id: string) => Promise<void>;
}

const TreatmentTypesContext = createContext<TreatmentTypesContextValue | null>(null);

export function TreatmentTypesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getTreatmentTypes();
      if (isCancelled?.()) return;
      setTreatmentTypes(dtos.map(dto => ({
        id: dto.id,
        name: dto.name,
        defaultDurationMinutes: dto.defaultDurationMinutes ?? 60,
      })));
    } catch (e) {
      if (isCancelled?.()) return;
      const msg = e instanceof ApiRequestError ? e.message : 'שגיאה בטעינת סוגי טיפולים';
      setError(msg);
    } finally {
      if (!isCancelled?.()) setIsLoading(false);
    }
  }, []);

  // Load once the user is authenticated (covers both session restore and fresh login).
  // Guard against a stale in-flight fetch from a previous auth state (e.g. logout → re-login)
  // resolving after a newer effect run and clobbering state with outdated data.
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchAll(() => cancelled);
    return () => { cancelled = true; };
  }, [currentUser, fetchAll]);

  const createTreatmentType = useCallback(async (name: string, defaultDurationMinutes: number): Promise<TreatmentType> => {
    const dto = await apiCreate({ name, defaultDurationMinutes });
    const tt: TreatmentType = { id: dto.id, name: dto.name, defaultDurationMinutes: dto.defaultDurationMinutes ?? defaultDurationMinutes };
    setTreatmentTypes(prev => [...prev, tt]);
    return tt;
  }, []);

  const updateTreatmentType = useCallback(async (id: string, name: string, defaultDurationMinutes: number): Promise<void> => {
    const dto = await apiUpdate(id, { name, defaultDurationMinutes });
    setTreatmentTypes(prev => prev.map(tt => tt.id === id
      ? { ...tt, name: dto.name, defaultDurationMinutes: dto.defaultDurationMinutes ?? defaultDurationMinutes }
      : tt
    ));
  }, []);

  const deleteTreatmentType = useCallback(async (id: string): Promise<void> => {
    await apiDelete(id);
    setTreatmentTypes(prev => prev.filter(tt => tt.id !== id));
  }, []);

  const value = useMemo<TreatmentTypesContextValue>(
    () => ({ treatmentTypes, isLoading, error, createTreatmentType, updateTreatmentType, deleteTreatmentType }),
    [treatmentTypes, isLoading, error, createTreatmentType, updateTreatmentType, deleteTreatmentType]
  );

  return (
    <TreatmentTypesContext.Provider value={value}>
      {children}
    </TreatmentTypesContext.Provider>
  );
}

export function useTreatmentTypes(): TreatmentTypesContextValue {
  const ctx = useContext(TreatmentTypesContext);
  if (!ctx) throw new Error('useTreatmentTypes must be used within TreatmentTypesProvider');
  return ctx;
}
