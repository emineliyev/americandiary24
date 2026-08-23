import { apiClient } from './client';
import type { Author, AuthorWritePayload } from './types';

export async function fetchAuthorList() {
  const { data } = await apiClient.get<Author[]>('/authors/');
  return data;
}

export async function fetchAuthor(id: number) {
  const { data } = await apiClient.get<Author>(`/authors/${id}/`);
  return data;
}

export async function createAuthor(payload: AuthorWritePayload) {
  const { data } = await apiClient.post<Author>('/authors/', payload);
  return data;
}

export async function updateAuthor(id: number, payload: Partial<AuthorWritePayload>) {
  const { data } = await apiClient.patch<Author>(`/authors/${id}/`, payload);
  return data;
}

// No deleteAuthor: the profile is managed as part of its linked User —
// see api/users.ts's deactivateUser, which un-publishes it instead.
