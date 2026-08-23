import { apiClient } from './client';
import type { MediaAsset, MediaFolder, MediaFormat, Paginated } from './types';

export async function fetchFolders() {
  const { data } = await apiClient.get<MediaFolder[]>('/media-folders/');
  return data;
}

export async function createFolder(name: string) {
  const { data } = await apiClient.post<MediaFolder>('/media-folders/', { name });
  return data;
}

export async function renameFolder(id: number, name: string) {
  const { data } = await apiClient.patch<MediaFolder>(`/media-folders/${id}/`, { name });
  return data;
}

export async function deleteFolder(id: number) {
  await apiClient.delete(`/media-folders/${id}/`);
}

export async function fetchAssets(params: {
  page?: number;
  folder?: number;
  format?: MediaFormat;
  search?: string;
}) {
  // Sent as `file_format` on the wire — `format` is DRF's own reserved
  // query param for content-negotiation, so filtering under that name
  // 404s instead of filtering (see api/views.py's MediaAssetFilter).
  const { format, ...rest } = params;
  const { data } = await apiClient.get<Paginated<MediaAsset>>('/media/', {
    params: { ...rest, file_format: format },
  });
  return data;
}

export async function uploadAsset(file: File, folderId?: number | null) {
  const form = new FormData();
  form.append('file', file);
  if (folderId) form.append('folder', String(folderId));
  const { data } = await apiClient.post<MediaAsset>('/media/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function renameAsset(id: number, original_filename: string) {
  const { data } = await apiClient.patch<MediaAsset>(`/media/${id}/`, { original_filename });
  return data;
}

export async function moveAsset(id: number, folderId: number | null) {
  const { data } = await apiClient.patch<MediaAsset>(`/media/${id}/`, { folder: folderId });
  return data;
}

/** Thrown with `.inUseCount` when the backend's best-effort in-body scan
 * (see MediaAssetViewSet.destroy) finds the asset still referenced in one
 * or more article bodies — callers should confirm with the user, then retry
 * with `force: true` to delete anyway. */
export class MediaAssetInUseError extends Error {
  inUseCount: number;
  constructor(inUseCount: number) {
    super(`Used in ${inUseCount} article body(ies).`);
    this.inUseCount = inUseCount;
  }
}

export async function deleteAsset(id: number, force = false) {
  try {
    await apiClient.delete(`/media/${id}/`, { params: force ? { force: 'true' } : undefined });
  } catch (err: any) {
    if (err?.response?.status === 409) {
      throw new MediaAssetInUseError(err.response.data?.in_use_count ?? 0);
    }
    throw err;
  }
}
