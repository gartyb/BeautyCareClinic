import { describe, it, expect, vi } from 'vitest';
import { appointmentsApi } from './appointmentsApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('appointmentsApi', () => {
  it('listAll calls GET /appointments', () => {
    appointmentsApi.listAll();
    expect(apiClient.get).toHaveBeenCalledWith('/appointments');
  });

  it('listByCustomer calls GET /customers/{customerId}/appointments', () => {
    appointmentsApi.listByCustomer('cust-1');
    expect(apiClient.get).toHaveBeenCalledWith('/customers/cust-1/appointments');
  });

  it('getById calls GET /appointments/{id}', () => {
    appointmentsApi.getById('appt-1');
    expect(apiClient.get).toHaveBeenCalledWith('/appointments/appt-1');
  });

  it('create calls POST /customers/{customerId}/appointments with treatmentTypeId/userId/startTime/endTime', () => {
    const body = { treatmentTypeId: 'tt-1', userId: 'user-1', startTime: '2026-07-20T10:00:00', endTime: '2026-07-20T11:00:00' };
    appointmentsApi.create('cust-1', body);
    expect(apiClient.post).toHaveBeenCalledWith('/customers/cust-1/appointments', body);
  });

  it('update calls PUT /appointments/{id} with userId/startTime/endTime', () => {
    const body = { userId: 'user-2', startTime: '2026-07-21T10:00:00', endTime: '2026-07-21T11:00:00' };
    appointmentsApi.update('appt-1', body);
    expect(apiClient.put).toHaveBeenCalledWith('/appointments/appt-1', body);
  });

  it('cancel calls DELETE /appointments/{id}', () => {
    appointmentsApi.cancel('appt-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/appointments/appt-1');
  });
});
