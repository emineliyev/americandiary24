import { apiClient } from './client';
import type { ContactMessage } from './types';

export async function fetchContactMessageList() {
  const { data } = await apiClient.get<ContactMessage[]>('/contact-messages/');
  return data;
}

export async function fetchContactMessage(id: number) {
  const { data } = await apiClient.get<ContactMessage>(`/contact-messages/${id}/`);
  return data;
}

export async function markContactMessageRead(id: number, isRead: boolean) {
  const { data } = await apiClient.patch<ContactMessage>(`/contact-messages/${id}/`, { is_read: isRead });
  return data;
}

export async function deleteContactMessage(id: number) {
  await apiClient.delete(`/contact-messages/${id}/`);
}
