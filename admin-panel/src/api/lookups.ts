import { apiClient } from './client';
import type { Author, Category, DashboardStats, Paginated, Tag } from './types';

export async function fetchCategories() {
  const { data } = await apiClient.get<Category[]>('/categories/');
  return data;
}

export async function fetchAuthors() {
  const { data } = await apiClient.get<Author[]>('/authors/');
  return data;
}

export async function searchTags(query: string) {
  const { data } = await apiClient.get<Paginated<Tag>>('/tags/', { params: { search: query } });
  return data.results;
}

export async function fetchDashboardStats() {
  const { data } = await apiClient.get<DashboardStats>('/dashboard/');
  return data;
}
