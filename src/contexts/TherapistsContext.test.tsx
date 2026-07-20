import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { useTherapists } from './TherapistsContext';

// Phase 011 Q7 regression coverage: the Manager-only therapist-management screen's full-detail
// list must be sourced from real Users (GET /api/v1/users?role=Therapist) rather than the old
// data/therapists.ts mock array. This test drives the real fetch (mocking global fetch, same
// convention as authGatedFetch.test.tsx) rather than mocking TherapistsContext itself, so it
// actually exercises the wiring.
//
// Bugfix follow-up (post-Phase-011): the Appointments booking/reschedule/calendar therapist
// picker no longer sources from this context (it 403s for a Therapist-role caller, by design —
// UsersController stays Manager-only). The picker now reads from TherapistDataContext instead
// (see TherapistDataContext.test.tsx), backed by the new narrow, non-Manager-gated
// GET /api/v1/therapists. This context/test remains valid for its actual remaining consumer: the
// Manager-only /therapists management screen, which needs the full email/phone detail.

function TherapistsProbe() {
  const { therapists, isLoading, error } = useTherapists();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <ul>
        {therapists.map(t => (
          <li key={t.id}>{t.fullName}</li>
        ))}
      </ul>
    </div>
  );
}

describe('TherapistsContext — sourced from the real Users API, not the old mock list', () => {
  beforeEach(() => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it('requests GET /users?role=Therapist and renders the real API-returned therapists', async () => {
    const originalFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const impl = originalFetch.getMockImplementation();
    originalFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/users')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { id: '99999999-9999-9999-9999-999999999999', fullName: 'רונית ברק', email: 'ronit@clinic.local', role: 'Therapist', phone: '0501112222' },
          ]),
        } as unknown as Response;
      }
      return impl!(url);
    });

    renderWithProviders(<TherapistsProbe />);

    await waitFor(() => expect(screen.getByText('רונית ברק')).toBeInTheDocument());
    expect(screen.getByTestId('error')).toHaveTextContent('');

    const calledUsersEndpoint = originalFetch.mock.calls.some(call => String(call[0]).includes('/users?role=Therapist'));
    expect(calledUsersEndpoint).toBe(true);

    // Not the old mock seed data (which used fake ids like 'user-therapist-1' and different names).
    expect(screen.queryByText('לא קיים')).not.toBeInTheDocument();
  });

  it('exposes a Hebrew error and an empty list when the Users API call fails (e.g. 403 for a non-Manager)', async () => {
    const originalFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const impl = originalFetch.getMockImplementation();
    originalFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/users')) {
        return {
          ok: false,
          status: 403,
          json: () => Promise.resolve({ code: 'FORBIDDEN', message: 'אין הרשאה', timestamp: new Date().toISOString(), traceId: 't' }),
        } as unknown as Response;
      }
      return impl!(url);
    });

    renderWithProviders(<TherapistsProbe />);

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('אין הרשאה'));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  // Bugfix (post-Phase-011, code-review P3): UsersController is Manager-only at the class level,
  // so GET /api/v1/users?role=Therapist is guaranteed to 403 for a Therapist-role current user.
  // The context should skip firing that request entirely for a non-Manager caller.
  it('does not call GET /users?role=Therapist for a Therapist-role current user', async () => {
    const originalFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const impl = originalFetch.getMockImplementation();
    originalFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            id: 'user-test-1',
            fullName: 'מטפלת בדיקה',
            email: 'therapist@clinic.local',
            role: 'Therapist',
          }),
        } as unknown as Response;
      }
      return impl!(url);
    });

    renderWithProviders(<TherapistsProbe />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    const calledUsersEndpoint = originalFetch.mock.calls.some(call => String(call[0]).includes('/users?role=Therapist'));
    expect(calledUsersEndpoint).toBe(false);
  });
});
