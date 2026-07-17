import { apiClient } from './apiClient';

export interface GlobalSettingDto {
  name: string;
  value: string;
}

export function getSettings(): Promise<GlobalSettingDto[]> {
  return apiClient.get<GlobalSettingDto[]>('/global-settings');
}

export function updateSetting(key: string, value: string): Promise<GlobalSettingDto[]> {
  // Returns array from server (batch endpoint); CR-025 type note: callers use first item only.
  return apiClient.put<GlobalSettingDto[]>('/global-settings', [{ name: key, value }]);
}
