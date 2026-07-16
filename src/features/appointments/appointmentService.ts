import { Appointment } from '../../types/Appointment';
import { User } from '../../types/User';
import { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';
import { DomainError } from '../../domain/errors';
import { newId as defaultNewId } from '../../domain/id';

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns naive local ISO string YYYY-MM-DDTHH:mm:ss (no timezone offset).
 * Used as the "now" reference for all appointment datetime comparisons.
 */
function localNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/**
 * Add minutes to an HH:MM string. Returns HH:MM string.
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  const totalMinutes = hh * 60 + mm + minutes;
  const newHH = Math.floor(totalMinutes / 60);
  const newMM = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(newHH)}:${pad(newMM)}`;
}

// ─── buildAppointment ─────────────────────────────────────────────────────────

export interface BuildAppointmentDeps {
  newId?: () => string;
  now?: () => string;
}

export function buildAppointment(
  customerId: string,
  treatmentTypeId: string,
  therapistId: string,
  appointmentDateTime: string,
  durationMinutes: number,
  deps?: BuildAppointmentDeps
): Appointment {
  const getId = deps?.newId ?? defaultNewId;
  const getNow = deps?.now ?? localNow;

  if (!customerId.trim()) {
    throw new DomainError('INVALID_CUSTOMER', 'נדרש מזהה לקוחה');
  }
  if (!treatmentTypeId.trim()) {
    throw new DomainError('INVALID_TREATMENT_TYPE', 'נדרש מזהה סוג טיפול');
  }
  if (!therapistId.trim()) {
    throw new DomainError('INVALID_THERAPIST', 'נדרש מזהה מטפלת');
  }
  if (!appointmentDateTime || new Date(appointmentDateTime) <= new Date(getNow())) {
    throw new DomainError('INVALID_APPOINTMENT_DATE', 'תאריך התור חייב להיות בעתיד');
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new DomainError('INVALID_DURATION', 'משך התור חייב להיות מספר שלם גדול מ-0');
  }

  return {
    id: getId(),
    customerId,
    treatmentTypeId,
    therapistId,
    appointmentDateTime,
    durationMinutes,
    status: 'Scheduled',
    createdDate: getNow(),
  };
}

// ─── updateAppointmentStatus ──────────────────────────────────────────────────

export function updateAppointmentStatusInList(
  appointments: Appointment[],
  appointmentId: string,
  status: Appointment['status']
): Appointment[] {
  const found = appointments.find(a => a.id === appointmentId);
  if (!found) throw new DomainError('APPOINTMENT_NOT_FOUND', 'התור לא נמצא');
  return appointments.map(a => a.id === appointmentId ? { ...a, status } : a);
}

// ─── rescheduleAppointmentInList ─────────────────────────────────────────────

export function rescheduleAppointmentInList(
  appointments: Appointment[],
  appointmentId: string,
  newDateTime: string,
  newTherapistId: string,
  deps?: { now?: () => string }
): Appointment[] {
  const getNow = deps?.now ?? localNow;
  const found = appointments.find(a => a.id === appointmentId);
  if (!found) throw new DomainError('APPOINTMENT_NOT_FOUND', 'התור לא נמצא');
  if (found.status === 'Cancelled') throw new DomainError('APPOINTMENT_CANCELLED', 'לא ניתן לעדכן תור מבוטל');
  if (new Date(newDateTime) <= new Date(getNow())) throw new DomainError('INVALID_APPOINTMENT_DATE', 'תאריך התור חייב להיות בעתיד');
  return appointments.map(a =>
    a.id === appointmentId ? { ...a, appointmentDateTime: newDateTime, therapistId: newTherapistId } : a
  );
}

// ─── cancelAppointmentInList ──────────────────────────────────────────────────

export function cancelAppointmentInList(
  appointments: Appointment[],
  appointmentId: string
): Appointment[] {
  const found = appointments.find(a => a.id === appointmentId);
  if (!found) {
    throw new DomainError('APPOINTMENT_NOT_FOUND', 'התור לא נמצא');
  }
  return appointments.map(a =>
    a.id === appointmentId ? { ...a, status: 'Cancelled' } : a
  );
}

// ─── getAppointmentInterval ───────────────────────────────────────────────────

export function getAppointmentInterval(
  appointment: Appointment
): { start: Date; end: Date } {
  const start = new Date(appointment.appointmentDateTime);
  const end = new Date(start.getTime() + appointment.durationMinutes * 60000);
  return { start, end };
}

// ─── isSlotAvailable — THE SINGLE AVAILABILITY PRIMITIVE ─────────────────────

export function isSlotAvailable(
  date: string,           // YYYY-MM-DD
  startTime: string,      // HH:MM
  durationMinutes: number,
  therapistId: string,
  workingHours: TherapistWorkingHours[],
  unavailableDates: TherapistUnavailableDate[],
  capabilities: TherapistCapability[],
  treatmentTypeId: string,
  existingAppointments: Appointment[]
): boolean {
  // Step 1: Working hours
  const dayDate = new Date(date + 'T00:00:00');
  const weekday = dayDate.getDay(); // 0=Sun, 6=Sat

  const whRow = workingHours.find(
    wh => wh.userId === therapistId && wh.weekday === weekday
  );
  if (!whRow || !whRow.startTime || !whRow.endTime) return false;

  const slotEndTime = addMinutesToTime(startTime, durationMinutes);
  if (startTime < whRow.startTime || slotEndTime > whRow.endTime) return false;

  // Step 2: Not in unavailable dates
  const isUnavailable = unavailableDates.some(
    ud => ud.userId === therapistId && ud.date === date
  );
  if (isUnavailable) return false;

  // Step 3: Has capability for treatment type
  const hasCapability = capabilities.some(
    cap => cap.userId === therapistId && cap.treatmentTypeId === treatmentTypeId
  );
  if (!hasCapability) return false;

  // Step 4: No overlap with scheduled appointments
  const slotStart = new Date(date + 'T' + startTime + ':00');
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

  for (const appt of existingAppointments) {
    if (appt.therapistId !== therapistId) continue;
    if (appt.status === 'Cancelled') continue;

    const { start: aStart, end: aEnd } = getAppointmentInterval(appt);
    // Overlap: aStart < slotEnd AND aEnd > slotStart
    if (aStart < slotEnd && aEnd > slotStart) return false;
  }

  return true;
}

// ─── getAvailableSlots ────────────────────────────────────────────────────────

export function getAvailableSlots(
  date: string,           // YYYY-MM-DD
  therapistId: string,
  durationMinutes: number,
  workingHours: TherapistWorkingHours[],
  unavailableDates: TherapistUnavailableDate[],
  capabilities: TherapistCapability[],
  treatmentTypeId: string,
  existingAppointments: Appointment[]
): string[] {
  // Get weekday for the date
  const dayDate = new Date(date + 'T00:00:00');
  const weekday = dayDate.getDay();

  const whRow = workingHours.find(
    wh => wh.userId === therapistId && wh.weekday === weekday
  );
  if (!whRow || !whRow.startTime || !whRow.endTime) return [];

  // Check unavailable dates early
  const isUnavailable = unavailableDates.some(
    ud => ud.userId === therapistId && ud.date === date
  );
  if (isUnavailable) return [];

  // Generate 30-min buckets from startTime to endTime
  const buckets: string[] = [];
  let current = whRow.startTime;
  while (current < whRow.endTime) {
    const bucketEnd = addMinutesToTime(current, durationMinutes);
    if (bucketEnd <= whRow.endTime) {
      buckets.push(current);
    }
    current = addMinutesToTime(current, 30);
    if (current >= whRow.endTime) break;
  }

  return buckets.filter(bucket =>
    isSlotAvailable(
      date,
      bucket,
      durationMinutes,
      therapistId,
      workingHours,
      unavailableDates,
      capabilities,
      treatmentTypeId,
      existingAppointments
    )
  );
}

// ─── getAvailableTherapists ───────────────────────────────────────────────────

export function getAvailableTherapists(
  date: string,           // YYYY-MM-DD
  treatmentTypeId: string,
  therapists: User[],
  workingHours: TherapistWorkingHours[],
  unavailableDates: TherapistUnavailableDate[],
  capabilities: TherapistCapability[],
  existingAppointments: Appointment[]
): User[] {
  const dayDate = new Date(date + 'T00:00:00');
  const weekday = dayDate.getDay();

  return therapists.filter(therapist => {
    if (therapist.role !== 'Therapist') return false;

    // Must have working hours on weekday
    const whRow = workingHours.find(
      wh => wh.userId === therapist.id && wh.weekday === weekday
    );
    if (!whRow || !whRow.startTime || !whRow.endTime) return false;

    // Must not be in unavailable dates
    const isUnavailable = unavailableDates.some(
      ud => ud.userId === therapist.id && ud.date === date
    );
    if (isUnavailable) return false;

    // Must have capability for treatment type
    const hasCapability = capabilities.some(
      cap => cap.userId === therapist.id && cap.treatmentTypeId === treatmentTypeId
    );
    if (!hasCapability) return false;

    // Must have at least one available slot (use 30-min minimum check)
    const slots = getAvailableSlots(
      date,
      therapist.id,
      30,
      workingHours,
      unavailableDates,
      capabilities,
      treatmentTypeId,
      existingAppointments
    );
    return slots.length > 0;
  });
}

// ─── getNextAppointment ───────────────────────────────────────────────────────

export function getNextAppointment(
  customerId: string,
  appointments: Appointment[]
): Appointment | null {
  const now = localNow();
  const future = appointments.filter(
    a =>
      a.status === 'Scheduled' &&
      a.customerId === customerId &&
      a.appointmentDateTime > now
  );
  if (future.length === 0) return null;
  future.sort((a, b) => a.appointmentDateTime.localeCompare(b.appointmentDateTime));
  return future[0] ?? null;
}
