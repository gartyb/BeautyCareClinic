import { Appointment } from '../../types/Appointment';
import { User } from '../../types/User';
import { TherapistWorkingHours, TherapistUnavailableDate, TherapistCapability } from '../../types/Therapist';

// ─── Phase 011 note ────────────────────────────────────────────────────────────
//
// Prior to Phase 011, this module owned both (a) pure client-side availability filtering and
// (b) local in-memory list mutations (buildAppointment / cancelAppointmentInList /
// rescheduleAppointmentInList / updateAppointmentStatusInList) that AppointmentsContext used to
// simulate a backend against mock data.
//
// Now that AppointmentsContext calls the real API (POST/PUT/DELETE), the backend is the
// authoritative source of truth for validation and availability (409 Hebrew conflict messages,
// per ADR-011-A). The list-mutation helpers were removed as dead code — they operated on a local
// array that no longer exists.
//
// The pure availability-filtering functions below (isSlotAvailable / getAvailableSlots /
// getAvailableTherapists) were KEPT deliberately, per the architecture review's guidance: they
// are useful client-side UX pre-filtering (greying out / hiding obviously-unavailable
// therapists/slots before the user submits), the same way RecordPaymentModal/TreatmentModal do
// client-side pre-validation before calling the API. They still return the correct answer now
// that they're fed real data (real userId GUIDs, real working-hours/capability/unavailable-date
// rows from GET /api/v1/therapists/availability, real appointments from GET /api/v1/appointments)
// instead of mock arrays — the algorithm itself never depended on the IDs being fake, only the
// data sources did. The backend remains authoritative: a 409 from the API is still possible even
// when the client-side pre-filter said a slot looked available (e.g. a concurrent booking beat
// the user to it), and callers must still handle that.

/**
 * Returns naive local ISO string YYYY-MM-DDTHH:mm:ss (no timezone offset/Z suffix), matching the
 * convention Appointment.startTime/endTime are stored in. Used as the "now" reference for
 * getNextAppointment — deliberately NOT `new Date().toISOString()`, which returns a UTC-suffixed
 * string ("...Z") that string-compares incorrectly against a naive-local value (same bug class as
 * FU-019).
 */
export function localNow(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

/**
 * Add minutes to an HH:MM string. Returns HH:MM string. Does not handle day rollover (matches
 * pre-existing behavior — appointment durations are expected to stay within a single day).
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hh, mm] = time.split(':').map(Number);
  const totalMinutes = hh * 60 + mm + minutes;
  const newHH = Math.floor(totalMinutes / 60);
  const newMM = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(newHH)}:${pad(newMM)}`;
}

/**
 * Combines a naive-local ISO `startTime` (YYYY-MM-DDTHH:mm:ss) with a duration in minutes to
 * produce the naive-local ISO `endTime` the backend's AppointmentDto shape expects. Used by
 * BookAppointmentModal/RescheduleModal, which collect a date + time-of-day slot + duration from
 * the user but must submit startTime/endTime to the API.
 */
export function computeEndTime(startTime: string, durationMinutes: number): string {
  const [datePart, timePart] = startTime.split('T');
  const endTimeOfDay = addMinutesToTime((timePart ?? '00:00:00').slice(0, 5), durationMinutes);
  return `${datePart}T${endTimeOfDay}:00`;
}

/** Duration in whole minutes between an appointment's startTime and endTime. */
export function getDurationMinutes(appointment: Appointment): number {
  const { start, end } = getAppointmentInterval(appointment);
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

// ─── getAppointmentInterval ───────────────────────────────────────────────────

export function getAppointmentInterval(
  appointment: Appointment
): { start: Date; end: Date } {
  return { start: new Date(appointment.startTime), end: new Date(appointment.endTime) };
}

// ─── isSlotAvailable — THE SINGLE AVAILABILITY PRIMITIVE (client-side UX pre-filter) ─────────

export function isSlotAvailable(
  date: string,           // YYYY-MM-DD
  startTime: string,      // HH:MM
  durationMinutes: number,
  userId: string,
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
    wh => wh.userId === userId && wh.weekday === weekday
  );
  if (!whRow || !whRow.startTime || !whRow.endTime) return false;

  const slotEndTime = addMinutesToTime(startTime, durationMinutes);
  if (startTime < whRow.startTime || slotEndTime > whRow.endTime) return false;

  // Step 2: Not in unavailable dates
  const isUnavailable = unavailableDates.some(
    ud => ud.userId === userId && ud.date === date
  );
  if (isUnavailable) return false;

  // Step 3: Has capability for treatment type
  const hasCapability = capabilities.some(
    cap => cap.userId === userId && cap.treatmentTypeId === treatmentTypeId
  );
  if (!hasCapability) return false;

  // Step 4: No overlap with scheduled appointments
  const slotStart = new Date(date + 'T' + startTime + ':00');
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

  for (const appt of existingAppointments) {
    if (appt.userId !== userId) continue;
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
  userId: string,
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
    wh => wh.userId === userId && wh.weekday === weekday
  );
  if (!whRow || !whRow.startTime || !whRow.endTime) return [];

  // Check unavailable dates early
  const isUnavailable = unavailableDates.some(
    ud => ud.userId === userId && ud.date === date
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
      userId,
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
      a.startTime > now
  );
  if (future.length === 0) return null;
  future.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return future[0] ?? null;
}
