import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/renderWithProviders';
import { useTherapistData } from './TherapistDataContext';

// Bugfix regression coverage: the appointment-booking/reschedule/calendar therapist picker used
// to source its therapist list from TherapistsContext (GET /api/v1/users?role=Therapist), which
// is Manager-only end-to-end — a Therapist-role caller got a 403 and the picker degraded to
// empty. The fix adds a narrow, non-Manager-gated GET /api/v1/therapists (name+id only) and wires
// TherapistDataContext (already non-Manager-gated for working hours/unavailable dates/
// capabilities) to source `therapists` from it instead. This test drives the real fetch (mocking
// global fetch, same convention as TherapistsContext.test.tsx) to actually exercise the wiring,
// not a mock of the context itself.

function TherapistPickerProbe() {
  const { therapists, isLoading, error } = useTherapistData();
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

describe('TherapistDataContext — therapist picker sourced from the narrow /therapists endpoint', () => {
  beforeEach(() => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it('requests GET /therapists and renders the real API-returned therapists', async () => {
    const originalFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const impl = originalFetch.getMockImplementation();
    originalFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/therapists/availability')) {
        return { ok: true, status: 200, json: () => Promise.resolve({ workingHours: [], unavailableDates: [], capabilities: [] }) } as unknown as Response;
      }
      if (u.includes('/therapists')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { id: '99999999-9999-9999-9999-999999999999', fullName: 'רונית ברק' },
          ]),
        } as unknown as Response;
      }
      return impl!(url);
    });

    renderWithProviders(<TherapistPickerProbe />);

    await waitFor(() => expect(screen.getByText('רונית ברק')).toBeInTheDocument());
    expect(screen.getByTestId('error')).toHaveTextContent('');

    const calledTherapistsEndpoint = originalFetch.mock.calls.some(
      call => String(call[0]).endsWith('/therapists')
    );
    expect(calledTherapistsEndpoint).toBe(true);
  });

  it('still returns 200/populated data even when GET /users would 403 for a non-Manager (the actual bug being fixed)', async () => {
    const originalFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    const impl = originalFetch.getMockImplementation();
    originalFetch.mockImplementation(async (url: string) => {
      const u = String(url);
      // The old picker source (GET /api/v1/users?role=Therapist) 403s for a Therapist caller —
      // proving TherapistDataContext's fetch of the picker data never touches this endpoint.
      if (u.includes('/users')) {
        return {
          ok: false,
          status: 403,
          json: () => Promise.resolve({ code: 'FORBIDDEN', message: 'אין הרשאה', timestamp: new Date().toISOString(), traceId: 't' }),
        } as unknown as Response;
      }
      if (u.includes('/therapists/availability')) {
        return { ok: true, status: 200, json: () => Promise.resolve({ workingHours: [], unavailableDates: [], capabilities: [] }) } as unknown as Response;
      }
      if (u.includes('/therapists')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve([
            { id: '88888888-8888-8888-8888-888888888888', fullName: 'מטפלת בדיקה' },
          ]),
        } as unknown as Response;
      }
      return impl!(url);
    });

    renderWithProviders(<TherapistPickerProbe />);

    await waitFor(() => expect(screen.getByText('מטפלת בדיקה')).toBeInTheDocument());
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });
});
