import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarGrid } from './CalendarGrid';
import { ApiRequestError } from '../../../api/apiError';
import type { Appointment } from '../../../types/Appointment';
import type { User } from '../../../types/User';

const AUTHOR_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_THERAPIST_ID = '22222222-2222-2222-2222-222222222222';

const mockCancelAppointment = vi.fn();
const mockUseAuth = vi.fn();

vi.mock('../../../contexts/CustomersContext', () => ({
  useCustomers: () => ({ customers: [{ id: 'cust-1', fullName: 'לקוחה בדיקה', phone: '', email: '' }] }),
}));

vi.mock('../../../contexts/TreatmentTypesContext', () => ({
  useTreatmentTypes: () => ({ treatmentTypes: [{ id: 'tt-1', name: 'טיפול פנים', defaultDurationMinutes: 60 }] }),
}));

vi.mock('../../../contexts/GlobalSettingsContext', () => ({
  useGlobalSettings: () => ({ calendarStartHour: 8, calendarEndHour: 20 }),
}));

// Bugfix follow-up: CalendarGrid now reads `therapists` from TherapistDataContext (backed by the
// narrow, non-Manager-gated GET /api/v1/therapists), not TherapistsContext's Manager-only
// GET /api/v1/users?role=Therapist. CalendarGrid also always mounts <RescheduleModal> (it renders
// null internally while no appointment is being rescheduled), which itself calls
// useTherapistData — this single mock covers both call sites.
vi.mock('../../../contexts/TherapistDataContext', () => ({
  useTherapistData: () => ({
    therapists: [
      { id: AUTHOR_ID, fullName: 'טלי כהן', email: '', role: 'Therapist' },
    ],
    isLoading: false,
    error: null,
    workingHours: [],
    unavailableDates: [],
    capabilities: [],
  }),
}));

vi.mock('../../../contexts/AppointmentsContext', () => ({
  useAppointments: () => ({
    cancelAppointment: (...args: unknown[]) => mockCancelAppointment(...args),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const author: User = { id: AUTHOR_ID, fullName: 'טלי כהן', email: 't1@clinic.local', role: 'Therapist' };
const otherTherapist: User = { id: OTHER_THERAPIST_ID, fullName: 'שרה לוי', email: 't2@clinic.local', role: 'Therapist' };
const manager: User = { id: 'manager-1', fullName: 'מנהלת', email: 'm@clinic.local', role: 'Manager' };

const SELECTED_DATE = new Date('2099-01-14T00:00:00');

function makeAppointment(): Appointment {
  return {
    id: 'appt-1',
    customerId: 'cust-1',
    treatmentTypeId: 'tt-1',
    treatmentTypeName: 'טיפול פנים',
    userId: AUTHOR_ID,
    userFullName: 'טלי כהן',
    startTime: '2099-01-14T10:00:00',
    endTime: '2099-01-14T11:00:00',
    status: 'Scheduled',
    createdAt: '2099-01-01T00:00:00',
  };
}

describe('CalendarGrid — permission-gated reschedule/cancel controls', () => {
  beforeEach(() => {
    mockCancelAppointment.mockReset();
  });

  it('shows reschedule/cancel controls for the appointment author', () => {
    mockUseAuth.mockReturnValue({ currentUser: author });
    render(<CalendarGrid selectedDate={SELECTED_DATE} appointments={[makeAppointment()]} />);

    expect(screen.getByText('עדכן')).toBeInTheDocument();
    expect(screen.getByText('בטל')).toBeInTheDocument();
  });

  it('shows reschedule/cancel controls for a Manager, even for another therapist\'s appointment', () => {
    mockUseAuth.mockReturnValue({ currentUser: manager });
    render(<CalendarGrid selectedDate={SELECTED_DATE} appointments={[makeAppointment()]} />);

    expect(screen.getByText('עדכן')).toBeInTheDocument();
    expect(screen.getByText('בטל')).toBeInTheDocument();
  });

  it('hides reschedule/cancel controls for a different, non-manager therapist (backend 403 rule)', () => {
    mockUseAuth.mockReturnValue({ currentUser: otherTherapist });
    render(<CalendarGrid selectedDate={SELECTED_DATE} appointments={[makeAppointment()]} />);

    expect(screen.queryByText('עדכן')).not.toBeInTheDocument();
    expect(screen.queryByText('בטל')).not.toBeInTheDocument();
    // The appointment itself should still be visible (read-only) to the non-author therapist.
    expect(screen.getByText('לקוחה בדיקה')).toBeInTheDocument();
  });

  it('cancels an appointment via the confirm flow and shows a success toast', async () => {
    mockUseAuth.mockReturnValue({ currentUser: author });
    mockCancelAppointment.mockResolvedValue(undefined);
    render(<CalendarGrid selectedDate={SELECTED_DATE} appointments={[makeAppointment()]} />);

    fireEvent.click(screen.getByText('בטל'));
    expect(screen.getByText('לבטל את התור?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('כן, בטל'));

    await waitFor(() => expect(mockCancelAppointment).toHaveBeenCalledWith('appt-1'));
    await waitFor(() => expect(screen.getByText('התור בוטל')).toBeInTheDocument());
  });

  it('surfaces the backend Hebrew error message when cancel fails, without dismissing the confirm dialog', async () => {
    mockUseAuth.mockReturnValue({ currentUser: author });
    mockCancelAppointment.mockRejectedValue(
      new ApiRequestError({
        code: 'FORBIDDEN',
        message: 'אין הרשאה לבטל תור זה',
        timestamp: new Date().toISOString(),
        traceId: 'trace-3',
        httpStatus: 403,
      })
    );
    render(<CalendarGrid selectedDate={SELECTED_DATE} appointments={[makeAppointment()]} />);

    fireEvent.click(screen.getByText('בטל'));
    fireEvent.click(screen.getByText('כן, בטל'));

    await waitFor(() => expect(screen.getByText('אין הרשאה לבטל תור זה')).toBeInTheDocument());
    expect(screen.queryByText('התור בוטל')).not.toBeInTheDocument();
  });
});
