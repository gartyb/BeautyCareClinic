import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Customer } from '../types/Customer';
import { CustomerOrder } from '../types/Order';
import { Payment } from '../types/Payment';
import { Treatment } from '../types/Treatment';
import { Appointment } from '../types/Appointment';
import { Note } from '../types/Note';
import { TreatmentSeries } from '../types/TreatmentSeries';
import { applyPaymentToOrder } from '../features/payment/paymentService';

import { customers } from '../data/customers';
import { orders as initialOrders } from '../data/orders';
import { payments as initialPayments } from '../data/payments';
import { treatments } from '../data/treatments';
import { appointments } from '../data/appointments';
import { notes } from '../data/notes';
import { treatmentSeries as initialSeries } from '../data/series';

interface CustomerContextValue {
  activeCustomer: Customer | null;
  setActiveCustomer: (customerId: string) => void;
  orders: CustomerOrder[];
  payments: Payment[];
  treatments: Treatment[];
  appointments: Appointment[];
  notes: Note[];
  treatmentSeries: TreatmentSeries[];
  addOrder: (order: CustomerOrder, series: TreatmentSeries[]) => void;
  addPayment: (payment: Payment) => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>(initialOrders);
  const allOrdersRef = useRef<CustomerOrder[]>(initialOrders);
  useEffect(() => { allOrdersRef.current = allOrders; }, [allOrders]);
  const [allPayments, setAllPayments] = useState<Payment[]>(initialPayments);
  const [allSeries, setAllSeries] = useState<TreatmentSeries[]>(initialSeries);

  const setActiveCustomer = useCallback((customerId: string) => {
    setActiveCustomerId(customerId);
  }, []);

  const activeCustomer = useMemo(
    () => customers.find(c => c.id === activeCustomerId) ?? null,
    [activeCustomerId]
  );

  const customerOrders = useMemo(
    () => (activeCustomerId ? allOrders.filter(o => o.customerId === activeCustomerId) : []),
    [activeCustomerId, allOrders]
  );

  const orderIds = useMemo(() => customerOrders.map(o => o.id), [customerOrders]);

  const customerPayments = useMemo(
    () => allPayments.filter(p => orderIds.includes(p.customerOrderId)),
    [orderIds, allPayments]
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
    () => (activeCustomerId ? allSeries.filter(s => s.customerId === activeCustomerId) : []),
    [activeCustomerId, allSeries]
  );

  const addOrder = useCallback((order: CustomerOrder, seriesList: TreatmentSeries[]) => {
    setAllOrders(prev => [...prev, order]);
    setAllSeries(prev => [...prev, ...seriesList]);
  }, []);

  const addPayment = useCallback((payment: Payment) => {
    // Pre-compute outside setState so DomainError propagates to the caller
    // before any state mutation occurs (avoids orphaned payment in allPayments)
    const currentOrder = allOrdersRef.current.find(o => o.id === payment.customerOrderId);
    if (!currentOrder) return;
    const updatedOrder = applyPaymentToOrder(currentOrder, payment); // throws DomainError if guard fails
    setAllOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setAllPayments(prev => [...prev, payment]);
  }, []);

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
      addOrder,
      addPayment,
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
      addOrder,
      addPayment,
    ]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
