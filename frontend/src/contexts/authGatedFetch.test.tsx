import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/renderWithProviders';
import { useAuth } from './AuthContext';
import { useCustomers } from './CustomersContext';
import { useTreatmentTypes } from './TreatmentTypesContext';

// ─── Regression coverage for the "search screen shows error on first login" bug ──────────
//
// The bug: CustomersProvider (and siblings) fired their fetch unconditionally on mount,
// before AuthProvider had a token / before login completed. The 401 became a permanent
// error state that never cleared after a successful login. These tests render the provider
// tree in the *unauthenticated* state (renderWithProviders(..., { authenticated: false })),
// assert no request fires and no error appears, then drive a real login() transition through
// AuthContext and assert the fetch now fires and data loads with no error — i.e. they exercise
// the exact race that was broken, rather than routing around it.

function fetchCallCountFor(pathFragment: string): number {
  const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
  return mockFetch.mock.calls.filter(call => String(call[0]).includes(pathFragment)).length;
}

beforeEach(() => {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockClear();
});

function CustomersProbe() {
  const { currentUser, login } = useAuth();
  const { customers, isLoading, error } = useCustomers();
  return (
    <div>
      <span data-testid="auth-state">{currentUser ? 'authed' : 'anon'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="count">{customers.length}</span>
      <button onClick={() => { login('test@clinic.local', 'pw'); }}>login</button>
    </div>
  );
}

function TreatmentTypesProbe() {
  const { currentUser, login } = useAuth();
  const { treatmentTypes, isLoading, error } = useTreatmentTypes();
  return (
    <div>
      <span data-testid="auth-state">{currentUser ? 'authed' : 'anon'}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? ''}</span>
      <span data-testid="count">{treatmentTypes.length}</span>
      <button onClick={() => { login('test@clinic.local', 'pw'); }}>login</button>
    </div>
  );
}

describe('CustomersContext — does not fetch before login, fetches after login', () => {
  it('skips the customers fetch while unauthenticated and fetches once login completes', async () => {
    renderWithProviders(<CustomersProbe />, { authenticated: false });

    // AuthProvider finishes initializing quickly (no token to restore) — stays anonymous.
    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anon'));
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    // The pre-login race: no request should have been fired, and no stuck error banner.
    expect(fetchCallCountFor('/customers')).toBe(0);
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    const user = userEvent.setup();
    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authed'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(fetchCallCountFor('/customers')).toBeGreaterThan(0);
  });
});

describe('TreatmentTypesContext — does not fetch before login, fetches after login', () => {
  it('skips the treatment-types fetch while unauthenticated and fetches once login completes', async () => {
    renderWithProviders(<TreatmentTypesProbe />, { authenticated: false });

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('anon'));
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    expect(fetchCallCountFor('/treatment-types')).toBe(0);
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(screen.getByTestId('count')).toHaveTextContent('0');

    const user = userEvent.setup();
    await user.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('auth-state')).toHaveTextContent('authed'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(fetchCallCountFor('/treatment-types')).toBeGreaterThan(0);
  });
});
