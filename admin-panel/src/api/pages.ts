import { apiClient } from './client';
import type { Page, PageWritePayload } from './types';

export async function fetchPageList() {
  const { data } = await apiClient.get<Page[]>('/pages/');
  return data;
}

export async function fetchPage(id: number) {
  const { data } = await apiClient.get<Page>(`/pages/${id}/`);
  return data;
}

export async function updatePage(id: number, payload: Partial<PageWritePayload>) {
  const { data } = await apiClient.patch<Page>(`/pages/${id}/`, payload);
  return data;
}
