import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TherapistModal } from './TherapistModal';

const mockCreateTherapist = vi.fn();

vi.mock('../../contexts/TherapistsContext', () => ({
  useTherapists: () => ({ createTherapist: mockCreateTherapist }),
}));

describe('TherapistModal (Phase 012 — password field, async createTherapist)', () => {
  beforeEach(() => {
    mockCreateTherapist.mockReset();
  });

  it('renders a password field alongside name/email/phone', () => {
    render(<TherapistModal open onClose={vi.fn()} />);
    expect(screen.getByText('סיסמה', { exact: false })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/אות גדולה/)).toBeInTheDocument();
  });

  it('disables the save button until name/email/phone/password are all filled', () => {
    render(<TherapistModal open onClose={vi.fn()} />);
    const saveButton = screen.getByRole('button', { name: 'הוסף מטפלת' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('שם פרטי ושם משפחה'), { target: { value: 'מטפלת חדשה' } });
    expect(saveButton).toBeDisabled();
  });

  it('calls createTherapist with fullName/email/phone/password and closes on success', async () => {
    mockCreateTherapist.mockResolvedValueOnce({ id: 'user-9', fullName: 'מטפלת חדשה', email: 'new@clinic.local', phone: '0501234567', role: 'Therapist', isActive: true });
    const onClose = vi.fn();
    render(<TherapistModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('שם פרטי ושם משפחה'), { target: { value: 'מטפלת חדשה' } });
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'new@clinic.local' } });
    fireEvent.change(screen.getByPlaceholderText('0500000000'), { target: { value: '0501234567' } });
    fireEvent.change(screen.getByPlaceholderText(/אות גדולה/), { target: { value: 'Password@1' } });

    const saveButton = screen.getByRole('button', { name: 'הוסף מטפלת' });
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(mockCreateTherapist).toHaveBeenCalledWith('מטפלת חדשה', 'new@clinic.local', '0501234567', 'Password@1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows a Hebrew error and does not close when createTherapist rejects', async () => {
    mockCreateTherapist.mockRejectedValueOnce(new Error('אימייל כבר קיים במערכת'));
    const onClose = vi.fn();
    render(<TherapistModal open onClose={onClose} />);

    fireEvent.change(screen.getByPlaceholderText('שם פרטי ושם משפחה'), { target: { value: 'מטפלת חדשה' } });
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'dup@clinic.local' } });
    fireEvent.change(screen.getByPlaceholderText('0500000000'), { target: { value: '0501234567' } });
    fireEvent.change(screen.getByPlaceholderText(/אות גדולה/), { target: { value: 'Password@1' } });

    fireEvent.click(screen.getByRole('button', { name: 'הוסף מטפלת' }));

    await waitFor(() => expect(screen.getByText('אימייל כבר קיים במערכת')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });
});
