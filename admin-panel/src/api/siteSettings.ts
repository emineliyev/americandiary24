import { apiClient } from './client';
import type { SiteSettings } from './types';

export async function fetchSiteSettings() {
  const { data } = await apiClient.get<SiteSettings>('/site-settings/');
  return data;
}

export async function updateSiteSettings(payload: Partial<SiteSettings>) {
  const { data } = await apiClient.patch<SiteSettings>('/site-settings/', payload);
  return data;
}
