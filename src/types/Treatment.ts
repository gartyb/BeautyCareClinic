export interface TreatmentPhoto {
  id: string;
  treatmentId: string;
  photoUrl: string;
  uploadedDate: string;
}

export interface Treatment {
  id: string;
  customerId: string;
  treatmentTypeId: string;
  /** Denormalized from API response — treatment type name */
  treatmentTypeName?: string;
  treatmentSeriesId?: string;
  treatmentDate: string;
  durationMinutes?: number;
  /** Server-derived user id of the therapist who performed the treatment */
  userId?: string;
  /** Kept as alias for backward compatibility with mock data; use userId for API responses */
  therapistId?: string;
  /** Snapshot of the therapist's name at recording time */
  performedByFullName?: string;
  notes?: string;
  treatmentPhotos: TreatmentPhoto[];
}
