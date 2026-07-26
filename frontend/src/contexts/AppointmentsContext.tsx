import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appointment } from '../types/Appointment';
import { appointmentsApi } from '../api/appointmentsApi';
import { ApiRequestError } from '../api/apiError';
import { useAuth } from './AuthContext';

interface AppointmentsContextValue {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAppointment: (
    customerId: string,
    treatmentTypeId: string,
    userId: string,
    startTime: string,
    endTime: string
  ) => Promise<Appointment>;
  cancelAppointment: (appointmentId: string) => Promise<void>;
  rescheduleAppointment: (
    appointmentId: string,
    userId: string,
    startTime: string,
    endTime: string
  ) => Promise<Appointment>;
}

const AppointmentsContext = createContext<AppointmentsContextValue | null>(null);

export function AppointmentsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await appointmentsApi.listAll();
      if (isCancelled?.()) return;
      setAppointments(data);
    } catch (e) {
      if (isCancelled?.()) return;
      const msg = e instanceof ApiRequestError ? e.error.message : 'שגיאה בטעינת התורים';
      setError(msg);
    } finally {
      if (!isCancelled?.()) setIsLoading(false);
    }
  }, []);

  // Load once the user is authenticated (covers both session restore and fresh login) — matches
  // the auth-gated fetch pattern used by CustomersContext/TreatmentTypesContext (v0.10.1 fix for
  // "data not loading after first login").
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchAll(() => cancelled);
    return () => { cancelled = true; };
  }, [currentUser, fetchAll]);

  const refresh = useCallback(() => fetchAll(), [fetchAll]);

  const createAppointment = useCallback(
    async (
      customerId: string,
      treatmentTypeId: string,
      userId: string,
      startTime: string,
      endTime: string
    ): Promise<Appointment> => {
      const appt = await appointmentsApi.create(customerId, { treatmentTypeId, userId, startTime, endTime });
      await fetchAll();
      return appt;
    },
    [fetchAll]
  );

  const cancelAppointment = useCallback(async (appointmentId: string): Promise<void> => {
    await appointmentsApi.cancel(appointmentId);
    await fetchAll();
  }, [fetchAll]);

  const rescheduleAppointment = useCallback(
    async (
      appointmentId: string,
      userId: string,
      startTime: string,
      endTime: string
    ): Promise<Appointment> => {
      const appt = await appointmentsApi.update(appointmentId, { userId, startTime, endTime });
      await fetchAll();
      return appt;
    },
    [fetchAll]
  );

  const value = useMemo<AppointmentsContextValue>(
    () => ({ appointments, isLoading, error, refresh, createAppointment, cancelAppointment, rescheduleAppointment }),
    [appointments, isLoading, error, refresh, createAppointment, cancelAppointment, rescheduleAppointment]
  );

  return (
    <AppointmentsContext.Provider value={value}>
      {children}
    </AppointmentsContext.Provider>
  );
}

export function useAppointments(): AppointmentsContextValue {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error('useAppointments must be used within AppointmentsProvider');
  return ctx;
}
