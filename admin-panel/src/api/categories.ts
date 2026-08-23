import { apiClient } from './client';
import type { Category, CategoryWritePayload } from './types';

export async function fetchCategoryList() {
  const { data } = await apiClient.get<Category[]>('/categories/');
  return data;
}

export async function fetchCategory(id: number) {
  const { data } = await apiClient.get<Category>(`/categories/${id}/`);
  return data;
}

export async function createCategory(payload: CategoryWritePayload) {
  const { data } = await apiClient.post<Category>('/categories/', payload);
  return data;
}

export async function updateCategory(id: number, payload: Partial<CategoryWritePayload>) {
  const { data } = await apiClient.patch<Category>(`/categories/${id}/`, payload);
  return data;
}

export async function deleteCategory(id: number) {
  await apiClient.delete(`/categories/${id}/`);
}

// Persists a full drag-and-drop reorder: each category's `order` becomes
// its index in the new sequence. Only categories whose order actually
// changed are sent, so dropping something back where it started is a no-op.
export async function reorderCategories(orderedIds: number[], previousOrders: Map<number, number>) {
  const updates = orderedIds
    .map((id, index) => ({ id, order: index }))
    .filter(({ id, order }) => previousOrders.get(id) !== order);
  await Promise.all(updates.map(({ id, order }) => updateCategory(id, { order })));
}
