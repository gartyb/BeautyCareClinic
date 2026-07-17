export interface CustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  email: string;
}

export interface Customer extends CustomerSummary {
  createdDate: string; // ISO date
}
