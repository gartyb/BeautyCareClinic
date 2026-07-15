import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Customer } from '../types/Customer';
import { customers as seedCustomers } from '../data/customers';
import { buildCustomer } from '../features/customer/customerService';

interface CustomersContextValue {
  customers: Customer[];
  createCustomer: (fullName: string, phone: string, email?: string) => Customer;
}

const CustomersContext = createContext<CustomersContextValue | null>(null);

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(seedCustomers);

  const createCustomer = useCallback((fullName: string, phone: string, email?: string): Customer => {
    // buildCustomer can throw DomainError — propagate to caller so UI can display the error
    const newCustomer = buildCustomer(fullName, phone, email);
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  }, []);

  const value = useMemo<CustomersContextValue>(
    () => ({ customers, createCustomer }),
    [customers, createCustomer]
  );

  return <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>;
}

export function useCustomers(): CustomersContextValue {
  const ctx = useContext(CustomersContext);
  if (!ctx) throw new Error('useCustomers must be used within CustomersProvider');
  return ctx;
}
