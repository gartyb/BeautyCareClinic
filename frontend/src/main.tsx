import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GlobalSettingsProvider } from './contexts/GlobalSettingsContext';
import { CustomersProvider } from './contexts/CustomersContext';
import { TherapistDataProvider } from './contexts/TherapistDataContext';
import { TherapistsProvider } from './contexts/TherapistsContext';
import { TreatmentTypesProvider } from './contexts/TreatmentTypesContext';
import { PackageTypesProvider } from './contexts/PackageTypesContext';
import { AppointmentsProvider } from './contexts/AppointmentsContext';
import { CustomerProvider } from './contexts/CustomerContext';
import { ActiveTimerProvider } from './contexts/ActiveTimerContext';
import './index.css';
import { App } from './App';

document.documentElement.dir = 'rtl';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
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
                    <App />
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
    </BrowserRouter>
  </StrictMode>
);
