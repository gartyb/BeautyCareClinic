import { apiClient } from './apiClient';
import type { Payment } from '../types/Payment';

export interface CreatePaymentRequest {
  amount: number;
  paymentMethod: string;
  paymentDate: string;
}

export const paymentsApi = {
  listByOrder: (orderId: string) =>
    apiClient.get<Payment[]>(`/orders/${orderId}/payments`),
  create: (orderId: string, data: CreatePaymentRequest) =>
    apiClient.post<Payment>(`/orders/${orderId}/payments`, data),
};
