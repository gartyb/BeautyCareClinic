import React from 'react';
import type { User, UserRole } from '../../types/User';

interface RoleGuardProps {
  user: User;
  role: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// NOTE: client-side role checks are UX-only, not a security control (CR-002)
export function RoleGuard({ user, role, children, fallback = null }: RoleGuardProps) {
  if (user.role !== role) return <>{fallback}</>;
  return <>{children}</>;
}
