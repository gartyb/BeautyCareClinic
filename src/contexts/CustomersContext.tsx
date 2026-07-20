import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Customer } from '../types/Customer';
import { getCustomers, createCustomer as apiCreateCustomer } from '../api/customersApi';
import { ApiRequestError } from '../api/apiError';
import { useAuth } from './AuthContext';

interface CustomersContextValue {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  createCustomer: (fullName: string, phone: string, email?: string) => Promise<Customer>;
  refetch: (search?: string) => Promise<void>;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (search?: string, isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getCustomers(search);
      if (isCancelled?.()) return;
      setCustomers(dtos.map(dto => ({
        id: dto.id,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? '',
        createdDate: dto.createdAt ? dto.createdAt.slice(0, 10) : '',
        activeSeriesCount: dto.activeSeriesCount,
        outstandingBalance: dto.outstandingBalance,
      })));
    } catch (e) {
      if (isCancelled?.()) return;
      const msg = e instanceof ApiRequestError ? e.message : 'שגיאה בטעינת הנתונים';
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
    fetchCustomers(undefined, () => cancelled);
    return () => { cancelled = true; };
  }, [currentUser, fetchCustomers]);

  const createCustomer = useCallback(async (fullName: string, phone: string, email?: string): Promise<Customer> => {
    const dto = await apiCreateCustomer({ fullName, phone, email: email || undefined });
    const newCustomer: Customer = {
      id: dto.id,
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? '',
      createdDate: dto.createdAt ? dto.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
      activeSeriesCount: dto.activeSeriesCount,
      outstandingBalance: dto.outstandingBalance,
    };
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  }, []);

  const value = useMemo<CustomersContextValue>(
    () => ({ customers, isLoading, error, createCustomer, refetch: fetchCustomers }),
    [customers, isLoading, error, createCustomer, fetchCustomers]
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers(): CustomersContextValue {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error('useCustomers must be used within CustomersProvider');
  return ctx;
}
