import { ApiError, ApiRequestError } from './apiError';
import { getToken } from './tokenManager';

const shouldLog = import.meta.env.VITE_LOG_API_CALLS === 'true';

class ApiClient {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response, url: string): Promise<T> {
    if (shouldLog) {
      console.log(`[API] ${response.status} ${url}`);
    }

    // Do not fire the logout event for login failures — a wrong password is a valid 401
    if (response.status === 401 && !url.endsWith('/auth/login')) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      let apiError: ApiError;
      try {
        const body = await response.json();
        apiError = {
          code: body.code ?? 'UNKNOWN',
          message: body.message ?? response.statusText,
          timestamp: body.timestamp ?? new Date().toISOString(),
          traceId: body.traceId ?? '',
          httpStatus: response.status,
        };
      } catch {
        apiError = {
          code: 'NETWORK_ERROR',
          message: response.statusText || 'Network error',
          timestamp: new Date().toISOString(),
          traceId: '',
          httpStatus: response.status,
        };
      }
      throw new ApiRequestError(apiError);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    if (shouldLog) console.log(`[API] GET ${url}`);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      return this.handleResponse<T>(response, url);
    } catch (e) {
      if (e instanceof ApiRequestError) throw e;
      throw new ApiRequestError({
        code: 'NETWORK_ERROR',
        message: 'שגיאת רשת — בדוק את החיבור',
        timestamp: new Date().toISOString(),
        traceId: '',
        httpStatus: 0,
      });
    }
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    if (shouldLog) console.log(`[API] POST ${url}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, url);
    } catch (e) {
      if (e instanceof ApiRequestError) throw e;
      throw new ApiRequestError({
        code: 'NETWORK_ERROR',
        message: 'שגיאת רשת — בדוק את החיבור',
        timestamp: new Date().toISOString(),
        traceId: '',
        httpStatus: 0,
      });
    }
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    if (shouldLog) console.log(`[API] PUT ${url}`);
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });
      return this.handleResponse<T>(response, url);
    } catch (e) {
      if (e instanceof ApiRequestError) throw e;
      throw new ApiRequestError({
        code: 'NETWORK_ERROR',
        message: 'שגיאת רשת — בדוק את החיבור',
        timestamp: new Date().toISOString(),
        traceId: '',
        httpStatus: 0,
      });
    }
  }

  async delete<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    if (shouldLog) console.log(`[API] DELETE ${url}`);
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(),
      });
      return this.handleResponse<T>(response, url);
    } catch (e) {
      if (e instanceof ApiRequestError) throw e;
      throw new ApiRequestError({
        code: 'NETWORK_ERROR',
        message: 'שגיאת רשת — בדוק את החיבור',
        timestamp: new Date().toISOString(),
        traceId: '',
        httpStatus: 0,
      });
    }
  }
}

export const apiClient = new ApiClient();
