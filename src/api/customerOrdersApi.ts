import { apiClient } from './apiClient';
import type { CustomerOrder } from '../types/Order';

export interface CreateOrderRequest {
  discountPercentage: number;
  maxPaymentCount?: number;
  items: { packageTypeId: string }[];
}

export interface UpdateOrderRequest {
  discountPercentage: number;
  maxPaymentCount: number;
}

export const customerOrdersApi = {
  listByCustomer: (customerId: string) =>
    apiClient.get<CustomerOrder[]>(`/customers/${customerId}/orders`),
  getById: (id: string) =>
    apiClient.get<CustomerOrder>(`/orders/${id}`),
  create: (customerId: string, data: CreateOrderRequest) =>
    apiClient.post<CustomerOrder>(`/customers/${customerId}/orders`, data),
  update: (id: string, data: UpdateOrderRequest) =>
    apiClient.put<CustomerOrder>(`/orders/${id}`, data),
  delete: (id: string) =>
    apiClient.delete<void>(`/orders/${id}`),
};
