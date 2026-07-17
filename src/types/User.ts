export type UserRole = 'Manager' | 'Therapist';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
}
