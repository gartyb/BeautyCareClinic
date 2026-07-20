export { apiClient } from './apiClient';
export type { ApiError } from './apiError';
export { ApiRequestError } from './apiError';
export { packageTypesApi } from './packageTypesApi';
export { customerOrdersApi } from './customerOrdersApi';
export { paymentsApi } from './paymentsApi';
export { treatmentSeriesApi } from './treatmentSeriesApi';
export { treatmentsApi } from './treatmentsApi';
export type { CreateTreatmentRequest, UpdateTreatmentRequest } from './treatmentsApi';
export { notesApi } from './notesApi';
export type { CreateNoteRequest, UpdateNoteRequest } from './notesApi';
export { appointmentsApi } from './appointmentsApi';
export type { CreateAppointmentRequest, UpdateAppointmentRequest } from './appointmentsApi';
export { therapistAvailabilityApi } from './therapistAvailabilityApi';
export type {
  TherapistAvailabilityResponse,
  TherapistWorkingHoursApiDto,
  TherapistUnavailableDateApiDto,
  TherapistCapabilityApiDto,
} from './therapistAvailabilityApi';
