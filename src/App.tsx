import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/shared/Header';
import { Sidebar } from './components/shared/Sidebar';
import { RoleGuard } from './components/shared/RoleGuard';
import { PrivateRoute } from './components/shared/PrivateRoute';
import { LoginPage } from './features/auth/LoginPage';
import { SearchScreen } from './features/search/SearchScreen';
import { CustomerCard } from './features/customer/CustomerCard';
import { PackagesScreen } from './features/packages/PackagesScreen';
import { TherapistsScreen } from './features/therapists/TherapistsScreen';
import { TherapistDetail } from './features/therapists/TherapistDetail';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TreatmentTypesScreen } from './features/treatmentTypes/TreatmentTypesScreen';
import AppointmentCalendarScreen from './features/appointments/AppointmentCalendarScreen';

function AppShell() {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-clinic-bg flex flex-col font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentUser={currentUser} />
        <main className="flex-1 overflow-hidden flex">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/customers/:id" element={<CustomerCard currentUser={currentUser} />} />
            <Route path="/appointments" element={<AppointmentCalendarScreen />} />
            <Route
              path="/packages"
              element={
                <RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>
                  <PackagesScreen />
                </RoleGuard>
              }
            />
            <Route
              path="/therapists"
              element={
                <RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>
                  <TherapistsScreen />
                </RoleGuard>
              }
            />
            <Route
              path="/therapists/:userId"
              element={
                <RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>
                  <TherapistDetail />
                </RoleGuard>
              }
            />
            <Route
              path="/treatment-types"
              element={
                <RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>
                  <TreatmentTypesScreen />
                </RoleGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RoleGuard user={currentUser} role="Manager" fallback={<Navigate to="/search" replace />}>
                  <SettingsScreen />
                </RoleGuard>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}
