import { apiClient } from './client';

export interface CurrentUser {
  username: string;
  role: string;
  author_id: number | null;
  author_name: string | null;
  author_avatar: string | null;
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get<CurrentUser>('/auth/me/');
  return data;
}
