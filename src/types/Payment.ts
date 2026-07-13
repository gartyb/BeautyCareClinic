export interface Payment {
  id: string;
  customerOrderId: string;
  amount: string; // decimal as string
  method: 'Cash' | 'Credit Card' | 'Bank Transfer' | 'Other';
  paymentDate: string;
  createdDate: string;
  createdByUserId: string;
}
