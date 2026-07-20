import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BookAppointmentModal } from './BookAppointmentModal';
import { ApiRequestError } from '../../api/apiError';

// This suite mocks the context layer directly (same convention as TreatmentModal.test.tsx) so it
// exercises BookAppointmentModal's real rendering/step logic against realistic API-shaped data —
// real userId GUIDs, a real Appointment shape (startTime/endTime, not the old mock
// appointmentDateTime/durationMinutes/therapistId) — rather than the pre-Phase-011 mock arrays.

const mockCreateAppointment = vi.fn();

vi.mock('../../contexts/TreatmentTypesContext', () => ({
  useTreatmentTypes: () => ({
    treatmentTypes: [{ id: 'tt-1', name: 'טיפול פנים', defaultDurationMinutes: 60 }],
  }),
}));

vi.mock('../../contexts/TherapistDataContext', () => ({
  useTherapistData: () => ({
    // Real User.Id-shaped GUID and name-only, sourced (per the component under test) from
    // TherapistDataContext — bugfix follow-up: the booking picker now reads `therapists` from
    // here (backed by the narrow, non-Manager-gated GET /api/v1/therapists), not
    // TherapistsContext's Manager-only GET /api/v1/users?role=Therapist.
    therapists: [
      { id: '11111111-1111-1111-1111-111111111111', fullName: 'טלי כהן', email: '', role: 'Therapist' },
    ],
    isLoading: false,
    error: null,
    // 2099-01-14 is a Wednesday → weekday 3.
    workingHours: [
      { id: 'wh-1', userId: '11111111-1111-1111-1111-111111111111', weekday: 3, startTime: '09:00', endTime: '18:00' },
    ],
    unavailableDates: [],
    capabilities: [
      { id: 'cap-1', userId: '11111111-1111-1111-1111-111111111111', treatmentTypeId: 'tt-1' },
    ],
  }),
}));

vi.mock('../../contexts/AppointmentsContext', () => ({
  useAppointments: () => ({
    appointments: [],
    createAppointment: (...args: unknown[]) => mockCreateAppointment(...args),
  }),
}));

vi.mock('../../contexts/CustomersContext', () => ({
  useCustomers: () => ({ customers: [{ id: 'cust-1', fullName: 'לקוחה בדיקה', phone: '0500000000', email: '' }] }),
}));

// Bugfix regression: BookAppointmentModal is only ever reached (in production) from
// AppointmentCalendarScreen with NO pre-filled customerId — the customer is picked from the
// step-0 dropdown, and CustomerContext's `allSeries` cache is never populated for that customer
// (it's only filled when that customer's Customer Card has been visited). The component must
// fetch the customer's active series directly via treatmentSeriesApi, NOT via CustomerContext.

const mockListActiveByCustomer = vi.fn();
vi.mock('../../api/treatmentSeriesApi', () => ({
  treatmentSeriesApi: {
    listActiveByCustomer: (...args: unknown[]) => mockListActiveByCustomer(...args),
  },
}));

vi.mock('../../contexts/PackageTypesContext', () => ({
  usePackageTypes: () => ({
    packageTypes: [{ id: 'pt-1', treatmentTypeId: 'tt-1', name: 'חבילת פנים', defaultPrice: 100 }],
  }),
}));

async function advanceThroughBookingSteps() {
  const user = userEvent.setup();

  // Step 0: treatment type — wait for the async active-series fetch to resolve first (the
  // dropdown is only rendered once seriesLoading flips to false).
  await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
  await user.selectOptions(screen.getByRole('combobox'), 'tt-1');
  await user.click(screen.getByText('הבא'));

  // Step 1: date (a real future Wednesday matching the mocked working-hours weekday)
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  fireEvent.change(dateInput, { target: { value: '2099-01-14' } });
  await user.click(screen.getByText('הבא'));

  // Step 2: therapist
  await user.click(screen.getByText('טלי כהן'));
  await user.click(screen.getByText('הבא'));

  // Step 3: duration (defaults to the treatment type's default — 60 — already valid)
  await user.click(screen.getByText('הבא'));

  // Step 4: time slot — pick the first available slot (09:00, start of working hours)
  await user.click(screen.getByText('09:00'));
}

