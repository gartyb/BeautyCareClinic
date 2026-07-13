export type SeriesKind = 'quantity' | 'timer';

export interface TreatmentSeries {
  id: string;
  orderItemId: string;
  packageTypeId: string;
  customerId: string;
  seriesKind: SeriesKind;
  // quantity-based
  totalTreatments?: number;
  completedTreatments?: number;
  // timer-based
  totalMinutes?: number;
  usedMinutes?: number;
  minutesPerTreatment?: number;
  createdDate: string;
}
