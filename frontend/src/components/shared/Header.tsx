import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const { currentUser, logout } = useAuth();

  return (
    <header className="bg-white border-b border-clinic-border shadow-sm h-14 flex items-center justify-between px-6">
      {/* First DOM child = visually RIGHT in RTL: clinic logo + name */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-clinic-pink flex items-center justify-center">
          <span className="text-clinic-gold font-bold text-sm">מ</span>
        </div>
        <span className="text-xl font-bold text-clinic-gold">מרפאת יופי</span>
      </div>

      {/* Second DOM child = visually LEFT in RTL: user info + logout */}
      <div className="flex items-center gap-3">
        {currentUser && (
          <span className="text-sm text-clinic-text font-medium">
            {currentUser.fullName}
          </span>
        )}
        <button
          onClick={logout}
          title="יציאה"
          className="flex items-center gap-1.5 text-sm text-clinic-muted hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} />
          <span>יציאה</span>
        </button>
      </div>
    </header>
  );
}
