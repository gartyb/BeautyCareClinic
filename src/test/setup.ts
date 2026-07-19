import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { clearToken } from '../api/tokenManager';

// Default mock responses for the API endpoints used in tests.
// These correspond to the same seed data that was previously in the mock data files,
// so existing tests continue working after the API wiring.
const MOCK_CUSTOMERS = [
  { id: 'cust-1', fullName: 'רחל אברהם', phone: '0501234567', email: 'rachel.avraham@gmail.com', createdAt: '2024-01-15' },
  { id: 'cust-2', fullName: 'דנה שפירא',  phone: '0529876543', email: 'dana.shapira@gmail.com',  createdAt: '2024-03-10' },
  { id: 'cust-3', fullName: 'אסתר מזרחי', phone: '0545551234', email: 'esther.mizrahi@gmail.com', createdAt: '2023-09-20' },
  { id: 'cust-4', fullName: 'יעל גולן',   phone: '0587778899', email: 'yael.golan@gmail.com',   createdAt: '2025-11-01' },
  { id: 'cust-5', fullName: 'נועה ברק',   phone: '0503334455', email: 'noa.barak@gmail.com',    createdAt: '2024-06-18' },
];

const MOCK_TREATMENT_TYPES = [
  { id: 'tt-1', name: 'פנים',  defaultDurationMinutes: 60 },
  { id: 'tt-2', name: 'לייזר', defaultDurationMinutes: 30 },
  { id: 'tt-3', name: 'עיסוי', defaultDurationMinutes: 60 },
];

const MOCK_SETTINGS = [
  { name: 'default_max_payment_count', value: '3'  },
  { name: 'calendar_start_hour',       value: '8'  },
  { name: 'calendar_end_hour',         value: '20' },
];

const MOCK_ME_RESPONSE = {
  id: 'user-test-1',
  fullName: 'מנהלת מבחן',
  email: 'test@clinic.local',
  role: 'Manager',
};

const MOCK_LOGIN_RESPONSE = {
  accessToken: 'test-token',
  expiresIn: 3600,
  user: MOCK_ME_RESPONSE,
};

function buildResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

// Mock global fetch for tests
vi.stubGlobal(
  'fetch',
  vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes('/auth/login'))     return buildResponse(MOCK_LOGIN_RESPONSE);
    if (u.includes('/auth/me'))        return buildResponse(MOCK_ME_RESPONSE);
    if (u.includes('/customers'))      return buildResponse(MOCK_CUSTOMERS);
    if (u.includes('/treatment-types')) return buildResponse(MOCK_TREATMENT_TYPES);
    if (u.includes('/global-settings')) return buildResponse(MOCK_SETTINGS);
    if (u.includes('/users'))          return buildResponse([]);
    // Default fallback: 404
    return buildResponse({ code: 'NOT_FOUND', message: 'Not found' }, 404);
  })
);

// Prevent auth tokens seeded by one test (e.g. renderWithProviders) from bleeding into the next.
afterEach(() => {
  clearToken();
});
