export interface PackageType {
  id: string;
  name: string;
  treatmentTypeId: string;
  price: string; // decimal as string
  isSeries: boolean;
  treatmentCount?: number;
  isTimerBased?: boolean;
  minutesPerTreatment?: number;
}
