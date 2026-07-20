import { apiClient } from './apiClient';
import type { Appointment } from '../types/Appointment';

export interface CreateAppointmentRequest {
  treatmentTypeId: string;
  userId: string;
  startTime: string;
  endTime: string;
}

export interface UpdateAppointmentRequest {
  userId: string;
  startTime: string;
  endTime: string;
}

export const appointmentsApi = {
  listAll: () =>
    apiClient.get<Appointment[]>('/appointments'),

  listByCustomer: (customerId: string) =>
    apiClient.get<Appointment[]>(`/customers/${customerId}/appointments`),

  getById: (id: string) =>
    apiClient.get<Appointment>(`/appointments/${id}`),

  create: (customerId: string, data: CreateAppointmentRequest) =>
    apiClient.post<Appointment>(`/customers/${customerId}/appointments`, data),

  update: (id: string, data: UpdateAppointmentRequest) =>
    apiClient.put<Appointment>(`/appointments/${id}`, data),

  cancel: (id: string) =>
    apiClient.delete<void>(`/appointments/${id}`),
};
