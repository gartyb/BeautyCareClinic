import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Customer } from '../types/Customer';
import { CustomerOrder } from '../types/Order';
import { Payment } from '../types/Payment';
import { Treatment, TreatmentPhoto } from '../types/Treatment';
import { Appointment } from '../types/Appointment';
import { Note } from '../types/Note';
import { TreatmentSeries } from '../types/TreatmentSeries';
import { User } from '../types/User';
import { applyPaymentToOrder } from '../features/payment/paymentService';
import {
  toFloorMinutes,
  buildTimerTreatment,
  buildQuantityTreatment,
  applyTimerTreatmentToSeries,
  applyQuantityTreatmentToSeries,
} from '../features/treatment/treatmentService';

import { customers } from '../data/customers';
import { orders as initialOrders } from '../data/orders';
import { payments as initialPayments } from '../data/payments';
import { treatments as initialTreatments } from '../data/treatments';
import { appointments } from '../data/appointments';
import { notes as initialNotes } from '../data/notes';
import { treatmentSeries as initialSeries } from '../data/series';
import { packageTypes } from '../data/packageTypes';
import { newId as generateId } from '../domain/id';

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
  recordTimerTreatment: (seriesId: string, elapsedSeconds: number, currentUser: User) => void;
  recordQuantityTreatment: (seriesId: string, currentUser: User) => void;
  updateTreatmentNote: (treatmentId: string, notes: string) => void;
  addTreatmentPhoto: (treatmentId: string, photo: TreatmentPhoto) => void;
  removeTreatmentPhoto: (treatmentId: string, photoId: string) => void;
  addNote: (note: Note) => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>(initialOrders);
  const allOrdersRef = useRef<CustomerOrder[]>(initialOrders);
  useEffect(() => { allOrdersRef.current = allOrders; }, [allOrders]);
  const [allPayments, setAllPayments] = useState<Payment[]>(initialPayments);
  const [allSeries, setAllSeries] = useState<TreatmentSeries[]>(initialSeries);
  const allSeriesRef = useRef<TreatmentSeries[]>(initialSeries);
  useEffect(() => { allSeriesRef.current = allSeries; }, [allSeries]);
  const [allTreatments, setAllTreatments] = useState<Treatment[]>(initialTreatments);
  const [allNotes, setAllNotes] = useState<Note[]>(initialNotes);

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
    () => (activeCustomerId ? allTreatments.filter(t => t.customerId === activeCustomerId) : []),
    [activeCustomerId, allTreatments]
  );

  const customerAppointments = useMemo(
    () => (activeCustomerId ? appointments.filter(a => a.customerId === activeCustomerId) : []),
    [activeCustomerId]
  );

  const customerNotes = useMemo(
    () => (activeCustomerId ? allNotes.filter(n => n.customerId === activeCustomerId) : []),
    [activeCustomerId, allNotes]
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

  const recordTimerTreatment = useCallback(
    (seriesId: string, elapsedSeconds: number, currentUser: User) => {
      const series = allSeriesRef.current.find(s => s.id === seriesId);
      if (!series) return;

      const durationMinutes = toFloorMinutes(elapsedSeconds);
      if (durationMinutes === 0) return;

      const pkg = packageTypes.find(p => p.id === series.packageTypeId);
      if (!pkg) return;

      try {
        const updatedSeries = applyTimerTreatmentToSeries(series, durationMinutes);
        const treatment = buildTimerTreatment(
          {
            seriesId,
            customerId: series.customerId,
            treatmentTypeId: pkg.treatmentTypeId,
            therapistId: currentUser.id,
            durationMinutes,
          },
          {
            newId: generateId,
            now: () => new Date().toISOString().slice(0, 10),
          }
        );

        setAllSeries(prev => prev.map(s => s.id === updatedSeries.id ? updatedSeries : s));
        setAllTreatments(prev => [...prev, treatment]);
      } catch (e) {
        console.error('[recordTimerTreatment]', e);
      }
    },
    []
  );

  const recordQuantityTreatment = useCallback(
    (seriesId: string, currentUser: User) => {
      const series = allSeriesRef.current.find(s => s.id === seriesId);
      if (!series) return;

      const pkg = packageTypes.find(p => p.id === series.packageTypeId);
      if (!pkg) return;

      try {
        const updatedSeries = applyQuantityTreatmentToSeries(series);
        const treatment = buildQuantityTreatment(
          {
            seriesId,
            customerId: series.customerId,
            treatmentTypeId: pkg.treatmentTypeId,
            therapistId: currentUser.id,
          },
          {
            newId: generateId,
            now: () => new Date().toISOString().slice(0, 10),
          }
        );

        setAllSeries(prev => prev.map(s => s.id === updatedSeries.id ? updatedSeries : s));
        setAllTreatments(prev => [...prev, treatment]);
      } catch (e) {
        console.error('[recordQuantityTreatment]', e);
      }
    },
    []
  );

  const updateTreatmentNote = useCallback(
    (treatmentId: string, noteText: string) => {
      // FIX-1: empty string clears the note (maps to undefined on the Treatment)
      setAllTreatments(prev =>
        prev.map(t => t.id === treatmentId ? { ...t, notes: noteText || undefined } : t)
      );
    },
    []
  );

  const addTreatmentPhoto = useCallback(
    (treatmentId: string, photo: TreatmentPhoto) => {
      setAllTreatments(prev =>
        prev.map(t =>
          t.id === treatmentId
            ? { ...t, treatmentPhotos: [...t.treatmentPhotos, photo] }
            : t
        )
      );
    },
    []
  );

  const removeTreatmentPhoto = useCallback(
    (treatmentId: string, photoId: string) => {
      setAllTreatments(prev =>
        prev.map(t =>
          t.id === treatmentId
            ? { ...t, treatmentPhotos: t.treatmentPhotos.filter(p => p.id !== photoId) }
            : t
        )
      );
    },
    []
  );

  const addNote = useCallback(
    (note: Note) => {
      setAllNotes(prev => [...prev, note]);
    },
    []
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
      addOrder,
      addPayment,
      recordTimerTreatment,
      recordQuantityTreatment,
      updateTreatmentNote,
      addTreatmentPhoto,
      removeTreatmentPhoto,
      addNote,
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
      recordTimerTreatment,
      recordQuantityTreatment,
      updateTreatmentNote,
      addTreatmentPhoto,
      removeTreatmentPhoto,
      addNote,
    ]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
