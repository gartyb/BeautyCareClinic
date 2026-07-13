import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { User } from './types/User';
import { therapists } from './data/therapists';
import { Header } from './components/shared/Header';
import { Sidebar } from './components/shared/Sidebar';
import { SearchScreen } from './features/search/SearchScreen';
import { CustomerCard } from './features/customer/CustomerCard';

export function App() {
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
            <Route path="/customers/:id" element={<CustomerCard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
