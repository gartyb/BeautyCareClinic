import { apiClient } from './apiClient';

export interface UserApiDto {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
  isActive: boolean;
}

export interface CreateUserApiRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface UpdateUserApiRequest {
  fullName: string;
  email: string;
  phone?: string;
}

/** Phase 012 — `includeInactive` (default false) excludes deactivated users when omitted/false. */
export function getUsers(role?: string, includeInactive = false): Promise<UserApiDto[]> {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (includeInactive) params.set('includeInactive', 'true');
  const query = params.toString();
  return apiClient.get<UserApiDto[]>(query ? `/users?${query}` : '/users');
}

export function getUser(id: string): Promise<UserApiDto> {
  return apiClient.get<UserApiDto>(`/users/${id}`);
}

export function createUser(data: CreateUserApiRequest): Promise<UserApiDto> {
  return apiClient.post<UserApiDto>('/users', data);
}

export function updateUser(id: string, data: UpdateUserApiRequest): Promise<UserApiDto> {
  return apiClient.put<UserApiDto>(`/users/${id}`, data);
}

/** Phase 012 — soft-deactivation (PUT .../deactivate), distinct from deleteUser (hard-delete). */
export function deactivateUser(id: string): Promise<UserApiDto> {
  return apiClient.put<UserApiDto>(`/users/${id}/deactivate`, {});
}

export function deleteUser(id: string): Promise<void> {
  return apiClient.delete<void>(`/users/${id}`);
}
