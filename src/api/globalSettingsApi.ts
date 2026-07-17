import { apiClient } from './apiClient';

export interface GlobalSettingDto {
  name: string;
  value: string;
}

export function getSettings(): Promise<GlobalSettingDto[]> {
  return apiClient.get<GlobalSettingDto[]>('/global-settings');
}

export function updateSetting(key: string, value: string): Promise<GlobalSettingDto[]> {
  return apiClient.put<GlobalSettingDto[]>('/global-settings', [{ name: key, value }]);
}
