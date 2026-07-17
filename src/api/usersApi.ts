import { apiClient } from './apiClient';

export interface UserApiDto {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
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

export function getUsers(role?: string): Promise<UserApiDto[]> {
  const path = role ? `/users?role=${encodeURIComponent(role)}` : '/users';
  return apiClient.get<UserApiDto[]>(path);
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

export function deleteUser(id: string): Promise<void> {
  return apiClient.delete<void>(`/users/${id}`);
}
