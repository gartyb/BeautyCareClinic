import { TreatmentSeries } from '../types/TreatmentSeries';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const treatmentSeries: TreatmentSeries[] = [
  // cust-1: active quantity series (3/10 completed)
  {
    id: 'series-1',
    orderItemId: 'oi-1',
    packageTypeId: 'pt-1',
    customerId: 'cust-1',
    seriesKind: 'quantity',
    totalTreatments: 10,
    completedTreatments: 3,
    createdDate: '2025-10-01',
  },
  // cust-1: active laser series (1/6 completed)
  {
    id: 'series-2',
    orderItemId: 'oi-2',
    packageTypeId: 'pt-2',
    customerId: 'cust-1',
    seriesKind: 'quantity',
    totalTreatments: 6,
    completedTreatments: 1,
    createdDate: '2025-11-15',
  },
  // cust-2: timer series in progress (90/360 min used)
  {
    id: 'series-3',
    orderItemId: 'oi-4',
    packageTypeId: 'pt-3',
    customerId: 'cust-2',
    seriesKind: 'timer',
    totalMinutes: 360,
    usedMinutes: 90,
    minutesPerTreatment: 60,
    createdDate: '2025-09-01',
  },
  // cust-2: medical massage timer series (135/360 min used)
  {
    id: 'series-4',
    orderItemId: 'oi-5',
    packageTypeId: 'pt-5',
    customerId: 'cust-2',
    seriesKind: 'timer',
    totalMinutes: 360,
    usedMinutes: 135,
    minutesPerTreatment: 45,
    createdDate: '2025-09-15',
  },
  // cust-3: completed quantity series (10/10)
  {
    id: 'series-5',
    orderItemId: 'oi-7',
    packageTypeId: 'pt-1',
    customerId: 'cust-3',
    seriesKind: 'quantity',
    totalTreatments: 10,
    completedTreatments: 10,
    createdDate: '2024-01-10',
  },
  // cust-3: completed laser series (6/6)
  {
    id: 'series-6',
    orderItemId: 'oi-8',
    packageTypeId: 'pt-2',
    customerId: 'cust-3',
    seriesKind: 'quantity',
    totalTreatments: 6,
    completedTreatments: 6,
    createdDate: '2024-03-01',
  },
  // cust-4: new quantity series (0/10)
  {
    id: 'series-7',
    orderItemId: 'oi-10',
    packageTypeId: 'pt-1',
    customerId: 'cust-4',
    seriesKind: 'quantity',
    totalTreatments: 10,
    completedTreatments: 0,
    createdDate: '2025-11-01',
  },
  // cust-5: active timer series (180/360 min used)
  {
    id: 'series-8',
    orderItemId: 'oi-11',
    packageTypeId: 'pt-3',
    customerId: 'cust-5',
    seriesKind: 'timer',
    totalMinutes: 360,
    usedMinutes: 180,
    minutesPerTreatment: 60,
    createdDate: '2025-07-01',
  },
  // cust-5: completed laser series (6/6)
  {
    id: 'series-9',
    orderItemId: 'oi-12',
    packageTypeId: 'pt-2',
    customerId: 'cust-5',
    seriesKind: 'quantity',
    totalTreatments: 6,
    completedTreatments: 6,
    createdDate: '2025-02-01',
  },
];
