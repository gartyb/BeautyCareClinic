import { apiClient } from './apiClient';

/**
 * Phase 012 (RC-1) — write/management API for a therapist's treatment-type capabilities, closing
 * Phase 011's Q4 deferral. Lives under /api/v1/therapists/{userId}/capabilities. GET is any
 * authenticated user; POST/DELETE require the Manager role server-side.
 */
export interface TherapistCapabilityApiDto {
  id: string;
  userId: string;
  treatmentTypeId: string;
}

export const therapistCapabilityApi = {
  list: (userId: string) =>
    apiClient.get<TherapistCapabilityApiDto[]>(`/therapists/${userId}/capabilities`),

  add: (userId: string, treatmentTypeId: string) =>
    apiClient.post<TherapistCapabilityApiDto>(`/therapists/${userId}/capabilities`, { treatmentTypeId }),

  remove: (userId: string, treatmentTypeId: string) =>
    apiClient.delete<void>(`/therapists/${userId}/capabilities/${treatmentTypeId}`),
};
