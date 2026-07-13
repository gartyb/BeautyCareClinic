import { PackageType } from '../types/PackageType';

export const packageTypes: PackageType[] = [
  {
    id: 'pt-1',
    name: 'טיפול פנים בסיסי',
    treatmentTypeId: 'tt-1',
    price: '350',
    isSeries: true,
    treatmentCount: 10,
    isTimerBased: false,
  },
  {
    id: 'pt-2',
    name: 'הסרת שיער בלייזר',
    treatmentTypeId: 'tt-2',
    price: '1200',
    isSeries: true,
    treatmentCount: 6,
    isTimerBased: false,
  },
  {
    id: 'pt-3',
    name: 'עיסוי שוודי',
    treatmentTypeId: 'tt-3',
    price: '480',
    isSeries: true,
    treatmentCount: 6,
    isTimerBased: true,
    minutesPerTreatment: 60,
  },
  {
    id: 'pt-4',
    name: 'טיפול פנים פרימיום',
    treatmentTypeId: 'tt-1',
    price: '200',
    isSeries: false,
  },
  {
    id: 'pt-5',
    name: 'עיסוי רפואי',
    treatmentTypeId: 'tt-3',
    price: '640',
    isSeries: true,
    treatmentCount: 8,
    isTimerBased: true,
    minutesPerTreatment: 45,
  },
];
