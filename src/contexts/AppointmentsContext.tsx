import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Appointment } from '../types/Appointment';
import { appointments as seedAppointments } from '../data/appointments';
import { buildAppointment, cancelAppointmentInList, rescheduleAppointmentInList, updateAppointmentStatusInList } from '../features/appointments/appointmentService';
import { newId } from '../domain/id';

interface AppointmentsContextValue {
  appointments: Appointment[];
  createAppointment: (
    customerId: string,
    treatmentTypeId: string,
    therapistId: string,
    appointmentDateTime: string,
    durationMinutes: number
  ) => Appointment;
  cancelAppointment: (appointmentId: string) => void;
  rescheduleAppointment: (appointmentId: string, newDateTime: string, newTherapistId: string) => void;
  updateAppointmentStatus: (appointmentId: string, status: Appointment['status']) => void;
}

const AppointmentsContext = createContext<AppointmentsContextValue | null>(null);

export function AppointmentsProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);

  const createAppointment = useCallback(
    (
      customerId: string,
      treatmentTypeId: string,
      therapistId: string,
      appointmentDateTime: string,
      durationMinutes: number
    ): Appointment => {
      const appt = buildAppointment(
        customerId,
        treatmentTypeId,
        therapistId,
        appointmentDateTime,
        durationMinutes,
        { newId }
      );
      setAppointments(prev => [...prev, appt]);
      return appt;
    },
    []
  );

  const cancelAppointment = useCallback((appointmentId: string): void => {
    setAppointments(prev => cancelAppointmentInList(prev, appointmentId));
  }, []);

  const rescheduleAppointment = useCallback((appointmentId: string, newDateTime: string, newTherapistId: string): void => {
    setAppointments(prev => rescheduleAppointmentInList(prev, appointmentId, newDateTime, newTherapistId));
  }, []);

  const updateAppointmentStatus = useCallback((appointmentId: string, status: Appointment['status']): void => {
    setAppointments(prev => updateAppointmentStatusInList(prev, appointmentId, status));
  }, []);

  const value = useMemo<AppointmentsContextValue>(
    () => ({ appointments, createAppointment, cancelAppointment, rescheduleAppointment, updateAppointmentStatus }),
    [appointments, createAppointment, cancelAppointment, rescheduleAppointment, updateAppointmentStatus]
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
