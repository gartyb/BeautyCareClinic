import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
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

export function renderWithProviders(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: AllProviders, ...options });
}
