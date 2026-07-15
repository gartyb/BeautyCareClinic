export type UserRole = 'Manager' | 'Therapist';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
}
