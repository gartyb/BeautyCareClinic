import { CustomerOrder } from '../types/Order';

// MOCK DATA — Phase 1 only. All names, phone numbers, emails, and clinical notes are synthetic.
export const orders: CustomerOrder[] = [
  // cust-1: order with facial series + laser series, partial payment
  {
    id: 'order-1',
    customerId: 'cust-1',
    totalPrice: '1550',
    amountPaid: '800',
    remainingBalance: '750',
    maxPaymentCount: 3,
    paymentCount: 2,
    orderItems: [
      { id: 'oi-1', customerOrderId: 'order-1', packageTypeId: 'pt-1', treatmentSeriesId: 'series-1' },
      { id: 'oi-2', customerOrderId: 'order-1', packageTypeId: 'pt-2', treatmentSeriesId: 'series-2' },
    ],
    createdDate: '2025-10-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-1: single premium facial, fully paid
  {
    id: 'order-2',
    customerId: 'cust-1',
    totalPrice: '200',
    amountPaid: '200',
    remainingBalance: '0',
    maxPaymentCount: 1,
    paymentCount: 1,
    orderItems: [
      { id: 'oi-3', customerOrderId: 'order-2', packageTypeId: 'pt-4' },
    ],
    createdDate: '2025-08-20',
    createdByUserId: 'user-therapist-1',
  },
  // cust-2: Swedish + medical massage timer series, partial payment
  {
    id: 'order-3',
    customerId: 'cust-2',
    totalPrice: '1120',
    amountPaid: '400',
    remainingBalance: '720',
    maxPaymentCount: 4,
    paymentCount: 1,
    orderItems: [
      { id: 'oi-4', customerOrderId: 'order-3', packageTypeId: 'pt-3', treatmentSeriesId: 'series-3' },
      { id: 'oi-5', customerOrderId: 'order-3', packageTypeId: 'pt-5', treatmentSeriesId: 'series-4' },
    ],
    createdDate: '2025-09-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-2: single premium facial, not paid
  {
    id: 'order-4',
    customerId: 'cust-2',
    totalPrice: '200',
    amountPaid: '0',
    remainingBalance: '200',
    maxPaymentCount: 1,
    paymentCount: 0,
    orderItems: [
      { id: 'oi-6', customerOrderId: 'order-4', packageTypeId: 'pt-4' },
    ],
    createdDate: '2025-12-05',
    createdByUserId: 'user-therapist-1',
  },
  // cust-3: two completed series, fully paid
  {
    id: 'order-5',
    customerId: 'cust-3',
    totalPrice: '1550',
    amountPaid: '1550',
    remainingBalance: '0',
    maxPaymentCount: 2,
    paymentCount: 2,
    orderItems: [
      { id: 'oi-7', customerOrderId: 'order-5', packageTypeId: 'pt-1', treatmentSeriesId: 'series-5' },
      { id: 'oi-8', customerOrderId: 'order-5', packageTypeId: 'pt-2', treatmentSeriesId: 'series-6' },
    ],
    createdDate: '2024-01-10',
    createdByUserId: 'user-manager-1',
  },
  // cust-3: premium facial, fully paid
  {
    id: 'order-6',
    customerId: 'cust-3',
    totalPrice: '200',
    amountPaid: '200',
    remainingBalance: '0',
    maxPaymentCount: 1,
    paymentCount: 1,
    orderItems: [
      { id: 'oi-9', customerOrderId: 'order-6', packageTypeId: 'pt-4' },
    ],
    createdDate: '2024-08-15',
    createdByUserId: 'user-therapist-1',
  },
  // cust-4: new order, no payments
  {
    id: 'order-7',
    customerId: 'cust-4',
    totalPrice: '350',
    amountPaid: '0',
    remainingBalance: '350',
    maxPaymentCount: 2,
    paymentCount: 0,
    orderItems: [
      { id: 'oi-10', customerOrderId: 'order-7', packageTypeId: 'pt-1', treatmentSeriesId: 'series-7' },
    ],
    createdDate: '2025-11-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-5: Swedish massage series, partial payment
  {
    id: 'order-8',
    customerId: 'cust-5',
    totalPrice: '480',
    amountPaid: '240',
    remainingBalance: '240',
    maxPaymentCount: 2,
    paymentCount: 1,
    orderItems: [
      { id: 'oi-11', customerOrderId: 'order-8', packageTypeId: 'pt-3', treatmentSeriesId: 'series-8' },
    ],
    createdDate: '2025-07-01',
    createdByUserId: 'user-manager-1',
  },
  // cust-5: completed laser series, fully paid
  {
    id: 'order-9',
    customerId: 'cust-5',
    totalPrice: '1200',
    amountPaid: '1200',
    remainingBalance: '0',
    maxPaymentCount: 3,
    paymentCount: 3,
    orderItems: [
      { id: 'oi-12', customerOrderId: 'order-9', packageTypeId: 'pt-2', treatmentSeriesId: 'series-9' },
    ],
    createdDate: '2025-02-01',
    createdByUserId: 'user-therapist-1',
  },
  // cust-5: single premium facial, fully paid
  {
    id: 'order-10',
    customerId: 'cust-5',
    totalPrice: '200',
    amountPaid: '200',
    remainingBalance: '0',
    maxPaymentCount: 1,
    paymentCount: 1,
    orderItems: [
      { id: 'oi-13', customerOrderId: 'order-10', packageTypeId: 'pt-4' },
    ],
    createdDate: '2025-05-10',
    createdByUserId: 'user-therapist-1',
  },

];
