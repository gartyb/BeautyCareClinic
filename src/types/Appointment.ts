// Matches the backend's AppointmentStatus enum (BeautyCareClinic.Domain.Enums.AppointmentStatus).
// Phase 011 MVP only ever produces 'Scheduled' or 'Cancelled' via the API (Q2) — 'Completed'/
// 'NoShow' are kept in the union for forward-compatibility with the enum, but the frontend has no
// UI to set them in this phase.
export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';

// Aligned field-for-field with the backend's AppointmentDto
// (backend/BeautyCareClinic.Application/DTOs/AppointmentDtos.cs). Phase 011 Q1: `therapistId` was
// renamed to `userId` to match the backend and every other Phase 007-010 integration.
export interface Appointment {
  id: string;
  customerId: string;
  treatmentTypeId: string;
  treatmentTypeName: string;
  userId: string;
  userFullName: string;
  startTime: string;  // naive local ISO: YYYY-MM-DDTHH:mm:ss
  endTime: string;    // naive local ISO: YYYY-MM-DDTHH:mm:ss
  status: AppointmentStatus;
  createdAt: string;  // naive local ISO
}
