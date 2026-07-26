import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TreatmentModal } from './TreatmentModal';
import type { Treatment } from '../../../types/Treatment';
import type { User } from '../../../types/User';

const mockUseCustomer = vi.fn();
const mockUseAuth = vi.fn();
const mockUpdate = vi.fn();

vi.mock('../../../contexts/CustomerContext', () => ({
  useCustomer: () => mockUseCustomer(),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../api/treatmentsApi', () => ({
  treatmentsApi: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

const author: User = {
  id: 'user-1',
  fullName: 'מטפלת ראשית',
  email: 'therapist@clinic.local',
  role: 'Therapist',
};

const otherTherapist: User = {
  id: 'user-2',
  fullName: 'מטפלת אחרת',
  email: 'other@clinic.local',
  role: 'Therapist',
};

const manager: User = {
  id: 'user-3',
  fullName: 'מנהלת',
  email: 'manager@clinic.local',
  role: 'Manager',
};

const baseTreatment: Treatment = {
  id: 'treatment-1',
  customerId: 'cust-1',
  treatmentTypeId: 'tt-1',
  treatmentTypeName: 'עיסוי שוודי',
  treatmentDate: '2026-07-10T10:00:00Z',
  durationMinutes: 60,
  notes: 'הערה קיימת',
  userId: 'user-1',
  performedByFullName: 'מטפלת ראשית',
  treatmentPhotos: [],
};

function renderModal(treatment: Treatment = baseTreatment) {
  return render(<TreatmentModal treatment={treatment} onClose={vi.fn()} />);
}

describe('TreatmentModal — note editing', () => {
  beforeEach(() => {
    mockUseCustomer.mockReset();
    mockUseAuth.mockReset();
    mockUpdate.mockReset();
    mockUseCustomer.mockReturnValue({
      addTreatmentPhoto: vi.fn(),
      removeTreatmentPhoto: vi.fn(),
      refreshTreatments: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('shows the edit affordance for the treatment author', () => {
    mockUseAuth.mockReturnValue({ currentUser: author });
    renderModal();

    expect(screen.getByText('הערה קיימת')).toBeInTheDocument();
    expect(screen.getByText('ערוך הערה')).toBeInTheDocument();
  });

  it('shows the edit affordance for a Manager, even for another therapist\'s treatment', () => {
    mockUseAuth.mockReturnValue({ currentUser: manager });
    renderModal();

    expect(screen.getByText('ערוך הערה')).toBeInTheDocument();
  });

  it('hides the edit affordance for a different, non-manager therapist', () => {
    mockUseAuth.mockReturnValue({ currentUser: otherTherapist });
    renderModal();

    expect(screen.getByText('הערה קיימת')).toBeInTheDocument();
    expect(screen.queryByText('ערוך הערה')).not.toBeInTheDocument();
    expect(screen.queryByText('הוסף הערה')).not.toBeInTheDocument();
  });

  it('shows "הוסף הערה" for the author when there is no existing note, and no note text for others', () => {
    const noNoteTreatment = { ...baseTreatment, notes: undefined };

    mockUseAuth.mockReturnValue({ currentUser: author });
    const { unmount } = renderModal(noNoteTreatment);
    expect(screen.getByText('הוסף הערה')).toBeInTheDocument();
    unmount();

    mockUseAuth.mockReturnValue({ currentUser: otherTherapist });
    renderModal(noNoteTreatment);
    expect(screen.queryByText('הוסף הערה')).not.toBeInTheDocument();
    expect(screen.queryByText('ערוך הערה')).not.toBeInTheDocument();
  });

  it('saves the edited note via the API and refreshes the displayed note', async () => {
    const refreshTreatments = vi.fn().mockResolvedValue(undefined);
    mockUseCustomer.mockReturnValue({
      addTreatmentPhoto: vi.fn(),
      removeTreatmentPhoto: vi.fn(),
      refreshTreatments,
    });
    mockUseAuth.mockReturnValue({ currentUser: author });
    mockUpdate.mockResolvedValue({ ...baseTreatment, notes: 'הערה חדשה' });

    renderModal();

    fireEvent.click(screen.getByText('ערוך הערה'));

    const textarea = screen.getByPlaceholderText('הוסיפי הערה לטיפול...');
    fireEvent.change(textarea, { target: { value: 'הערה חדשה' } });

    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('treatment-1', { notes: 'הערה חדשה' });
    });
    expect(refreshTreatments).toHaveBeenCalled();
  });

  it('rejects notes over 5000 characters client-side without calling the API', async () => {
    mockUseAuth.mockReturnValue({ currentUser: author });
    renderModal();

    fireEvent.click(screen.getByText('ערוך הערה'));

    const textarea = screen.getByPlaceholderText('הוסיפי הערה לטיפול...') as HTMLTextAreaElement;
    // maxLength on the textarea doesn't stop fireEvent.change from programmatically setting a
    // longer value (JSDOM doesn't enforce it), so this actually drives noteDraft past the limit
    // to exercise handleSaveNote's length guard, rather than only asserting the attribute exists.
    fireEvent.change(textarea, { target: { value: 'x'.repeat(5001) } });

    fireEvent.click(screen.getByText('שמור'));

    await waitFor(() => {
      expect(screen.getByText('ההערה חורגת מ-5000 תווים')).toBeInTheDocument();
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
