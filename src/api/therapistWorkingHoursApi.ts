import { apiClient } from './apiClient';

/**
 * Phase 012 (RC-1) — write/management API for a therapist's weekly working hours, closing Phase
 * 011's Q4 deferral. Lives under /api/v1/therapists/{userId}/working-hours (not /users/{userId}/...
 * — see the architecture-review correction on TherapistAvailabilityController.cs). GET is any
 * authenticated user; POST/PUT/DELETE require the Manager role server-side.
 */
export interface TherapistWorkingHoursApiDto {
  id: string;
  userId: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday, matching Date.getDay()
  startTime: string; // "HH:mm", empty string for a day-off row
  endTime: string;
}

export interface UpsertWorkingHoursApiRequest {
  startTime: string | null;
  endTime: string | null;
}

export const therapistWorkingHoursApi = {
  list: (userId: string) =>
    apiClient.get<TherapistWorkingHoursApiDto[]>(`/therapists/${userId}/working-hours`),

  /** Upserts (creates if none exists yet for this weekday, replaces it otherwise). */
  upsert: (userId: string, weekday: number, data: UpsertWorkingHoursApiRequest) =>
    apiClient.put<TherapistWorkingHoursApiDto>(`/therapists/${userId}/working-hours/${weekday}`, data),

  remove: (userId: string, weekday: number) =>
    apiClient.delete<void>(`/therapists/${userId}/working-hours/${weekday}`),
};
