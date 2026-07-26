import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PackageType } from '../types/PackageType';
import { packageTypesApi } from '../api/packageTypesApi';
import { useAuth } from './AuthContext';

interface BuildPackageTypeParams {
  name: string;
  treatmentTypeId: string;
  price: string | number;
  isSeries: boolean;
  treatmentCount?: number;
  isTimerBased?: boolean;
  minutesPerTreatment?: number;
}

interface PackageTypesContextValue {
  packageTypes: PackageType[];
  createPackageType: (params: BuildPackageTypeParams) => Promise<void>;
  updatePackageType: (id: string, updated: PackageType) => Promise<void>;
  deletePackageType: (id: string) => Promise<void>;
}

const PackageTypesContext = createContext<PackageTypesContextValue | null>(null);

export function PackageTypesProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [packageTypes, setPackageTypes] = useState<PackageType[]>([]);

  // Load once the user is authenticated (covers both session restore and fresh login).
  // Guard against a stale in-flight fetch from a previous auth state (e.g. logout → re-login)
  // resolving after a newer effect run and clobbering state with outdated data.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    packageTypesApi.list()
      .then(data => { if (!cancelled) setPackageTypes(data); })
      .catch(err => { if (!cancelled) console.error(err); });
    return () => { cancelled = true; };
  }, [currentUser]);

  const createPackageType = useCallback(async (params: BuildPackageTypeParams): Promise<void> => {
    const created = await packageTypesApi.create({
      name: params.name,
      treatmentTypeId: params.treatmentTypeId,
      price: Number(params.price),
      isSeries: params.isSeries,
      isTimerBased: params.isTimerBased ?? false,
      treatmentCount: params.isSeries ? params.treatmentCount : undefined,
      minutesPerTreatment: params.isTimerBased ? params.minutesPerTreatment : undefined,
    });
    setPackageTypes(prev => [...prev, created]);
  }, []);

  const updatePackageTypeById = useCallback(async (id: string, updated: PackageType): Promise<void> => {
    const result = await packageTypesApi.update(id, {
      name: updated.name,
      treatmentTypeId: updated.treatmentTypeId,
      price: Number(updated.price),
      isSeries: updated.isSeries,
      isTimerBased: updated.isTimerBased,
      treatmentCount: updated.isSeries ? updated.treatmentCount : undefined,
      minutesPerTreatment: updated.isTimerBased ? updated.minutesPerTreatment : undefined,
    });
    setPackageTypes(prev => prev.map(p => p.id === id ? result : p));
  }, []);

  const deletePackageTypeById = useCallback(async (id: string): Promise<void> => {
    await packageTypesApi.delete(id);
    setPackageTypes(prev => prev.filter(p => p.id !== id));
  }, []);

  const value = useMemo<PackageTypesContextValue>(
    () => ({
      packageTypes,
      createPackageType,
      updatePackageType: updatePackageTypeById,
      deletePackageType: deletePackageTypeById,
    }),
    [packageTypes, createPackageType, updatePackageTypeById, deletePackageTypeById]
  );

  return (
    <PackageTypesContext.Provider value={value}>
      {children}
    </PackageTypesContext.Provider>
  );
}

export function usePackageTypes(): PackageTypesContextValue {
  const ctx = useContext(PackageTypesContext);
  if (!ctx) throw new Error('usePackageTypes must be used within PackageTypesProvider');
  return ctx;
}
