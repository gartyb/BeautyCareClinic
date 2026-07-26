import { Payment } from '../types/Payment';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const payments: Payment[] = [
  // cust-1, order-1: two partial payments
  {
    id: 'pay-1',
    customerOrderId: 'order-1',
    amount: 500,
    method: 'Credit Card',
    paymentDate: '2025-10-01',
    createdDate: '2025-10-01',
    createdByUserId: 'user-manager-1',
  },
  {
    id: 'pay-2',
    customerOrderId: 'order-1',
    amount: 300,
    method: 'Cash',
    paymentDate: '2025-11-01',
    createdDate: '2025-11-01',
    createdByUserId: 'user-therapist-1',
  },
  // cust-1, order-2: single full payment
  {
    id: 'pay-3',
    customerOrderId: 'order-2',
    amount: 200,
    method: 'Cash',
    paymentDate: '2025-08-20',
    createdDate: '2025-08-20',
    createdByUserId: 'user-therapist-1',
  },
  // cust-2, order-3: one partial payment
  {
    id: 'pay-4',
    customerOrderId: 'order-3',
    amount: 400,
    method: 'Bank Transfer',
    paymentDate: '2025-09-01',
    createdDate: '2025-09-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-3, order-5: two payments (full)
  {
    id: 'pay-5',
    customerOrderId: 'order-5',
    amount: 800,
    method: 'Credit Card',
    paymentDate: '2024-01-10',
    createdDate: '2024-01-10',
    createdByUserId: 'user-manager-1',
  },
  {
    id: 'pay-6',
    customerOrderId: 'order-5',
    amount: 750,
    method: 'Credit Card',
    paymentDate: '2024-02-10',
    createdDate: '2024-02-10',
    createdByUserId: 'user-manager-1',
  },
  // cust-3, order-6: full payment
  {
    id: 'pay-7',
    customerOrderId: 'order-6',
    amount: 200,
    method: 'Cash',
    paymentDate: '2024-08-15',
    createdDate: '2024-08-15',
    createdByUserId: 'user-therapist-1',
  },
  // cust-5, order-8: partial payment
  {
    id: 'pay-8',
    customerOrderId: 'order-8',
    amount: 240,
    method: 'Cash',
    paymentDate: '2025-07-01',
    createdDate: '2025-07-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-5, order-9: three payments (full)
  {
    id: 'pay-9',
    customerOrderId: 'order-9',
    amount: 400,
    method: 'Credit Card',
    paymentDate: '2025-02-01',
    createdDate: '2025-02-01',
    createdByUserId: 'user-manager-1',
  },
  {
    id: 'pay-10',
    customerOrderId: 'order-9',
    amount: 400,
    method: 'Credit Card',
    paymentDate: '2025-03-01',
    createdDate: '2025-03-01',
    createdByUserId: 'user-manager-1',
  },
  {
    id: 'pay-11',
    customerOrderId: 'order-9',
    amount: 400,
    method: 'Credit Card',
    paymentDate: '2025-04-01',
    createdDate: '2025-04-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-5, order-10: full payment
  {
    id: 'pay-12',
    customerOrderId: 'order-10',
    amount: 200,
    method: 'Cash',
    paymentDate: '2025-05-10',
    createdDate: '2025-05-10',
    createdByUserId: 'user-therapist-1',
  },
];
