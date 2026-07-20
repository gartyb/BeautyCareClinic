import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User, UserRole } from '../types/User';
import { getUsers } from '../api/usersApi';
import { ApiRequestError } from '../api/apiError';
import { newId } from '../domain/id';
import { DomainError } from '../domain/errors';
import { useAuth } from './AuthContext';

interface TherapistsContextValue {
  therapists: User[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTherapist: (fullName: string, email: string, phone: string) => User;
  updateTherapist: (id: string, phone: string, email: string) => void;
  deleteTherapist: (id: string) => void;
}

const TherapistsContext = createContext<TherapistsContextValue | null>(null);

export function TherapistsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [therapists, setTherapists] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Phase 011 Q7 (original): this context sources the full-detail therapist list (with
  // email/phone) from real Users with Role=Therapist via GET /api/v1/users?role=Therapist
  // (usersApi.getUsers), replacing the mock `data/therapists.ts` seed array.
  //
  // UsersController is [Authorize(Policy="Manager")]-only at the class level for ALL its
  // endpoints (its UserDto carries email/phone — real PII — for every user), so this fetch 403s
  // for a Therapist-role current user. That is fine for THIS context's actual consumers: the
  // Manager-only therapist-management screen (src/features/therapists/*, gated by
  // Sidebar.tsx's managerOnly flag on "/therapists") is the only place `therapists` from this
  // context is read.
  //
  // Bugfix (post-Phase-011): the Appointments booking/reschedule/calendar therapist picker
  // (BookAppointmentModal, RescheduleModal, CalendarGrid) — which IS usable by Therapist-role
  // users (Q7's intent) — no longer sources from this context. It now reads `therapists` from
  // TherapistDataContext, which is backed by the new narrow, non-Manager-gated
  // GET /api/v1/therapists (name+id only, no PII). See TherapistDataContext.tsx for the full
  // reasoning.
  const fetchTherapists = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getUsers('Therapist');
      if (isCancelled?.()) return;
      setTherapists(dtos.map(dto => ({
        id: dto.id,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        role: dto.role as UserRole,
      })));
    } catch (e) {
      if (isCancelled?.()) return;
      const msg = e instanceof ApiRequestError ? e.error.message : 'שגיאה בטעינת רשימת המטפלות';
      setError(msg);
      setTherapists([]);
    } finally {
      if (!isCancelled?.()) setIsLoading(false);
    }
  }, []);

  // Auth-gated fetch (same pattern as CustomersContext/TreatmentTypesContext — v0.10.1 fix).
  // Bugfix (post-Phase-011): also role-gated — GET /api/v1/users?role=Therapist is
  // [Authorize(Policy="Manager")]-only (see the comment above), so it's guaranteed to 403 for a
  // Therapist-role current user. Skip the fetch entirely in that case rather than firing a call
  // that can never succeed.
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Manager') {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    fetchTherapists(() => cancelled);
    return () => { cancelled = true; };
  }, [currentUser, fetchTherapists]);

  const refresh = useCallback(() => fetchTherapists(), [fetchTherapists]);

  // createTherapist/updateTherapist/deleteTherapist remain local-state-only mutations (FU-008,
  // pre-existing, unaffected by this pass — out of scope for Phase 011's Appointments work).
  // There is no backend write API for Users wired up on the frontend yet; the management screen
  // (src/features/therapists/*, Manager-only) that calls these keeps behaving exactly as before:
  // changes appear locally for the session but do not persist server-side.
  const createTherapist = useCallback((fullName: string, email: string, phone: string): User => {
    const fn = fullName.trim();
    const em = email.trim();
    const ph = phone.trim();
    if (!fn) throw new DomainError('THERAPIST_NAME_REQUIRED', 'שם מלא נדרש');
    if (fn.length > 100) throw new DomainError('THERAPIST_NAME_TOO_LONG', 'שם לא יכול לעלות על 100 תווים');
    if (!em) throw new DomainError('THERAPIST_EMAIL_REQUIRED', 'אימייל נדרש');
    if (em.length > 100) throw new DomainError('THERAPIST_EMAIL_TOO_LONG', 'אימייל לא יכול לעלות על 100 תווים');
    if (!/.+@.+\..+/.test(em)) throw new DomainError('THERAPIST_EMAIL_INVALID', 'כתובת אימייל לא תקינה');
    if (!ph) throw new DomainError('THERAPIST_PHONE_REQUIRED', 'טלפון נדרש');
    if (!/^\d{7,10}$/.test(ph)) throw new DomainError('THERAPIST_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
    const user: User = { id: newId(), fullName: fn, email: em, phone: ph, role: 'Therapist' };
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
    () => ({ therapists, isLoading, error, refresh, createTherapist, updateTherapist, deleteTherapist }),
    [therapists, isLoading, error, refresh, createTherapist, updateTherapist, deleteTherapist]
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
