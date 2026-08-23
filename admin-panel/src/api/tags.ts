import { apiClient } from './client';
import type { Paginated, Tag, TagWritePayload } from './types';

export async function fetchTagList(params: { page?: number; search?: string }) {
  const { data } = await apiClient.get<Paginated<Tag>>('/tags/', { params });
  return data;
}

export async function fetchTag(id: number) {
  const { data } = await apiClient.get<Tag>(`/tags/${id}/`);
  return data;
}

export async function createTag(payload: TagWritePayload) {
  const { data } = await apiClient.post<Tag>('/tags/', payload);
  return data;
}

export async function updateTag(id: number, payload: Partial<TagWritePayload>) {
  const { data } = await apiClient.patch<Tag>(`/tags/${id}/`, payload);
  return data;
}

export async function deleteTag(id: number) {
  await apiClient.delete(`/tags/${id}/`);
}
