import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PackageType } from '../types/PackageType';
import { packageTypes as seedPackageTypes } from '../data/packageTypes';
import { buildPackageType, updatePackageType, deletePackageType } from '../features/packages/packageTypeService';

interface BuildPackageTypeParams {
  name: string;
  treatmentTypeId: string;
  price: string;
  isSeries: boolean;
  treatmentCount?: number;
  isTimerBased?: boolean;
  minutesPerTreatment?: number;
}

interface PackageTypesContextValue {
  packageTypes: PackageType[];
  createPackageType: (params: BuildPackageTypeParams) => PackageType;
  updatePackageType: (id: string, updated: PackageType) => void;
  deletePackageType: (id: string) => void;
}

const PackageTypesContext = createContext<PackageTypesContextValue | null>(null);

export function PackageTypesProvider({ children }: { children: React.ReactNode }) {
  const [packageTypes, setPackageTypes] = useState<PackageType[]>(seedPackageTypes);

  const createPackageType = useCallback((params: BuildPackageTypeParams): PackageType => {
    const newPkg = buildPackageType(params);
    setPackageTypes(prev => [...prev, newPkg]);
    return newPkg;
  }, []);

  const updatePackageTypeById = useCallback((id: string, updated: PackageType): void => {
    setPackageTypes(prev => updatePackageType(id, updated, prev));
  }, []);

  const deletePackageTypeById = useCallback((id: string): void => {
    setPackageTypes(prev => deletePackageType(id, prev));
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
