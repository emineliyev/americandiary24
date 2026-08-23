import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFolder, deleteAsset, deleteFolder, fetchAssets, fetchFolders,
  moveAsset, renameAsset, renameFolder, uploadAsset, MediaAssetInUseError,
} from '../../api/media';
import { Pagination } from '../../components/Pagination';
import { CropStep } from '../../components/CropStep';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';
import type { MediaAsset, MediaFolder, MediaFormat } from '../../api/types';
import { MEDIA_MIN_LONG_EDGE } from '../../utils/imageSizes';
import './MediaListPage.css';

const FORMATS: MediaFormat[] = ['jpeg', 'png', 'webp', 'svg'];
const FORMAT_LABELS: Record<MediaFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', svg: 'SVG' };
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function MediaListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [format, setFormat] = useState<MediaFormat | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [page, setPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [menuMode, setMenuMode] = useState<'main' | 'move'>('main');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<number | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const cropResolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  useEffect(() => { setPage(1); }, [selectedFolder, format, search]);

  const { data: folders } = useQuery({ queryKey: ['media-folders'], queryFn: fetchFolders });
  const { data: totalData } = useQuery({ queryKey: ['media-assets-total'], queryFn: () => fetchAssets({}) });
  const { data, isLoading } = useQuery({
    queryKey: ['media-assets', page, selectedFolder, format, search],
    queryFn: () => fetchAssets({
      page,
      folder: selectedFolder ?? undefined,
      format: format || undefined,
      search: search || undefined,
    }),
  });

  useEffect(() => {
    function closeOnOutsideClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.media-card-menu, .media-card-menu-btn')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    queryClient.invalidateQueries({ queryKey: ['media-assets-total'] });
    queryClient.invalidateQueries({ queryKey: ['media-folders'] });
  }

  // Asks the user to crop one picked file, resolving with the cropped blob
  // (or null if they cancel) — awaited from the sequential queue below so
  // each file gets its own crop step, one at a time, instead of uploading
  // whatever was picked/dropped as-is.
  function askToCrop(file: File): Promise<Blob | null> {
    return new Promise((resolve) => {
      cropResolveRef.current = resolve;
      setCropSrc(URL.createObjectURL(file));
    });
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    let succeeded = 0;
    let failed = 0;
    for (const file of list) {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`"${file.name}" is larger than 15MB and was skipped.`);
        failed++;
        continue;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" isn't a supported format (JPG/PNG/WebP/SVG).`);
        failed++;
        continue;
      }
      try {
        // SVG is a vector format — cropping it via canvas would rasterize
        // it, throwing away the whole point of keeping it scalable, so it
        // skips straight to upload like everything already did before.
        if (file.type === 'image/svg+xml') {
          await uploadAsset(file, selectedFolder);
          succeeded++;
          continue;
        }
        const cropped = await askToCrop(file);
        if (!cropped) continue; // user cancelled this one — skip, keep going
        await uploadAsset(new File([cropped], file.name, { type: cropped.type }), selectedFolder);
        succeeded++;
      } catch (err: any) {
        toast.error(errorMessage(err, `Failed to upload "${file.name}".`));
        failed++;
      }
    }
    if (succeeded) {
      toast.success(succeeded === 1 ? 'File uploaded.' : `${succeeded} files uploaded.`);
      invalidateAll();
    }
    if (!succeeded && !failed) return;
  }

  function handleCropConfirm(blob: Blob) {
    cropResolveRef.current?.(blob);
    cropResolveRef.current = null;
    setCropSrc(null);
  }

  function handleCropCancel() {
    cropResolveRef.current?.(null);
    cropResolveRef.current = null;
    setCropSrc(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim());
      toast.success('Folder created.');
      setNewFolderName('');
      setAddingFolder(false);
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to create the folder.'));
    }
  }

  function startFolderRename(folder: MediaFolder) {
    setRenamingFolderId(folder.id);
    setRenameFolderValue(folder.name);
  }

  async function submitFolderRename(folder: MediaFolder) {
    const name = renameFolderValue.trim();
    setRenamingFolderId(null);
    if (!name || name === folder.name) return;
    try {
      await renameFolder(folder.id, name);
      queryClient.invalidateQueries({ queryKey: ['media-folders'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to rename the folder.'));
    }
  }

  async function handleDeleteFolder(folder: MediaFolder) {
    const ok = await confirm({
      message: `Delete folder "${folder.name}"? Its files won't be deleted — they'll just become unfiled.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteFolder(folder.id);
      if (selectedFolder === folder.id) setSelectedFolder(null);
      toast.success(`Folder "${folder.name}" deleted.`);
      invalidateAll();
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete the folder.'));
    }
  }

  async function handleCopyUrl(asset: MediaAsset) {
    await navigator.clipboard.writeText(asset.file);
    toast.success('URL copied to clipboard.');
    setOpenMenuId(null);
  }

  function startRename(asset: MediaAsset) {
    setRenamingId(asset.id);
    setRenameValue(asset.original_filename);
    setOpenMenuId(null);
  }

  async function submitRename(asset: MediaAsset) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === asset.original_filename) return;
    try {
      await renameAsset(asset.id, name);
      queryClient.invalidateQueries({ queryKey: ['media-assets'] });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to rename the file.'));
    }
  }

  async function handleMove(asset: MediaAsset, folderId: number | null) {
    try {
      await moveAsset(asset.id, folderId);
      toast.success('File moved.');
      invalidateAll();
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to move the file.'));
    } finally {
      setOpenMenuId(null);
      setMenuMode('main');
    }
  }

  async function handleDelete(asset: MediaAsset, force = false) {
    try {
      await deleteAsset(asset.id, force);
      toast.success(`"${asset.original_filename}" deleted.`);
      invalidateAll();
    } catch (err: any) {
      if (err instanceof MediaAssetInUseError) {
        const ok = await confirm({
          message: `This image appears in ${err.inUseCount} article body(ies). Deleting it will leave a broken image there. Delete anyway?`,
          confirmLabel: 'Delete anyway',
          danger: true,
        });
        if (ok) await handleDelete(asset, true);
        return;
      }
      toast.error(errorMessage(err, 'Failed to delete the file.'));
    } finally {
      setOpenMenuId(null);
    }
  }

  async function handleDeleteClick(asset: MediaAsset) {
    setOpenMenuId(null);
    const ok = await confirm({
      message: `Delete "${asset.original_filename}"? This can't be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) await handleDelete(asset);
  }

  const totalCount = totalData?.count ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Media Library</h1>
      </div>

      {cropSrc && (
        <div className="media-crop-overlay">
          <div className="media-crop-dialog">
            <CropStep imageSrc={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
          </div>
        </div>
      )}

      <div className="media-page">
        <div className="media-sidebar">
          <h2>Folders</h2>
          <div className="media-folder-list">
            <div
              className={`media-folder-row ${selectedFolder === null ? 'is-active' : ''}`}
              onClick={() => setSelectedFolder(null)}
            >
              <span>All files</span>
              <span className="count">{totalCount}</span>
            </div>
            {folders?.map((folder) => (
              <div
                key={folder.id}
                className={`media-folder-row ${selectedFolder === folder.id ? 'is-active' : ''}`}
                onClick={() => renamingFolderId !== folder.id && setSelectedFolder(folder.id)}
              >
                {renamingFolderId === folder.id ? (
                  <input
                    type="text"
                    className="media-folder-rename-input"
                    autoFocus
                    value={renameFolderValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameFolderValue(e.target.value)}
                    onBlur={() => submitFolderRename(folder)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitFolderRename(folder);
                      if (e.key === 'Escape') setRenamingFolderId(null);
                    }}
                  />
                ) : (
                  <span>{folder.name}</span>
                )}
                <span className="count">{folder.asset_count}</span>
                <button
                  type="button"
                  title="Rename folder"
                  onClick={(e) => { e.stopPropagation(); startFolderRename(folder); }}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  title="Delete folder"
                  onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {addingFolder ? (
            <form className="media-new-folder-form" onSubmit={handleCreateFolder}>
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => { if (!newFolderName.trim()) setAddingFolder(false); }}
                placeholder="Folder name"
              />
              <button type="submit" className="btn btn-primary" style={{ height: 32, padding: '0 10px' }}>Add</button>
            </form>
          ) : (
            <button type="button" className="media-new-folder-btn" onClick={() => setAddingFolder(true)}>+ New folder</button>
          )}
        </div>

        <div className="media-main">
          <div
            className={`media-dropzone ${isDragging ? 'is-dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="media-dropzone-left">
              <div className="media-dropzone-icon">↑</div>
              <div className="media-dropzone-text">
                <strong>Drag files here, or select them</strong>
                <span>JPG, PNG, WebP, SVG · max 15MB · JPEG/PNG auto-converted to WebP · recommended at least {MEDIA_MIN_LONG_EDGE}px on the longest side (article body images display up to ~880px wide)</span>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>Choose File</button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
            />
          </div>

          <div className="media-toolbar">
            <input
              type="text"
              className="media-search"
              placeholder="Search by filename…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <div className="media-format-pills">
              <button type="button" className={`media-format-pill ${format === '' ? 'is-active' : ''}`} onClick={() => setFormat('')}>All</button>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`media-format-pill ${format === f ? 'is-active' : ''}`}
                  onClick={() => setFormat(f)}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {isLoading || !data ? <p>Loading…</p> : data.results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No files here yet.</p>
          ) : (
            <>
              <div className="media-grid">
                {data.results.map((asset) => (
                  <div key={asset.id} className="media-card">
                    <div className="media-card-thumb">
                      <img src={asset.file} alt={asset.original_filename} loading="lazy" />
                      <span className={`media-badge format-${asset.format}`}>{FORMAT_LABELS[asset.format]}</span>
                    </div>
                    {/* Deliberately a sibling of .media-card-thumb, not nested inside it —
                        that container clips overflow for the image crop, which was also
                        clipping this dropdown whenever it grew taller than the thumbnail. */}
                    <button
                      type="button"
                      className="media-card-menu-btn"
                      onClick={() => {
                        setMenuMode('main');
                        setOpenMenuId(openMenuId === asset.id ? null : asset.id);
                      }}
                    >
                      ⋯
                    </button>
                    {openMenuId === asset.id && (
                      <div className="media-card-menu">
                        {menuMode === 'main' ? (
                          <>
                            <button type="button" onClick={() => handleCopyUrl(asset)}>Copy URL</button>
                            <button type="button" onClick={() => startRename(asset)}>Rename</button>
                            <button type="button" onClick={() => setMenuMode('move')}>Move to folder…</button>
                            <a
                              href={asset.file}
                              download={asset.original_filename}
                              style={{ display: 'block', padding: '9px 12px', fontSize: 12, color: 'var(--text)' }}
                            >
                              Download
                            </a>
                            <button type="button" className="danger" onClick={() => handleDeleteClick(asset)}>Delete</button>
                          </>
                        ) : (
                          <div className="media-submenu">
                            <button type="button" onClick={() => handleMove(asset, null)}>Unfiled</button>
                            {folders?.map((folder) => (
                              <button key={folder.id} type="button" onClick={() => handleMove(asset, folder.id)}>
                                {folder.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="media-card-body">
                      {renamingId === asset.id ? (
                        <div className="media-card-rename">
                          <input
                            type="text"
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitRename(asset); if (e.key === 'Escape') setRenamingId(null); }}
                          />
                          <button type="button" className="btn btn-primary" onClick={() => submitRename(asset)}>Save</button>
                        </div>
                      ) : (
                        <p className="media-card-filename" title={asset.original_filename}>{asset.original_filename}</p>
                      )}
                      <p className="media-card-meta">
                        {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}{formatSize(asset.size_bytes)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} count={data.count} hasPrevious={!!data.previous} hasNext={!!data.next} onChange={setPage} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
