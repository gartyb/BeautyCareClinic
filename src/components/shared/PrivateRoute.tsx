import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function PrivateRoute() {
  const { currentUser, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-clinic-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-clinic-pink flex items-center justify-center">
            <span className="text-clinic-gold font-bold text-lg">מ</span>
          </div>
          <span className="text-clinic-muted text-sm">טוען...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
