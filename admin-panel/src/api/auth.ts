import axios from 'axios';
import { apiClient, tokenStorage } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export async function login(username: string, password: string) {
  const { data } = await axios.post(`${API_BASE_URL}/auth/token/`, { username, password });
  tokenStorage.set(data.access, data.refresh);
}

// Self-service — changes the *current* logged-in user's own password.
// Distinct from the Users screen's password field (Administrator-only,
// used to reset someone else's password).
export async function changePassword(currentPassword: string, newPassword: string) {
  await apiClient.post('/auth/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export function logout() {
  tokenStorage.clear();
}

export function isLoggedIn() {
  return Boolean(tokenStorage.getAccess());
}
