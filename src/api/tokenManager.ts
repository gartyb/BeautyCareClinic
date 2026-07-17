const TOKEN_KEY = 'authToken';
const EXPIRES_KEY = 'authTokenExpiresAt';

export function setToken(token: string, expiresInSeconds: number): void {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

export function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && isExpired()) {
    clearToken();
    return null;
  }
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export function isExpired(): boolean {
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!expiresAt) return true;
  return Number(expiresAt) < Date.now();
}
