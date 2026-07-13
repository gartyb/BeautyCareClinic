import { Customer } from '../types/Customer';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const customers: Customer[] = [
  {
    id: 'cust-1',
    firstName: 'רחל',
    lastName: 'אברהם',
    phone: '050-1234567',
    email: 'rachel.avraham@gmail.com',
    createdDate: '2024-01-15',
  },
  {
    id: 'cust-2',
    firstName: 'דנה',
    lastName: 'שפירא',
    phone: '052-9876543',
    email: 'dana.shapira@gmail.com',
    createdDate: '2024-03-10',
  },
  {
    id: 'cust-3',
    firstName: 'אסתר',
    lastName: 'מזרחי',
    phone: '054-5551234',
    email: 'esther.mizrahi@gmail.com',
    createdDate: '2023-09-20',
  },
  {
    id: 'cust-4',
    firstName: 'יעל',
    lastName: 'גולן',
    phone: '058-7778899',
    email: 'yael.golan@gmail.com',
    createdDate: '2025-11-01',
  },
  {
    id: 'cust-5',
    firstName: 'נועה',
    lastName: 'ברק',
    phone: '050-3334455',
    email: 'noa.barak@gmail.com',
    createdDate: '2024-06-18',
  },
];
