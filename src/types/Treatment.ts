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
  treatmentSeriesId?: string;
  treatmentDate: string;
  durationMinutes?: number;
  therapistId: string;
  notes?: string;
  treatmentPhotos: TreatmentPhoto[];
}
