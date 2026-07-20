import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User, UserRole } from '../types/User';
import { getUsers, createUser, updateUser, deactivateUser, deleteUser } from '../api/usersApi';
import { ApiRequestError } from '../api/apiError';
import { DomainError } from '../domain/errors';
import { useAuth } from './AuthContext';
import { useTherapistData } from './TherapistDataContext';
import { registerTherapistsContextRefresh } from './therapistRefreshBus';

interface TherapistsContextValue {
  therapists: User[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTherapist: (fullName: string, email: string, phone: string, password: string) => Promise<User>;
  updateTherapist: (id: string, phone: string, email: string) => Promise<void>;
  deactivateTherapist: (id: string) => Promise<void>;
  deleteTherapist: (id: string) => Promise<void>;
}

const TherapistsContext = createContext<TherapistsContextValue | null>(null);

export function TherapistsProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  // TherapistDataProvider is mounted as an ancestor of TherapistsProvider (see main.tsx), so this
  // context can reach TherapistDataContext's refresh directly (RC-5, one of the two directions).
  const { refresh: refreshTherapistData } = useTherapistData();
  const [therapists, setTherapists] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const therapistsRef = useRef<User[]>([]);
  therapistsRef.current = therapists;

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
  //
  // Phase 012: fetches with includeInactive=true — this is the Manager-only management screen,
  // which must still show a deactivated therapist so a Manager can navigate to their detail page
  // (read-only) and see history. Only the booking-facing GET /api/v1/therapists (via
  // TherapistDataContext) stays strictly active-only.
  const fetchTherapists = useCallback(async (isCancelled?: () => boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const dtos = await getUsers('Therapist', true);
      if (isCancelled?.()) return;
      setTherapists(dtos.map(dto => ({
        id: dto.id,
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        role: dto.role as UserRole,
        isActive: dto.isActive,
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

  // RC-5 — register this context's refresh so TherapistDataContext's schedule mutations can
  // trigger it too (the reverse direction of the two useTherapistData() calls below).
  useEffect(() => {
    registerTherapistsContextRefresh(refresh);
    return () => registerTherapistsContextRefresh(null);
  }, [refresh]);

  const createTherapist = useCallback(async (
    fullName: string, email: string, phone: string, password: string
  ): Promise<User> => {
    const fn = fullName.trim();
    const em = email.trim();
    const ph = phone.trim();
    const pw = password;
    if (!fn) throw new DomainError('THERAPIST_NAME_REQUIRED', 'שם מלא נדרש');
    if (fn.length > 100) throw new DomainError('THERAPIST_NAME_TOO_LONG', 'שם לא יכול לעלות על 100 תווים');
    if (!em) throw new DomainError('THERAPIST_EMAIL_REQUIRED', 'אימייל נדרש');
    if (em.length > 100) throw new DomainError('THERAPIST_EMAIL_TOO_LONG', 'אימייל לא יכול לעלות על 100 תווים');
    if (!/.+@.+\..+/.test(em)) throw new DomainError('THERAPIST_EMAIL_INVALID', 'כתובת אימייל לא תקינה');
    if (!ph) throw new DomainError('THERAPIST_PHONE_REQUIRED', 'טלפון נדרש');
    if (!/^\d{7,10}$/.test(ph)) throw new DomainError('THERAPIST_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
    if (!pw) throw new DomainError('THERAPIST_PASSWORD_REQUIRED', 'סיסמה נדרשת');
    if (pw.length < 8) throw new DomainError('THERAPIST_PASSWORD_TOO_SHORT', 'הסיסמה חייבת להכיל לפחות 8 תווים');
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw)) {
      throw new DomainError(
        'THERAPIST_PASSWORD_WEAK',
        'הסיסמה חייבת לכלול אות גדולה, אות קטנה, ספרה ותו מיוחד'
      );
    }

    try {
      const dto = await createUser({ fullName: fn, email: em, phone: ph, password: pw });
      await fetchTherapists();
      // RC-5 — a newly created therapist must appear in the booking picker immediately.
      await refreshTherapistData();
      return { id: dto.id, fullName: dto.fullName, email: dto.email, phone: dto.phone, role: dto.role as UserRole, isActive: dto.isActive };
    } catch (e) {
      if (e instanceof ApiRequestError) throw new DomainError('THERAPIST_CREATE_FAILED', e.error.message);
      throw e;
    }
  }, [fetchTherapists, refreshTherapistData]);

  const updateTherapist = useCallback(async (id: string, phone: string, email: string): Promise<void> => {
    const ph = phone.trim();
    const em = email.trim();
    if (!ph) throw new DomainError('THERAPIST_PHONE_REQUIRED', 'טלפון נדרש');
    if (!/^\d{7,10}$/.test(ph)) throw new DomainError('THERAPIST_PHONE_INVALID', 'מספר טלפון לא תקין — יש להזין 7–10 ספרות');
    if (!em) throw new DomainError('THERAPIST_EMAIL_REQUIRED', 'אימייל נדרש');
    if (em.length > 100) throw new DomainError('THERAPIST_EMAIL_TOO_LONG', 'אימייל לא יכול לעלות על 100 תווים');
    if (!/.+@.+\..+/.test(em)) throw new DomainError('THERAPIST_EMAIL_INVALID', 'כתובת אימייל לא תקינה');

    // PUT /api/v1/users/{id} requires fullName too, even though this form only edits phone/email.
    const existing = therapistsRef.current.find(t => t.id === id);
    const fullName = existing?.fullName ?? '';

    try {
      await updateUser(id, { fullName, email: em, phone: ph });
      await fetchTherapists();
      await refreshTherapistData();
    } catch (e) {
      if (e instanceof ApiRequestError) throw new DomainError('THERAPIST_UPDATE_FAILED', e.error.message);
      throw e;
    }
  }, [fetchTherapists, refreshTherapistData]);

  const deactivateTherapist = useCallback(async (id: string): Promise<void> => {
    try {
      await deactivateUser(id);
      await fetchTherapists();
      // RC-5 — a deactivated therapist must disappear from the booking picker immediately.
      await refreshTherapistData();
    } catch (e) {
      if (e instanceof ApiRequestError) throw new DomainError('THERAPIST_DEACTIVATE_FAILED', e.error.message);
      throw e;
    }
  }, [fetchTherapists, refreshTherapistData]);

  const deleteTherapist = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteUser(id);
      await fetchTherapists();
      await refreshTherapistData();
    } catch (e) {
      if (e instanceof ApiRequestError) throw new DomainError('THERAPIST_DELETE_FAILED', e.error.message);
      throw e;
    }
  }, [fetchTherapists, refreshTherapistData]);

  const value = useMemo<TherapistsContextValue>(
    () => ({ therapists, isLoading, error, refresh, createTherapist, updateTherapist, deactivateTherapist, deleteTherapist }),
    [therapists, isLoading, error, refresh, createTherapist, updateTherapist, deactivateTherapist, deleteTherapist]
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
