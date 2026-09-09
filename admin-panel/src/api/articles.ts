import { apiClient } from './client';
import type {
  Article, ArticleImportApplyResult, ArticleImportPreviewRow, ArticleListItem, ArticleWritePayload, Paginated,
} from './types';

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

// Downloads a .html file (single article) or .zip (several) for offline
// editing — filename carries the article ID, which import_preview/apply
// use to target the same article on the way back in.
export async function exportArticles(ids: number[]) {
  const resp = await apiClient.post('/articles/bulk_export/', { ids }, { responseType: 'blob' });
  const disposition = resp.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="([^"]+)"/);
  const filename = match?.[1] || 'articles-export.html';
  const url = window.URL.createObjectURL(resp.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// Step 1 of import — parses the upload, makes no database writes.
export async function importArticlesPreview(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ArticleImportPreviewRow[]>('/articles/import_preview/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Step 2 — applies whichever preview rows the admin kept checked.
export async function importArticlesApply(
  items: { id: number; new_title: string; new_dek: string; new_body: string; updated_at?: string }[],
) {
  const { data } = await apiClient.post<ArticleImportApplyResult[]>('/articles/import_apply/', { items });
  return data;
}

