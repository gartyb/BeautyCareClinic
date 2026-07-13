import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Customer } from '../types/Customer';
import { CustomerOrder } from '../types/Order';
import { Payment } from '../types/Payment';
import { Treatment } from '../types/Treatment';
import { Appointment } from '../types/Appointment';
import { Note } from '../types/Note';
import { TreatmentSeries } from '../types/TreatmentSeries';

import { customers } from '../data/customers';
import { orders } from '../data/orders';
import { payments } from '../data/payments';
import { treatments } from '../data/treatments';
import { appointments } from '../data/appointments';
import { notes } from '../data/notes';
import { treatmentSeries } from '../data/series';

interface CustomerContextValue {
  activeCustomer: Customer | null;
  setActiveCustomer: (customerId: string) => void;
  orders: CustomerOrder[];
  payments: Payment[];
  treatments: Treatment[];
  appointments: Appointment[];
  notes: Note[];
  treatmentSeries: TreatmentSeries[];
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);

  const setActiveCustomer = useCallback((customerId: string) => {
    setActiveCustomerId(customerId);
  }, []);

  const activeCustomer = useMemo(
    () => customers.find(c => c.id === activeCustomerId) ?? null,
    [activeCustomerId]
  );

  const customerOrders = useMemo(
    () => (activeCustomerId ? orders.filter(o => o.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const orderIds = useMemo(() => customerOrders.map(o => o.id), [customerOrders]);

  const customerPayments = useMemo(
    () => payments.filter(p => orderIds.includes(p.customerOrderId)),
    [orderIds]
  );

  const customerTreatments = useMemo(
    () => (activeCustomerId ? treatments.filter(t => t.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const customerAppointments = useMemo(
    () => (activeCustomerId ? appointments.filter(a => a.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const customerNotes = useMemo(
    () => (activeCustomerId ? notes.filter(n => n.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const customerSeries = useMemo(
    () => (activeCustomerId ? treatmentSeries.filter(s => s.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const value = useMemo<CustomerContextValue>(
    () => ({
      activeCustomer,
      setActiveCustomer,
      orders: customerOrders,
      payments: customerPayments,
      treatments: customerTreatments,
      appointments: customerAppointments,
      notes: customerNotes,
      treatmentSeries: customerSeries,
    }),
    [
      activeCustomer,
      setActiveCustomer,
      customerOrders,
      customerPayments,
      customerTreatments,
      customerAppointments,
      customerNotes,
      customerSeries,
    ]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
