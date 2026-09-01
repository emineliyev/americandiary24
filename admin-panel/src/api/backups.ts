import { apiClient } from './client';
import type { Backup } from './types';

export async function fetchBackups() {
  const { data } = await apiClient.get<Backup[]>('/backups/');
  return data;
}

export async function createBackup() {
  await apiClient.post('/backups/');
}

export async function deleteBackup(filename: string) {
  await apiClient.delete(`/backups/${filename}/`);
}

export async function downloadBackup(filename: string) {
  const { data } = await apiClient.get(`/backups/${filename}/`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
