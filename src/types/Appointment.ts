export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Appointment {
  id: string;
  customerId: string;
  treatmentTypeId: string;
  therapistId: string;
  appointmentDateTime: string; // ISO datetime
  status: AppointmentStatus;
  createdDate: string;
}