describe('BookAppointmentModal', () => {
  beforeEach(() => {
    mockCreateAppointment.mockReset();
    mockListActiveByCustomer.mockReset();
    mockListActiveByCustomer.mockResolvedValue([
      { id: 'series-1', packageTypeId: 'pt-1', isTimerBased: false, totalTreatments: 5, completedTreatments: 0 },
    ]);
  });

  it('books an appointment: submits startTime/endTime (not the old appointmentDateTime/duration shape) and real therapist userId', async () => {
    mockCreateAppointment.mockResolvedValue({ id: 'new-appt-1' });
    const onClose = vi.fn();
    render(<BookAppointmentModal open={true} onClose={onClose} customerId="cust-1" />);

    await advanceThroughBookingSteps();
    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => expect(mockCreateAppointment).toHaveBeenCalledTimes(1));
    expect(mockCreateAppointment).toHaveBeenCalledWith(
      'cust-1',
      'tt-1',
      '11111111-1111-1111-1111-111111111111',
      '2099-01-14T09:00:00',
      '2099-01-14T10:00:00'
    );

    await waitFor(() => expect(screen.getByText('התור נקבע בהצלחה')).toBeInTheDocument());
  });

  it('surfaces the backend Hebrew conflict message on a 409 without closing the modal', async () => {
    mockCreateAppointment.mockRejectedValue(
      new ApiRequestError({
        code: 'CONFLICT',
        message: 'התור חופף לתור קיים של המטפלת',
        timestamp: new Date().toISOString(),
        traceId: 'trace-1',
        httpStatus: 409,
      })
    );
    const onClose = vi.fn();
    render(<BookAppointmentModal open={true} onClose={onClose} customerId="cust-1" />);

    await advanceThroughBookingSteps();
    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => expect(screen.getByText('התור חופף לתור קיים של המטפלת')).toBeInTheDocument());
    expect(screen.queryByText('התור נקבע בהצלחה')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables the Save button while the create request is in flight', async () => {
    let resolveCreate: (value: unknown) => void = () => {};
    mockCreateAppointment.mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }));
    render(<BookAppointmentModal open={true} onClose={vi.fn()} customerId="cust-1" />);

    await advanceThroughBookingSteps();
    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => expect(screen.getByText('שומר...')).toBeInTheDocument());
    expect(screen.getByText('שומר...').closest('button')).toBeDisabled();

    resolveCreate({ id: 'new-appt-1' });
    await waitFor(() => expect(screen.getByText('התור נקבע בהצלחה')).toBeInTheDocument());
  });

  it('populates the treatment-type dropdown from a directly-fetched customer selected in step 0 (no customerId pre-fill, no CustomerContext priming)', async () => {
    // This is the real-world path: BookAppointmentModal is only ever opened from
    // AppointmentCalendarScreen, which never passes a customerId — the customer is picked from
    // the step-0 dropdown. CustomerContext is not mocked/primed with any series data anywhere in
    // this file; if the component still depended on it, this dropdown would stay empty and this
    // test would fail (confirmed against the pre-fix code).
    render(<BookAppointmentModal open={true} onClose={vi.fn()} />);
    const user = userEvent.setup();

    // Step 0: pick the customer from the dropdown (unprefilled flow)
    await user.selectOptions(screen.getByRole('combobox'), 'cust-1');
    await user.click(screen.getByText('הבא'));

    expect(mockListActiveByCustomer).toHaveBeenCalledWith('cust-1');

    // Inner step 0: treatment type — should be populated from the direct API fetch
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument());
    expect(screen.queryByText('אין חבילות פעילות ללקוחה זו')).not.toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.some(o => o.textContent === 'טיפול פנים')).toBe(true);
  });

  it('shows "no active packages" when the fetched series list is empty for the selected customer', async () => {
    mockListActiveByCustomer.mockResolvedValue([]);
    render(<BookAppointmentModal open={true} onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole('combobox'), 'cust-1');
    await user.click(screen.getByText('הבא'));

    await waitFor(() =>
      expect(screen.getByText('אין חבילות פעילות ללקוחה זו')).toBeInTheDocument()
    );
  });

  it('re-fetches active series on reopen instead of showing stale empty state (modal is never unmounted between opens)', async () => {
    // Reproduces the real bug: BookAppointmentModal is rendered permanently by its parent and
    // only toggles via the `open` prop — it is never unmounted/remounted. Open it for a customer
    // with no active series (empty fetch), close it, then have the customer buy a package
    // (mocked fetch now resolves with an active series for the same customer) and reopen with the
    // SAME customerId. If the fetch effect only depends on `effectiveCustomerId`, it will not
    // re-run on reopen and the modal will keep showing the stale "no active packages" state.
    mockListActiveByCustomer.mockResolvedValueOnce([]);
    const { rerender } = render(
      <BookAppointmentModal open={true} onClose={vi.fn()} customerId="cust-1" />
    );

    await waitFor(() =>
      expect(screen.getByText('אין חבילות פעילות ללקוחה זו')).toBeInTheDocument()
    );

    // Close the modal (parent flips `open` to false, component stays mounted).
    rerender(<BookAppointmentModal open={false} onClose={vi.fn()} customerId="cust-1" />);

    // Customer buys a package for the same customer — the next fetch now returns an active series.
    mockListActiveByCustomer.mockResolvedValueOnce([
      { id: 'series-1', packageTypeId: 'pt-1', isTimerBased: false, totalTreatments: 5, completedTreatments: 0 },
    ]);

    // Reopen for the same customer.
    rerender(<BookAppointmentModal open={true} onClose={vi.fn()} customerId="cust-1" />);

    await waitFor(() =>
      expect(screen.queryByText('אין חבילות פעילות ללקוחה זו')).not.toBeInTheDocument()
    );
    const options = await screen.findAllByRole('option');
    expect(options.some(o => o.textContent === 'טיפול פנים')).toBe(true);

    // Proof it actually re-fetched on reopen rather than reusing a cached/stale result: exactly
    // one call for the initial open, one call for the reopen.
    expect(mockListActiveByCustomer).toHaveBeenCalledTimes(2);
  });
});
