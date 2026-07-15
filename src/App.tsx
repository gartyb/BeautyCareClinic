import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types/User';
import { therapists } from './data/therapists';
import { Header } from './components/shared/Header';
import { Sidebar } from './components/shared/Sidebar';
import { RoleGuard } from './components/shared/RoleGuard';
import { SearchScreen } from './features/search/SearchScreen';
import { CustomerCard } from './features/customer/CustomerCard';
import { PackagesScreen } from './features/packages/PackagesScreen';
import { TherapistsScreen } from './features/therapists/TherapistsScreen';
import { TherapistDetail } from './features/therapists/TherapistDetail';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TreatmentTypesScreen } from './features/treatmentTypes/TreatmentTypesScreen';

export function App() {
  // WARNING: never default to a privileged role in production — replace with real auth (CR-006)
  const [currentUser, setCurrentUser] = useState<User>(therapists[0]!);

  return (
    <div className="min-h-screen bg-clinic-bg flex flex-col font-sans">
      <Header currentUser={currentUser} onUserChange={setCurrentUser} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentUser={currentUser} />
        <main className="flex-1 overflow-hidden flex">
          <Routes>
            <Route path="/" element={<Navigate to="/search" replace />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/customers/:id" element={<CustomerCard currentUser={currentUser} />} />
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
