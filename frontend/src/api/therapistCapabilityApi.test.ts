import { describe, it, expect, vi } from 'vitest';
import { therapistCapabilityApi } from './therapistCapabilityApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('therapistCapabilityApi (Phase 012, RC-1)', () => {
  it('list calls GET /therapists/{userId}/capabilities', () => {
    therapistCapabilityApi.list('user-1');
    expect(apiClient.get).toHaveBeenCalledWith('/therapists/user-1/capabilities');
  });

  it('add calls POST /therapists/{userId}/capabilities with treatmentTypeId', () => {
    therapistCapabilityApi.add('user-1', 'tt-1');
    expect(apiClient.post).toHaveBeenCalledWith('/therapists/user-1/capabilities', { treatmentTypeId: 'tt-1' });
  });

  it('remove calls DELETE /therapists/{userId}/capabilities/{treatmentTypeId}', () => {
    therapistCapabilityApi.remove('user-1', 'tt-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/therapists/user-1/capabilities/tt-1');
  });
});
