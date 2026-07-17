export interface Payment {
  id: string;
  // orderId is the canonical field from the API; customerOrderId is the legacy mock-data alias
  orderId?: string;
  customerOrderId?: string;
  amount: string | number;
  paymentMethod?: string;
  // Legacy mock-data field
  method?: string;
  paymentDate: string;
  recordedByUserId?: string;
  recordedByFullName?: string;
  // Legacy mock-data fields
  createdDate?: string;
  createdByUserId?: string;
}
