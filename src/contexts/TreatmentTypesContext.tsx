import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { TreatmentType } from '../types/TreatmentType';
import { treatmentTypes as seedTreatmentTypes } from '../data/treatmentTypes';
import { newId } from '../domain/id';
import { DomainError } from '../domain/errors';

interface TreatmentTypesContextValue {
  treatmentTypes: TreatmentType[];
  createTreatmentType: (name: string) => TreatmentType;
  updateTreatmentType: (id: string, name: string) => void;
  deleteTreatmentType: (id: string) => void;
}

const TreatmentTypesContext = createContext<TreatmentTypesContextValue | null>(null);

export function TreatmentTypesProvider({ children }: { children: React.ReactNode }) {
  const [treatmentTypes, setTreatmentTypes] = useState<TreatmentType[]>(seedTreatmentTypes);

  const createTreatmentType = useCallback((name: string): TreatmentType => {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('TREATMENT_TYPE_NAME_REQUIRED', 'שם סוג טיפול נדרש');
    if (trimmed.length > 100) throw new DomainError('TREATMENT_TYPE_NAME_TOO_LONG', 'שם לא יכול לעלות על 100 תווים');
    const tt: TreatmentType = { id: newId(), name: trimmed };
    setTreatmentTypes(prev => [...prev, tt]);
    return tt;
  }, []);

  const updateTreatmentType = useCallback((id: string, name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) throw new DomainError('TREATMENT_TYPE_NAME_REQUIRED', 'שם סוג טיפול נדרש');
    if (trimmed.length > 100) throw new DomainError('TREATMENT_TYPE_NAME_TOO_LONG', 'שם לא יכול לעלות על 100 תווים');
    setTreatmentTypes(prev => prev.map(tt => tt.id === id ? { ...tt, name: trimmed } : tt));
  }, []);

  const deleteTreatmentType = useCallback((id: string): void => {
    setTreatmentTypes(prev => prev.filter(tt => tt.id !== id));
  }, []);

  const value = useMemo<TreatmentTypesContextValue>(
    () => ({ treatmentTypes, createTreatmentType, updateTreatmentType, deleteTreatmentType }),
    [treatmentTypes, createTreatmentType, updateTreatmentType, deleteTreatmentType]
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
