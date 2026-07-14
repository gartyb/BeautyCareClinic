import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { therapists } from '../../data/therapists';
import { User } from '../../types/User';

interface Props {
  currentUser: User;
  onUserChange: (user: User) => void;
}

export function Header({ currentUser, onUserChange }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-white border-b border-clinic-border shadow-sm h-14 flex items-center justify-between px-6">
      {/* First DOM child = visually RIGHT in RTL: clinic logo + name */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-clinic-pink flex items-center justify-center">
          <span className="text-clinic-gold font-bold text-sm">מ</span>
        </div>
        <span className="text-xl font-bold text-clinic-gold">מרפאת יופי</span>
      </div>

      {/* Second DOM child = visually LEFT in RTL: user switcher */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="flex items-center gap-2 text-sm text-clinic-muted hover:text-clinic-text transition-colors"
        >
          <span>Dev: {currentUser.firstName} {currentUser.lastName}</span>
          <ChevronDown size={14} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full mt-1 right-0 bg-white border border-clinic-border rounded-lg shadow-lg z-50 min-w-[180px]">
            {therapists.map(user => (
              <button
                key={user.id}
                onClick={() => {
                  onUserChange(user);
                  setDropdownOpen(false);
                }}
                className="w-full text-right px-4 py-2 text-sm text-clinic-text hover:bg-clinic-blush first:rounded-t-lg last:rounded-b-lg"
              >
                {user.firstName} {user.lastName}
                <span className="text-clinic-muted mr-2">({user.role === 'Manager' ? 'מנהלת' : 'מטפלת'})</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
