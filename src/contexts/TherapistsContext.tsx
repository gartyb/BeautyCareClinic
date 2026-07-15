import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { User } from '../types/User';
import { therapists as seedTherapists } from '../data/therapists';
import { newId } from '../domain/id';
import { DomainError } from '../domain/errors';

interface TherapistsContextValue {
  therapists: User[];
  createTherapist: (firstName: string, lastName: string, email: string, phone: string) => User;
  updateTherapist: (id: string, phone: string, email: string) => void;
  deleteTherapist: (id: string) => void;
}

const TherapistsContext = createContext<TherapistsContextValue | null>(null);

export function TherapistsProvider({ children }: { children: React.ReactNode }) {
  const [therapists, setTherapists] = useState<User[]>(
    seedTherapists.filter(u => u.role === 'Therapist')
  );

  const createTherapist = useCallback((firstName: string, lastName: string, email: string, phone: string): User => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();
    const ph = phone.trim();
    if (!fn) throw new DomainError('THERAPIST_FIRST_NAME_REQUIRED', 'שם פרטי נדרש');
    if (fn.length > 50) throw new DomainError('THERAPIST_FIRST_NAME_TOO_LONG', 'שם פרטי לא יכול לעלות על 50 תווים');
    if (!ln) throw new DomainError('THERAPIST_LAST_NAME_REQUIRED', 'שם משפחה נדרש');
    if (ln.length > 50) throw new DomainError('THERAPIST_LAST_NAME_TOO_LONG', 'שם משפחה לא יכול לעלות על 50 תווים');
    if (!em) throw new DomainError('THERAPIST_EMAIL_REQUIRED', 'אימייל נדרש');
    if (em.length > 100) throw new DomainError('THERAPIST_EMAIL_TOO_LONG', 'אימייל לא יכול לעלות על 100 תווים');
    if (!/.+@.+\..+/.test(em)) throw new DomainError('THERAPIST_EMAIL_INVALID', 'כתובת אימייל לא תקינה');
    if (!ph) throw new DomainError('THERAPIST_PHONE_REQUIRED', 'טלפון נדרש');
    if (!/^\d{7,10}$/.test(ph)) throw new DomainError('THERAPIST_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
    const user: User = { id: newId(), firstName: fn, lastName: ln, email: em, phone: ph, role: 'Therapist' };
    setTherapists(prev => [...prev, user]);
    return user;
  }, []);

  const updateTherapist = useCallback((id: string, phone: string, email: string): void => {
    const ph = phone.trim();
    const em = email.trim();
    if (!ph) throw new DomainError('THERAPIST_PHONE_REQUIRED', 'טלפון נדרש');
    if (!/^\d{7,10}$/.test(ph)) throw new DomainError('THERAPIST_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
    if (!em) throw new DomainError('THERAPIST_EMAIL_REQUIRED', 'אימייל נדרש');
    if (em.length > 100) throw new DomainError('THERAPIST_EMAIL_TOO_LONG', 'אימייל לא יכול לעלות על 100 תווים');
    if (!/.+@.+\..+/.test(em)) throw new DomainError('THERAPIST_EMAIL_INVALID', 'כתובת אימייל לא תקינה');
    setTherapists(prev => prev.map(u => u.id === id ? { ...u, phone: ph, email: em } : u));
  }, []);

  const deleteTherapist = useCallback((id: string): void => {
    setTherapists(prev => prev.filter(u => u.id !== id));
  }, []);

  const value = useMemo<TherapistsContextValue>(
    () => ({ therapists, createTherapist, updateTherapist, deleteTherapist }),
    [therapists, createTherapist, updateTherapist, deleteTherapist]
  );

  return (
    <TherapistsContext.Provider value={value}>
      {children}
    </TherapistsContext.Provider>
  );
}

export function useTherapists(): TherapistsContextValue {
  const ctx = useContext(TherapistsContext);
  if (!ctx) throw new Error('useTherapists must be used within TherapistsProvider');
  return ctx;
}
