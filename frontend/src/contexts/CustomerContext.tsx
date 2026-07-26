import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Customer } from '../types/Customer';
import { CustomerOrder } from '../types/Order';
import { Payment } from '../types/Payment';
import { Treatment, TreatmentPhoto } from '../types/Treatment';
import { Note } from '../types/Note';
import { TreatmentSeries, SeriesKind } from '../types/TreatmentSeries';
import { User } from '../types/User';
import { toFloorMinutes } from '../features/treatment/treatmentService';

import { useCustomers } from './CustomersContext';
import { usePackageTypes } from './PackageTypesContext';

import { treatmentsApi } from '../api/treatmentsApi';
import { treatmentSeriesApi } from '../api/treatmentSeriesApi';
import { notesApi } from '../api/notesApi';
import { customerOrdersApi } from '../api/customerOrdersApi';
import { paymentsApi } from '../api/paymentsApi';

interface CustomerContextValue {
  activeCustomer: Customer | null;
  setActiveCustomer: (customerId: string) => void;
  orders: CustomerOrder[];
  payments: Payment[];
  treatments: Treatment[];
  notes: Note[];
  treatmentSeries: TreatmentSeries[];
  allSeries: TreatmentSeries[];
  addOrder: (customerId: string, packageTypeIds: string[], maxPaymentCount?: number) => Promise<void>;
  addPayment: (orderId: string, amount: number, paymentMethod: string, paymentDate: string) => Promise<void>;
  recordTimerTreatment: (seriesId: string, elapsedSeconds: number, currentUser: User) => Promise<void>;
  recordQuantityTreatment: (seriesId: string, currentUser: User) => Promise<void>;
  addTreatmentPhoto: (treatmentId: string, photo: TreatmentPhoto) => void;
  removeTreatmentPhoto: (treatmentId: string, photoId: string) => void;
  refreshTreatments: () => Promise<void>;
  refreshNotes: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const { customers } = useCustomers();
  const { packageTypes } = usePackageTypes();
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [allOrders, setAllOrders] = useState<CustomerOrder[]>([]);
  const allOrdersRef = useRef<CustomerOrder[]>([]);
  useEffect(() => { allOrdersRef.current = allOrders; }, [allOrders]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [allSeries, setAllSeries] = useState<TreatmentSeries[]>([]);
  const allSeriesRef = useRef<TreatmentSeries[]>([]);
  useEffect(() => { allSeriesRef.current = allSeries; }, [allSeries]);
  const [allTreatments, setAllTreatments] = useState<Treatment[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);

  const setActiveCustomer = useCallback((customerId: string) => {
    setActiveCustomerId(customerId);
  }, []);

  const activeCustomer = useMemo(
    () => customers.find(c => c.id === activeCustomerId) ?? null,
    [activeCustomerId, customers]
  );

  const customerOrders = useMemo(
    () => (activeCustomerId ? allOrders.filter(o => o.customerId === activeCustomerId) : []),
    [activeCustomerId, allOrders]
  );

  const orderIds = useMemo(() => customerOrders.map(o => o.id), [customerOrders]);

  const customerPayments = useMemo(
    () => allPayments.filter(p => orderIds.includes(p.orderId ?? p.customerOrderId ?? '')),
    [orderIds, allPayments]
  );

  const customerTreatments = useMemo(
    () => (activeCustomerId ? allTreatments.filter(t => t.customerId === activeCustomerId) : []),
    [activeCustomerId, allTreatments]
  );

  const customerNotes = useMemo(
    () => (activeCustomerId ? allNotes.filter(n => n.customerId === activeCustomerId) : []),
    [activeCustomerId, allNotes]
  );

  const customerSeries = useMemo(
    () => (activeCustomerId ? allSeries.filter(s => s.customerId === activeCustomerId) : []),
    [activeCustomerId, allSeries]
  );

  // ─── Internal helper: refresh all customer data from API ─────────────────

  const refreshForCustomer = useCallback(async (customerId: string) => {
    const [apiTreatments, apiSeries, apiNotes, apiOrders] = await Promise.all([
      treatmentsApi.listByCustomer(customerId),
      treatmentSeriesApi.listActiveByCustomer(customerId),
      notesApi.listByCustomer(customerId),
      customerOrdersApi.listByCustomer(customerId),
    ]);

    const paymentsArrays = await Promise.all(
      apiOrders.map(o => paymentsApi.listByOrder(o.id).catch(() => [] as Payment[]))
    );
    const apiPayments = paymentsArrays.flat();

    const mappedSeries: TreatmentSeries[] = apiSeries.map(s => ({
      ...s,
      customerId,
      seriesKind: (s.isTimerBased ? 'timer' : 'quantity') as SeriesKind,
    }));

    setAllTreatments(prev => [...prev.filter(t => t.customerId !== customerId), ...apiTreatments]);
    setAllSeries(prev => [...prev.filter(s => s.customerId !== customerId), ...mappedSeries]);
    setAllNotes(prev => [...prev.filter(n => n.customerId !== customerId), ...apiNotes]);
    setAllOrders(prev => [...prev.filter(o => o.customerId !== customerId), ...apiOrders]);
    setAllPayments(prev => {
      const orderIdSet = new Set(apiOrders.map(o => o.id));
      return [...prev.filter(p => !orderIdSet.has(p.orderId ?? p.customerOrderId ?? '')), ...apiPayments];
    });
  }, []);

  // ─── Load API data when active customer changes ───────────────────────────

  useEffect(() => {
    if (!activeCustomerId) return;
    refreshForCustomer(activeCustomerId).catch(console.error);
  }, [activeCustomerId, refreshForCustomer]);

  // ─── Orders / Payments ────────────────────────────────────────────────────

  const addOrder = useCallback(
    async (customerId: string, packageTypeIds: string[], maxPaymentCount?: number): Promise<void> => {
      await customerOrdersApi.create(customerId, {
        discountPercentage: 0,
        maxPaymentCount,
        items: packageTypeIds.map(id => ({ packageTypeId: id })),
      });
      await refreshForCustomer(customerId);
    },
    [refreshForCustomer]
  );

  const addPayment = useCallback(
    async (orderId: string, amount: number, paymentMethod: string, paymentDate: string): Promise<void> => {
      const order = allOrdersRef.current.find(o => o.id === orderId);
      if (!order?.customerId) throw new Error('ההזמנה לא נמצאה');
      await paymentsApi.create(orderId, { amount, paymentMethod, paymentDate });
      await refreshForCustomer(order.customerId);
    },
    [refreshForCustomer]
  );

  // ─── Treatment recording — calls API then refreshes ───────────────────────

  const recordTimerTreatment = useCallback(
    async (seriesId: string, elapsedSeconds: number, _currentUser: User): Promise<void> => {
      const series = allSeriesRef.current.find(s => s.id === seriesId);
      if (!series || !series.customerId) throw new Error('סדרת הטיפולים לא נמצאה');

      const durationMinutes = toFloorMinutes(elapsedSeconds);
      if (durationMinutes === 0) throw new Error('משך הטיפול חייב להיות לפחות דקה אחת');

      const treatmentTypeId = series.treatmentTypeId
        ?? packageTypes.find(p => p.id === series.packageTypeId)?.treatmentTypeId;
      if (!treatmentTypeId) throw new Error('סוג הטיפול לא זוהה');

      const customerId = series.customerId;
      await treatmentsApi.create(customerId, {
        treatmentTypeId,
        treatmentSeriesId: seriesId,
        durationMinutes,
      });
      await refreshForCustomer(customerId);
    },
    [packageTypes, refreshForCustomer]
  );

  const recordQuantityTreatment = useCallback(
    async (seriesId: string, _currentUser: User): Promise<void> => {
      const series = allSeriesRef.current.find(s => s.id === seriesId);
      if (!series || !series.customerId) throw new Error('סדרת הטיפולים לא נמצאה');

      const treatmentTypeId = series.treatmentTypeId
        ?? packageTypes.find(p => p.id === series.packageTypeId)?.treatmentTypeId;
      if (!treatmentTypeId) throw new Error('סוג הטיפול לא זוהה');

      const customerId = series.customerId;
      await treatmentsApi.create(customerId, {
        treatmentTypeId,
        treatmentSeriesId: seriesId,
        durationMinutes: 0,
      });
      await refreshForCustomer(customerId);
    },
    [packageTypes, refreshForCustomer]
  );

  // ─── Photos (in-memory only — Phase 011 will add API) ────────────────────

  const addTreatmentPhoto = useCallback(
    (treatmentId: string, photo: TreatmentPhoto) => {
      setAllTreatments(prev =>
        prev.map(t =>
          t.id === treatmentId
            ? { ...t, treatmentPhotos: [...(t.treatmentPhotos ?? []), photo] }
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
            ? { ...t, treatmentPhotos: (t.treatmentPhotos ?? []).filter(p => p.id !== photoId) }
            : t
        )
      );
    },
    []
  );

  // ─── Public refresh functions for child components ────────────────────────

  const refreshTreatments = useCallback(async () => {
    if (!activeCustomerId) return;
    await refreshForCustomer(activeCustomerId);
  }, [activeCustomerId, refreshForCustomer]);

  const refreshNotes = useCallback(async () => {
    if (!activeCustomerId) return;
    await refreshForCustomer(activeCustomerId);
  }, [activeCustomerId, refreshForCustomer]);

  const value = useMemo<CustomerContextValue>(
    () => ({
      activeCustomer,
      setActiveCustomer,
      orders: customerOrders,
      payments: customerPayments,
      treatments: customerTreatments,
      notes: customerNotes,
      treatmentSeries: customerSeries,
      allSeries,
      addOrder,
      addPayment,
      recordTimerTreatment,
      recordQuantityTreatment,
      addTreatmentPhoto,
      removeTreatmentPhoto,
      refreshTreatments,
      refreshNotes,
    }),
    [
      activeCustomer,
      setActiveCustomer,
      customerOrders,
      customerPayments,
      customerTreatments,
      customerNotes,
      customerSeries,
      allSeries,
      addOrder,
      addPayment,
      recordTimerTreatment,
      recordQuantityTreatment,
      addTreatmentPhoto,
      removeTreatmentPhoto,
      refreshTreatments,
      refreshNotes,
    ]
  );

  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error('useCustomer must be used within CustomerProvider');
  return ctx;
}
