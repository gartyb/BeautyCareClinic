export type PaymentMethod = 'Cash' | 'Credit Card' | 'Bank Transfer' | 'Other';

export interface OrderItem {
  id: string;
  packageTypeId: string;
  packageTypeName?: string;
  unitPrice?: number;
  seriesId?: string;
  // Stable per-customer package number (CR-031), assigned once at order-creation time.
  // Optional since older/mock data may lack it.
  packageNumber?: number;
  // Legacy field preserved for mock-data compatibility
  treatmentSeriesId?: string;
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  orderDate?: string;
  // New API fields (numeric)
  originalPrice?: number;
  discountedPrice?: number;
  discountPercentage?: number;
  // Financials (string | number: formatted decimal strings in domain layer; number from raw API)
  amountPaid: string | number;
  remainingBalance: string | number;
  maxPaymentCount: number;
  paymentCount: number;
  // Items
  items?: OrderItem[];
  // Legacy fields preserved for mock-data compatibility
  orderItems?: OrderItem[];
  totalPrice?: string | number;
  createdDate?: string;
  createdByUserId?: string;
}
