import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TherapistDetail } from './TherapistDetail';
import type { User } from '../../types/User';

const mockUpdateTherapist = vi.fn();
const mockDeactivateTherapist = vi.fn();
const mockSaveTherapistWorkingHours = vi.fn();
const mockAddTherapistUnavailableDate = vi.fn();
const mockRemoveTherapistUnavailableDate = vi.fn();
const mockAddTherapistCapability = vi.fn();
const mockRemoveTherapistCapability = vi.fn();

let therapistsFixture: User[] = [];
let workingHoursFixture: import('../../types/Therapist').TherapistWorkingHours[] = [];
let therapistDataLoadingFixture = false;

vi.mock('react-router-dom', () => ({
  useParams: () => ({ userId: 'user-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../contexts/TherapistsContext', () => ({
  useTherapists: () => ({
    therapists: therapistsFixture,
    updateTherapist: mockUpdateTherapist,
    deactivateTherapist: mockDeactivateTherapist,
  }),
}));

vi.mock('../../contexts/TherapistDataContext', () => ({
  useTherapistData: () => ({
    workingHours: workingHoursFixture,
    unavailableDates: [],
    capabilities: [],
    isLoading: therapistDataLoadingFixture,
    saveTherapistWorkingHours: mockSaveTherapistWorkingHours,
    addTherapistUnavailableDate: mockAddTherapistUnavailableDate,
    removeTherapistUnavailableDate: mockRemoveTherapistUnavailableDate,
    addTherapistCapability: mockAddTherapistCapability,
    removeTherapistCapability: mockRemoveTherapistCapability,
  }),
}));

vi.mock('../../contexts/TreatmentTypesContext', () => ({
  useTreatmentTypes: () => ({
    treatmentTypes: [{ id: 'tt-1', name: 'פנים', defaultDurationMinutes: 60 }],
  }),
}));

const activeTherapist: User = {
  id: 'user-1', fullName: 'מטפלת בדיקה', email: 'test@clinic.local', phone: '0501234567',
  role: 'Therapist', isActive: true,
};

const inactiveTherapist: User = { ...activeTherapist, isActive: false };

describe('TherapistDetail (Phase 012 — deactivate action, read-only mode, async wiring)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    therapistsFixture = [activeTherapist];
    workingHoursFixture = [];
    therapistDataLoadingFixture = false;
  });

  it('shows the "בטל פעילות" action for an active therapist', () => {
    render(<TherapistDetail />);
    expect(screen.getByRole('button', { name: /בטל פעילות/ })).toBeInTheDocument();
  });

  it('hides the deactivate action and shows a "לא פעילה" badge for an inactive therapist', () => {
    therapistsFixture = [inactiveTherapist];
    render(<TherapistDetail />);
    expect(screen.queryByRole('button', { name: /בטל פעילות/ })).not.toBeInTheDocument();
    expect(screen.getByText('לא פעילה')).toBeInTheDocument();
  });

  it('disables edit controls (contact/hours/dates/capabilities) when the therapist is inactive', () => {
    therapistsFixture = [inactiveTherapist];
    render(<TherapistDetail />);

    expect(screen.getByRole('button', { name: 'שמור פרטי קשר' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'שמור שעות עבודה' })).toBeDisabled();
    // Treatment type capability checkbox
    expect(screen.getByRole('checkbox', { name: 'פנים' })).toBeDisabled();
  });

  it('confirms and calls deactivateTherapist when "בטל פעילות" is clicked and confirmed', async () => {
    mockDeactivateTherapist.mockResolvedValueOnce(undefined);
    render(<TherapistDetail />);

    fireEvent.click(screen.getByRole('button', { name: /בטל פעילות/ }));
    // Confirmation panel appears with a second, explicit "בטל פעילות" confirm button.
    const confirmButtons = screen.getAllByRole('button', { name: /בטל פעילות/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(mockDeactivateTherapist).toHaveBeenCalledWith('user-1'));
  });

  it('shows a Hebrew error and keeps the confirmation open when deactivation fails', async () => {
    mockDeactivateTherapist.mockRejectedValueOnce(new Error('שגיאת שרת'));
    render(<TherapistDetail />);

    fireEvent.click(screen.getByRole('button', { name: /בטל פעילות/ }));
    const confirmButtons = screen.getAllByRole('button', { name: /בטל פעילות/ });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(screen.getByText('שגיאת שרת')).toBeInTheDocument());
  });

  it('saves contact info via updateTherapist and shows a success message', async () => {
    mockUpdateTherapist.mockResolvedValueOnce(undefined);
    render(<TherapistDetail />);

    fireEvent.click(screen.getByRole('button', { name: 'שמור פרטי קשר' }));

    await waitFor(() => expect(mockUpdateTherapist).toHaveBeenCalledWith('user-1', '0501234567', 'test@clinic.local'));
    await waitFor(() => expect(screen.getByText('נשמר בהצלחה')).toBeInTheDocument());
  });

  it('toggles a capability via addTherapistCapability when unchecked', async () => {
    mockAddTherapistCapability.mockResolvedValueOnce(undefined);
    render(<TherapistDetail />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'פנים' }));

    await waitFor(() => expect(mockAddTherapistCapability).toHaveBeenCalledWith('user-1', 'tt-1'));
  });

  it('adds an unavailable date via addTherapistUnavailableDate', async () => {
    mockAddTherapistUnavailableDate.mockResolvedValueOnce(undefined);
    render(<TherapistDetail />);

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: /הוסף/ }));

    await waitFor(() => expect(mockAddTherapistUnavailableDate).toHaveBeenCalledWith({ id: '', userId: 'user-1', date: '2026-09-01' }));
  });

  it('seeds Contact Info and Working Hours once therapist data arrives late (fresh page load / direct URL race)', async () => {
    // Simulate a fresh page load: TherapistsContext hasn't resolved its fetch yet, so
    // `therapist` is undefined on first render.
    therapistsFixture = [];
    const { rerender } = render(<TherapistDetail />);

    // Guard renders "מטפלת לא נמצאה" while therapist is still loading.
    expect(screen.getByText('מטפלת לא נמצאה')).toBeInTheDocument();

    // The async fetch resolves moments later and TherapistsContext re-renders with real data.
    therapistsFixture = [activeTherapist];
    rerender(<TherapistDetail />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('0501234567')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('test@clinic.local')).toBeInTheDocument();
    // Working Hours table rendered a row per weekday (7 "isDayOff" checkboxes) plus the
    // one treatment-capability checkbox — proving dayRows was seeded, not left empty.
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByText('ראשון')).toBeInTheDocument();
  });

  it('re-seeds Working Hours once TherapistDataContext settles, even when TherapistsContext resolved first (two-independent-contexts race)', async () => {
    // Simulate TherapistsContext resolving first: `therapist` is already available...
    therapistsFixture = [activeTherapist];
    // ...while TherapistDataContext's own fetch is still in flight: `workingHours` is still its
    // initial `[]` and `isLoading` is still `true`.
    workingHoursFixture = [];
    therapistDataLoadingFixture = true;
    const { rerender } = render(<TherapistDetail />);

    // While TherapistDataContext is still loading, Sunday's start-time input must not yet show
    // real data (the seed effect must not have fired and locked in an all-day-off snapshot).
    expect(screen.queryByDisplayValue('10:00')).not.toBeInTheDocument();

    // TherapistDataContext's fetch resolves moments later with the real, previously-saved data.
    workingHoursFixture = [
      { id: 'wh-1', userId: 'user-1', weekday: 0, startTime: '10:00', endTime: '18:00' },
    ];
    therapistDataLoadingFixture = false;
    rerender(<TherapistDetail />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('10:00')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('18:00')).toBeInTheDocument();
  });
});
