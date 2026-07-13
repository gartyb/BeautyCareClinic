import type { User, UserRole } from '../../types/User';

interface RoleGuardProps {
  user: User;
  role: UserRole;
  children: React.ReactNode;
}

// NOTE: client-side role checks are UX-only, not a security control (CR-002)
export function RoleGuard({ user, role, children }: RoleGuardProps) {
  if (user.role !== role) return null;
  return <>{children}</>;
}
