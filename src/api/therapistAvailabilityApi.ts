import { apiClient } from './apiClient';

/**
 * Phase 011 Architecture Review Correction #1 — read-only exposure of therapist working hours /
 * unavailable dates / capabilities, keyed by real `User.Id` GUIDs. No write/management API for
 * this data exists yet (Q4 stays deferred) — these types intentionally have no create/update/
 * delete counterparts here.
 */
export interface TherapistWorkingHoursApiDto {
  id: string;
  userId: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday, matching Date.getDay()
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface TherapistUnavailableDateApiDto {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
}

export interface TherapistCapabilityApiDto {
  id: string;
  userId: string;
  treatmentTypeId: string;
}

export interface TherapistAvailabilityResponse {
  workingHours: TherapistWorkingHoursApiDto[];
  unavailableDates: TherapistUnavailableDateApiDto[];
  capabilities: TherapistCapabilityApiDto[];
}

/**
 * Bugfix follow-up: minimal name+id-only projection of Role=Therapist users, backing
 * GET /api/v1/therapists (any authenticated user, not Manager-gated — same access level as the
 * `.get()` availability call above). Deliberately does not carry email/phone (see UserApiDto in
 * usersApi.ts for the full, Manager-only shape); this is only meant for populating the
 * appointment-booking therapist picker.
 */
export interface TherapistSummaryApiDto {
  id: string;
  fullName: string;
}

export const therapistAvailabilityApi = {
  get: () =>
    apiClient.get<TherapistAvailabilityResponse>('/therapists/availability'),
  getTherapists: () =>
    apiClient.get<TherapistSummaryApiDto[]>('/therapists'),
};
