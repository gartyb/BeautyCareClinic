import { describe, it, expect, vi } from 'vitest';
import { therapistWorkingHoursApi } from './therapistWorkingHoursApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('therapistWorkingHoursApi (Phase 012, RC-1)', () => {
  it('list calls GET /therapists/{userId}/working-hours', () => {
    therapistWorkingHoursApi.list('user-1');
    expect(apiClient.get).toHaveBeenCalledWith('/therapists/user-1/working-hours');
  });

  it('upsert calls PUT /therapists/{userId}/working-hours/{weekday} with startTime/endTime', () => {
    therapistWorkingHoursApi.upsert('user-1', 2, { startTime: '09:00', endTime: '17:00' });
    expect(apiClient.put).toHaveBeenCalledWith('/therapists/user-1/working-hours/2', { startTime: '09:00', endTime: '17:00' });
  });

  it('upsert supports null start/end (day off)', () => {
    therapistWorkingHoursApi.upsert('user-1', 5, { startTime: null, endTime: null });
    expect(apiClient.put).toHaveBeenCalledWith('/therapists/user-1/working-hours/5', { startTime: null, endTime: null });
  });

  it('remove calls DELETE /therapists/{userId}/working-hours/{weekday}', () => {
    therapistWorkingHoursApi.remove('user-1', 3);
    expect(apiClient.delete).toHaveBeenCalledWith('/therapists/user-1/working-hours/3');
  });
});
