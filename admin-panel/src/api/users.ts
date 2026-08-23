import { apiClient } from './client';
import type { AdminUser, UserWritePayload } from './types';

export async function fetchUserList() {
  const { data } = await apiClient.get<AdminUser[]>('/users/');
  return data;
}

export async function fetchUser(id: number) {
  const { data } = await apiClient.get<AdminUser>(`/users/${id}/`);
  return data;
}

export async function createUser(payload: UserWritePayload) {
  const { data } = await apiClient.post<AdminUser>('/users/', payload);
  return data;
}

export async function updateUser(id: number, payload: Partial<UserWritePayload>) {
  const { data } = await apiClient.patch<AdminUser>(`/users/${id}/`, payload);
  return data;
}

// The backend never hard-deletes — this deactivates the login and
// un-publishes the linked journalist profile, then returns 204.
export async function deactivateUser(id: number) {
  await apiClient.delete(`/users/${id}/`);
}
