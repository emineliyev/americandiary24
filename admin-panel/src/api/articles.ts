import { apiClient } from './client';
import type { Article, ArticleListItem, ArticleWritePayload, Paginated } from './types';

export async function fetchArticles(params: {
  page?: number;
  status?: string;
  category?: number;
  search?: string;
  deleted?: boolean;
}) {
  const { data } = await apiClient.get<Paginated<ArticleListItem>>('/articles/', { params });
  return data;
}

export async function fetchArticle(id: number) {
  const { data } = await apiClient.get<Article>(`/articles/${id}/`);
  return data;
}

export async function createArticle(payload: Partial<ArticleWritePayload>) {
  const { data } = await apiClient.post<Article>('/articles/', payload);
  return data;
}

export async function updateArticle(id: number, payload: Partial<ArticleWritePayload>) {
  const { data } = await apiClient.patch<Article>(`/articles/${id}/`, payload);
  return data;
}

export async function archiveArticle(id: number) {
  const { data } = await apiClient.patch<Article>(`/articles/${id}/`, { status: 'archived' });
  return data;
}

// Soft delete — moves the article to the Silinənlər (trash) tab.
// Administrator/Baş Redaktor only (enforced server-side too).
export async function deleteArticle(id: number) {
  await apiClient.delete(`/articles/${id}/`);
}

export async function restoreArticle(id: number) {
  const { data } = await apiClient.post<Article>(`/articles/${id}/restore/`);
  return data;
}

// Real destroy — only ever called on an already-trashed article. Deletes
// the article's image from disk too (see news/signals.py).
export async function permanentDeleteArticle(id: number) {
  await apiClient.post(`/articles/${id}/permanent_delete/`);
}

export async function duplicateArticle(id: number) {
  const { data } = await apiClient.post<Article>(`/articles/${id}/duplicate/`);
  return data;
}

