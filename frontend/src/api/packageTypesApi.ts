import { apiClient } from './apiClient';
import type { PackageType } from '../types/PackageType';

export interface CreatePackageTypeRequest {
  name: string;
  price: number;
  treatmentTypeId: string;
  isSeries: boolean;
  isTimerBased: boolean;
  treatmentCount?: number;
  minutesPerTreatment?: number;
}

export interface UpdatePackageTypeRequest extends CreatePackageTypeRequest {}

export const packageTypesApi = {
  list: () => apiClient.get<PackageType[]>('/package-types'),
  getById: (id: string) => apiClient.get<PackageType>(`/package-types/${id}`),
  create: (data: CreatePackageTypeRequest) => apiClient.post<PackageType>('/package-types', data),
  update: (id: string, data: UpdatePackageTypeRequest) => apiClient.put<PackageType>(`/package-types/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/package-types/${id}`),
};
