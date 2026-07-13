export type PaymentMethod = 'Cash' | 'Credit Card' | 'Bank Transfer' | 'Other';

export interface OrderItem {
  id: string;
  customerOrderId: string;
  packageTypeId: string;
  treatmentSeriesId?: string;
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  totalPrice: string;      // decimal as string
  amountPaid: string;      // decimal as string
  remainingBalance: string; // decimal as string
  maxPaymentCount: number;
  paymentCount: number;
  orderItems: OrderItem[];
  createdDate: string;
  createdByUserId: string;
}
