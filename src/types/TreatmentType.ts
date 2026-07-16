export interface TreatmentType {
  id: string;
  name: string;
  /** Default appointment duration in minutes. Must be > 0. */
  defaultDurationMinutes: number;
}
