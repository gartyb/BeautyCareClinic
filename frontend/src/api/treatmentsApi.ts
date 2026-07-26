import { apiClient } from './apiClient';
import type { Treatment } from '../types/Treatment';

export interface CreateTreatmentRequest {
  treatmentTypeId: string;
  treatmentSeriesId?: string;
  treatmentDate?: string;
  durationMinutes: number;
  notes?: string;
}

export interface UpdateTreatmentRequest {
  notes?: string;
}

export const treatmentsApi = {
  listByCustomer: (customerId: string) =>
    apiClient.get<Treatment[]>(`/customers/${customerId}/treatments`),

  getById: (id: string) =>
    apiClient.get<Treatment>(`/treatments/${id}`),

  create: (customerId: string, data: CreateTreatmentRequest) =>
    apiClient.post<Treatment>(`/customers/${customerId}/treatments`, data),

  update: (id: string, data: UpdateTreatmentRequest) =>
    apiClient.put<Treatment>(`/treatments/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/treatments/${id}`),
};
