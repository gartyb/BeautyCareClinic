import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { setToken } from '../api/tokenManager';
import { GlobalSettingsProvider } from '../contexts/GlobalSettingsContext';
import { CustomersProvider } from '../contexts/CustomersContext';
import { TherapistDataProvider } from '../contexts/TherapistDataContext';
import { TherapistsProvider } from '../contexts/TherapistsContext';
import { TreatmentTypesProvider } from '../contexts/TreatmentTypesContext';
import { PackageTypesProvider } from '../contexts/PackageTypesContext';
import { AppointmentsProvider } from '../contexts/AppointmentsContext';
import { CustomerProvider } from '../contexts/CustomerContext';
import { ActiveTimerProvider } from '../contexts/ActiveTimerContext';

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <GlobalSettingsProvider>
          <CustomersProvider>
            <TherapistDataProvider>
              <TherapistsProvider>
              <TreatmentTypesProvider>
              <PackageTypesProvider>
              <AppointmentsProvider>
                <CustomerProvider>
                  <ActiveTimerProvider>
                    {children}
                  </ActiveTimerProvider>
                </CustomerProvider>
              </AppointmentsProvider>
              </PackageTypesProvider>
              </TreatmentTypesProvider>
              </TherapistsProvider>
            </TherapistDataProvider>
          </CustomersProvider>
        </GlobalSettingsProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * When true (default), seeds a valid auth token before render so AuthProvider restores an
   * authenticated session on mount (mirrors "already logged in" — the data-fetching providers
   * only fetch once authenticated). Set to false to render in the unauthenticated state, e.g.
   * to test the pre-login race condition and the subsequent login transition.
   */
  authenticated?: boolean;
}

export function renderWithProviders(ui: React.ReactElement, options?: RenderWithProvidersOptions) {
  const { authenticated = true, ...renderOptions } = options ?? {};
  if (authenticated) {
    setToken('test-token', 3600);
  }
  return render(ui, { wrapper: AllProviders, ...renderOptions });
}
