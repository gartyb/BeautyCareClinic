/**
 * Phase 012 RC-5 — TherapistsContext and TherapistDataContext hold separate state sourced from
 * separate endpoints (GET /users?role=Therapist vs GET /therapists + GET /therapists/availability).
 * A create/update/deactivate mutation (TherapistsContext) or a schedule mutation
 * (TherapistDataContext) must refresh BOTH, or a deactivated therapist lingers in the booking
 * picker (or a newly-created one is missing from it) until a full page reload.
 *
 * TherapistDataProvider is mounted as an ANCESTOR of TherapistsProvider (see main.tsx), so
 * TherapistsContext can call `useTherapistData().refresh()` directly. The reverse direction
 * (TherapistDataContext mutations refreshing TherapistsContext) cannot use a context hook the same
 * way, since TherapistDataProvider is not a descendant of TherapistsProvider. This tiny
 * registration bus closes that one remaining direction without merging the two contexts or
 * restructuring the provider tree.
 */
type RefreshFn = () => void;

let therapistsContextRefresh: RefreshFn | null = null;

export function registerTherapistsContextRefresh(fn: RefreshFn | null): void {
  therapistsContextRefresh = fn;
}

export function triggerTherapistsContextRefresh(): void {
  therapistsContextRefresh?.();
}
