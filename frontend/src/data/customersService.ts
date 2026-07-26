import { customers } from './customers';
import { Customer, CustomerSummary } from '../types/Customer';

export function searchCustomers(query: string): CustomerSummary[] {
  if (!query.trim()) return [];
  if (query.length > 100) return [];
  const q = query.toLowerCase();
  return customers.filter(c =>
    c.fullName.toLowerCase().includes(q) ||
    c.phone.includes(q)
  );
}

// stub — implemented in Phase 4
export function createCustomer(_data: Omit<Customer, 'id' | 'createdDate'>): Customer {
  throw new Error('createCustomer: not implemented in Phase 1');
}
