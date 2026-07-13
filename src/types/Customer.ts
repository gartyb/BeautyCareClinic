export interface CustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface Customer extends CustomerSummary {
  createdDate: string; // ISO date
}
