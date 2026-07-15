export interface TherapistWorkingHours {
  id: string;
  userId: string;
  weekday: number; // 0 = Sunday, 6 = Saturday
  startTime: string | null;
  endTime: string | null;
}

export interface TherapistUnavailableDate {
  id: string;
  userId: string;
  date: string; // ISO date yyyy-MM-dd
}

export interface TherapistCapability {
  id: string;
  userId: string;
  treatmentTypeId: string;
}
