import { apiClient } from './apiClient';
import type { TreatmentSeries } from '../types/TreatmentSeries';

export const treatmentSeriesApi = {
  listActiveByCustomer: (customerId: string) =>
    apiClient.get<TreatmentSeries[]>(`/customers/${customerId}/treatment-series`),
  getById: (id: string) =>
    apiClient.get<TreatmentSeries>(`/treatment-series/${id}`),
};
