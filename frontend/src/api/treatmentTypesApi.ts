import { apiClient } from './apiClient';

export interface TreatmentTypeDto {
  id: string;
  name: string;
  defaultDurationMinutes?: number;
  description?: string;
}

export interface CreateTreatmentTypeRequest {
  name: string;
  defaultDurationMinutes?: number;
}

export interface UpdateTreatmentTypeRequest {
  name: string;
  defaultDurationMinutes?: number;
}

export function getTreatmentTypes(): Promise<TreatmentTypeDto[]> {
  return apiClient.get<TreatmentTypeDto[]>('/treatment-types');
}

export function getTreatmentType(id: string): Promise<TreatmentTypeDto> {
  return apiClient.get<TreatmentTypeDto>(`/treatment-types/${id}`);
}

export function createTreatmentType(data: CreateTreatmentTypeRequest): Promise<TreatmentTypeDto> {
  return apiClient.post<TreatmentTypeDto>('/treatment-types', data);
}

export function updateTreatmentType(id: string, data: UpdateTreatmentTypeRequest): Promise<TreatmentTypeDto> {
  return apiClient.put<TreatmentTypeDto>(`/treatment-types/${id}`, data);
}

export function deleteTreatmentType(id: string): Promise<void> {
  return apiClient.delete<void>(`/treatment-types/${id}`);
}
