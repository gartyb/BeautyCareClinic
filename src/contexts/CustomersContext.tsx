import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Customer } from '../types/Customer';
import { getCustomers, createCustomer as apiCreateCustomer } from '../api/customersApi';
import { ApiRequestError } from '../api/apiError';

interface CustomersContextValue {
  customers: Customer[];
  isLoading: boolean;
  error: string | null;
  createCustomer: (fullName: string, phone: string, email?: string) => Promise<Customer>;
  refetch: (search?: string) => Promise<void>;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async (search?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getCustomers(search);
      setCustomers(dtos.map(dto => ({
        id: dto.id,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? '',
        createdDate: dto.createdAt ? dto.createdAt.slice(0, 10) : '',
      })));
    } catch (e) {
      const msg = e instanceof ApiRequestError ? e.message : 'שגיאה בטעינת הנתונים';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const createCustomer = useCallback(async (fullName: string, phone: string, email?: string): Promise<Customer> => {
    const dto = await apiCreateCustomer({ fullName, phone, email: email || undefined });
    const newCustomer: Customer = {
      id: dto.id,
      fullName: dto.fullName,
      phone: dto.phone,
      email: dto.email ?? '',
      createdDate: dto.createdAt ? dto.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
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
