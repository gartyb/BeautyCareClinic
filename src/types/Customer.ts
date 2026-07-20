export interface CustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  activeSeriesCount: number;
  // See types/Order.ts money-field convention: parse with parseFloat(String(...)) before use.
  // null means the customer has no orders at all (never bought anything); 0 means the customer
  // has orders that are all fully paid off.
  outstandingBalance: string | number | null;
}

export interface Customer extends CustomerSummary {
  createdDate: string; // ISO date
}
