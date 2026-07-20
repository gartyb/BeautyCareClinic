import { describe, it, expect, vi } from 'vitest';
import { therapistUnavailableDatesApi } from './therapistUnavailableDatesApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('therapistUnavailableDatesApi (Phase 012, RC-1)', () => {
  it('list calls GET /therapists/{userId}/unavailable-dates', () => {
    therapistUnavailableDatesApi.list('user-1');
    expect(apiClient.get).toHaveBeenCalledWith('/therapists/user-1/unavailable-dates');
  });

  it('add calls POST /therapists/{userId}/unavailable-dates with date', () => {
    therapistUnavailableDatesApi.add('user-1', '2026-08-01');
    expect(apiClient.post).toHaveBeenCalledWith('/therapists/user-1/unavailable-dates', { date: '2026-08-01' });
  });

  it('remove calls DELETE /therapists/{userId}/unavailable-dates/{date}', () => {
    therapistUnavailableDatesApi.remove('user-1', '2026-08-01');
    expect(apiClient.delete).toHaveBeenCalledWith('/therapists/user-1/unavailable-dates/2026-08-01');
  });
});
