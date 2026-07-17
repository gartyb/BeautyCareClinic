export interface PackageType {
  id: string;
  name: string;
  treatmentTypeId: string;
  price: string | number;
  isSeries: boolean;
  isTimerBased: boolean;
  treatmentCount?: number;
  minutesPerTreatment?: number;
}
