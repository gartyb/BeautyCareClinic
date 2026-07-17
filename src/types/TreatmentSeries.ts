export type SeriesKind = 'quantity' | 'timer';

export interface TreatmentSeries {
  id: string;
  orderItemId: string;
  // API enrichment fields (present when loaded from real backend; absent in mock data)
  packageTypeName?: string;
  isTimerBased?: boolean;
  // Numeric progress fields (conditionally present depending on seriesKind)
  totalTreatments?: number;
  completedTreatments?: number;
  totalMinutes?: number;
  usedMinutes?: number;
  // Legacy fields preserved for mock-data and Phase < 010 compatibility
  packageTypeId?: string;
  customerId?: string;
  seriesKind?: SeriesKind;
  minutesPerTreatment?: number;
  createdDate?: string;
}
