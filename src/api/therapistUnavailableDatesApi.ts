import { apiClient } from './apiClient';

/**
 * Phase 012 (RC-1) — write/management API for a therapist's one-off unavailable dates, closing
 * Phase 011's Q4 deferral. Lives under /api/v1/therapists/{userId}/unavailable-dates. GET is any
 * authenticated user; POST/DELETE require the Manager role server-side.
 */
export interface TherapistUnavailableDateApiDto {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
}

export const therapistUnavailableDatesApi = {
  list: (userId: string) =>
    apiClient.get<TherapistUnavailableDateApiDto[]>(`/therapists/${userId}/unavailable-dates`),

  add: (userId: string, date: string) =>
    apiClient.post<TherapistUnavailableDateApiDto>(`/therapists/${userId}/unavailable-dates`, { date }),

  remove: (userId: string, date: string) =>
    apiClient.delete<void>(`/therapists/${userId}/unavailable-dates/${date}`),
};
