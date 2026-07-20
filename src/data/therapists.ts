import { User } from '../types/User';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const therapists: User[] = [
  {
    id: 'user-manager-1',
    fullName: 'שרה לוי',
    email: 'sara.levi@example.co.il',
    role: 'Manager',
    isActive: true,
  },
  {
    id: 'user-therapist-1',
    fullName: 'מיכל כהן',
    email: 'michal.cohen@example.co.il',
    role: 'Therapist',
    isActive: true,
  },
];
