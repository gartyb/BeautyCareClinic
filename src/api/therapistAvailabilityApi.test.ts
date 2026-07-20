import { describe, it, expect, vi } from 'vitest';
import { therapistAvailabilityApi } from './therapistAvailabilityApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('therapistAvailabilityApi', () => {
  it('get calls GET /therapists/availability (read-only, no write endpoints — Q4 stays deferred)', () => {
    therapistAvailabilityApi.get();
    expect(apiClient.get).toHaveBeenCalledWith('/therapists/availability');
  });

  it('getTherapists calls GET /therapists (bugfix: narrow, non-Manager-gated therapist picker source)', () => {
    therapistAvailabilityApi.getTherapists();
    expect(apiClient.get).toHaveBeenCalledWith('/therapists');
  });
});
