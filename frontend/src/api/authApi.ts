import { apiClient } from './apiClient';

export interface UserDto {
  id: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: UserDto;
}

export function loginUser(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', { email, password });
}

export function getCurrentUser(): Promise<UserDto> {
  return apiClient.get<UserDto>('/auth/me');
}
