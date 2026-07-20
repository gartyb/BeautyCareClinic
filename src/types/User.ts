export type UserRole = 'Manager' | 'Therapist';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  /** Phase 012 — soft-deactivation flag. Optional (rather than required) so callers unrelated to
   * therapist management (auth session, other mock/test fixtures) don't need to carry it — treat
   * `undefined` as active; only an explicit `false` means deactivated. Always populated by
   * TherapistsContext/TherapistDataContext, which are the only consumers that check it. */
  isActive?: boolean;
}
