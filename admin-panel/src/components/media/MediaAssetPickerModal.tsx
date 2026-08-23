import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAssets } from '../../api/media';
import { Pagination } from '../Pagination';
import type { MediaAsset, MediaFormat } from '../../api/types';
import './MediaAssetPickerModal.css';

const FORMATS: MediaFormat[] = ['jpeg', 'png', 'webp', 'svg'];
const FORMAT_LABELS: Record<MediaFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP', svg: 'SVG' };

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function MediaAssetPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput, 300);
  const [format, setFormat] = useState<MediaFormat | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [format, search]);

  const { data, isLoading } = useQuery({
    queryKey: ['media-assets-picker', page, format, search],
    queryFn: () => fetchAssets({ page, format: format || undefined, search: search || undefined }),
  });

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <h2>Choose from Media Library</h2>
          <button type="button" className="picker-close" onClick={onClose}>×</button>
        </div>

        <div className="picker-toolbar">
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

        <div className="picker-body">
          {isLoading || !data ? <p>Loading…</p> : data.results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No files found.</p>
          ) : (
            <div className="picker-grid">
              {data.results.map((asset) => (
                <button key={asset.id} type="button" className="picker-card" onClick={() => onSelect(asset)}>
                  <img src={asset.file} alt={asset.original_filename} loading="lazy" />
                  <span className="picker-card-name" title={asset.original_filename}>{asset.original_filename}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {data && (
          <div className="picker-footer">
            <Pagination page={page} count={data.count} hasPrevious={!!data.previous} hasNext={!!data.next} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
