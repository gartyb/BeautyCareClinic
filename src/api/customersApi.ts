import { apiClient } from './apiClient';

export interface CustomerDto {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export interface CreateCustomerRequest {
  fullName: string;
  phone: string;
  email?: string;
}

export interface UpdateCustomerRequest {
  fullName: string;
  phone: string;
  email?: string;
}

export function getCustomers(search?: string): Promise<CustomerDto[]> {
  const path = search ? `/customers?search=${encodeURIComponent(search)}` : '/customers';
  return apiClient.get<CustomerDto[]>(path);
}

export function getCustomer(id: string): Promise<CustomerDto> {
  return apiClient.get<CustomerDto>(`/customers/${id}`);
}

export function createCustomer(data: CreateCustomerRequest): Promise<CustomerDto> {
  return apiClient.post<CustomerDto>('/customers', data);
}

export function updateCustomer(id: string, data: UpdateCustomerRequest): Promise<CustomerDto> {
  return apiClient.put<CustomerDto>(`/customers/${id}`, data);
}

export function deleteCustomer(id: string): Promise<void> {
  return apiClient.delete<void>(`/customers/${id}`);
}
