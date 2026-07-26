import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RescheduleModal } from './RescheduleModal';
import { ApiRequestError } from '../../api/apiError';
import type { Appointment } from '../../types/Appointment';

const THERAPIST_ID = '11111111-1111-1111-1111-111111111111';
const mockRescheduleAppointment = vi.fn();

vi.mock('../../contexts/AppointmentsContext', () => ({
  useAppointments: () => ({
    appointments: [baseAppointment],
    rescheduleAppointment: (...args: unknown[]) => mockRescheduleAppointment(...args),
  }),
}));

vi.mock('../../contexts/TherapistDataContext', () => ({
  useTherapistData: () => ({
    // Bugfix follow-up: the reschedule picker now reads `therapists` from TherapistDataContext
    // (backed by the narrow, non-Manager-gated GET /api/v1/therapists), not TherapistsContext's
    // Manager-only GET /api/v1/users?role=Therapist.
    therapists: [
      { id: THERAPIST_ID, fullName: 'טלי כהן', email: '', role: 'Therapist' },
    ],
    isLoading: false,
    error: null,
    // 2099-01-14 is a Wednesday → weekday 3.
    workingHours: [
      { id: 'wh-1', userId: THERAPIST_ID, weekday: 3, startTime: '09:00', endTime: '18:00' },
    ],
    unavailableDates: [],
    capabilities: [{ id: 'cap-1', userId: THERAPIST_ID, treatmentTypeId: 'tt-1' }],
  }),
}));

const baseAppointment: Appointment = {
  id: 'appt-1',
  customerId: 'cust-1',
  treatmentTypeId: 'tt-1',
  treatmentTypeName: 'טיפול פנים',
  userId: THERAPIST_ID,
  userFullName: 'טלי כהן',
  startTime: '2098-05-01T10:00:00',
  endTime: '2098-05-01T11:00:00',
  status: 'Scheduled',
  createdAt: '2098-04-01T00:00:00',
};

async function advanceThroughRescheduleSteps() {
  const user = userEvent.setup();

  // Step 0: new date
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: '2099-01-14' } });
  await user.click(screen.getByText('הבא'));

  // Step 1: therapist (defaults to the appointment's current therapist, but still needs a click
  // through the wizard)
  await user.click(screen.getByText('טלי כהן'));
  await user.click(screen.getByText('הבא'));

  // Step 2: time slot — original appointment is 60 minutes, so pick 09:00
  await user.click(screen.getByText('09:00'));
}

describe('RescheduleModal', () => {
  beforeEach(() => {
    mockRescheduleAppointment.mockReset();
  });

  it('reschedules an appointment: submits the new startTime/endTime, preserving the original duration', async () => {
    mockRescheduleAppointment.mockResolvedValue({ ...baseAppointment, startTime: '2099-01-14T09:00:00', endTime: '2099-01-14T10:00:00' });
    const onClose = vi.fn();
    render(<RescheduleModal appointment={baseAppointment} onClose={onClose} />);

    await advanceThroughRescheduleSteps();
    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => expect(mockRescheduleAppointment).toHaveBeenCalledTimes(1));
    expect(mockRescheduleAppointment).toHaveBeenCalledWith(
      'appt-1',
      THERAPIST_ID,
      '2099-01-14T09:00:00',
      '2099-01-14T10:00:00'
    );
    await waitFor(() => expect(screen.getByText('התור עודכן בהצלחה')).toBeInTheDocument());
  });

  it('surfaces the backend Hebrew error message (e.g. past/non-Scheduled 409) without closing the modal', async () => {
    mockRescheduleAppointment.mockRejectedValue(
      new ApiRequestError({
        code: 'CONFLICT',
        message: 'לא ניתן לעדכן תור שאינו במצב מתוכנן',
        timestamp: new Date().toISOString(),
        traceId: 'trace-2',
        httpStatus: 409,
      })
    );
    const onClose = vi.fn();
    render(<RescheduleModal appointment={baseAppointment} onClose={onClose} />);

    await advanceThroughRescheduleSteps();
    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => expect(screen.getByText('לא ניתן לעדכן תור שאינו במצב מתוכנן')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when appointment is null', () => {
    const { container } = render(<RescheduleModal appointment={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
