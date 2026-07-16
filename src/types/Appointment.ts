export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'NoShow';

export interface Appointment {
  id: string;
  customerId: string;
  treatmentTypeId: string;
  therapistId: string;
  appointmentDateTime: string; // naive local ISO: YYYY-MM-DDTHH:mm:ss
  durationMinutes: number;     // > 0
  status: AppointmentStatus;
  createdDate: string;         // naive local ISO
}
