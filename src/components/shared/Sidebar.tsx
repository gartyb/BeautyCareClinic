import { NavLink } from 'react-router-dom';
import { Search, Calendar, Package, Users, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { User } from '../../types/User';

interface Props {
  currentUser: User;
}

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  managerOnly?: boolean;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { label: 'חיפוש לקוחה', to: '/search', icon: <Search size={18} /> },
  { label: 'תורים', icon: <Calendar size={18} />, disabled: true },
  { label: 'סוגי חבילות', icon: <Package size={18} />, managerOnly: true, disabled: true },
  { label: 'מטפלות', icon: <Users size={18} />, managerOnly: true, disabled: true },
  { label: 'הגדרות', icon: <Settings size={18} />, managerOnly: true, disabled: true },
];

export function Sidebar({ currentUser }: Props) {
  const isManager = currentUser.role === 'Manager';

  return (
    <aside className="w-56 bg-white border-l border-clinic-border flex flex-col py-6">
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map(item => {
          if (item.managerOnly && !isManager) return null;

          if (item.disabled || !item.to) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-clinic-muted opacity-50 cursor-not-allowed text-sm"
                title="זמין בקרוב"
              >
                <span className="text-clinic-muted">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-clinic-blush text-clinic-gold font-semibold'
                    : 'text-clinic-text hover:bg-clinic-blush hover:text-clinic-gold'
                )
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
