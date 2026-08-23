import type { Editor, FileLoader, UploadAdapter, UploadResponse } from 'ckeditor5';
import { apiClient } from '../api/client';

// A custom adapter (not SimpleUploadAdapter) so image uploads go through
// the same `apiClient` axios instance the rest of the admin panel uses —
// its JWT refresh interceptor (api/client.ts) then covers uploads too,
// instead of a static bearer header baked into editor config that would go
// stale on a long editing session (30-minute access token lifetime).
class DjangoUploadAdapter implements UploadAdapter {
  private loader: FileLoader;

  constructor(loader: FileLoader) {
    this.loader = loader;
  }

  async upload(): Promise<UploadResponse> {
    const file = await this.loader.file;
    const form = new FormData();
    form.append('image', file as Blob, (file as File).name);
    const { data } = await apiClient.post<{ url: string }>('/uploads/body-image/', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { default: data.url };
  }

  abort() {
    // Nothing to cancel server-side — axios doesn't expose a handle here,
    // and these uploads are small/fast enough that this is an acceptable gap.
  }
}

export function DjangoUploadAdapterPlugin(editor: Editor) {
  editor.plugins.get('FileRepository').createUploadAdapter = (loader: FileLoader) => new DjangoUploadAdapter(loader);
}
