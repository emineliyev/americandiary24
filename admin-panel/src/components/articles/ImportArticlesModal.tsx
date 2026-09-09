import { useState } from 'react';
import { importArticlesApply, importArticlesPreview } from '../../api/articles';
import { useToast, errorMessage } from '../toast/ToastContext';
import type { ArticleImportApplyResult, ArticleImportPreviewRow } from '../../api/types';
import '../confirm/confirm.css';

export function ImportArticlesModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ArticleImportPreviewRow[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<ArticleImportApplyResult[] | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setPreview(null);
    setResults(null);
    try {
      const rows = await importArticlesPreview(file);
      setPreview(rows);
      // Pre-check every row that parsed cleanly — errored rows start unchecked.
      setChecked(new Set(rows.map((r, i) => (r.error ? -1 : i)).filter((i) => i >= 0)));
    } catch (err: any) {
      toast.error(errorMessage(err, 'Could not read that file.'));
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  async function handleApply() {
    if (!preview) return;
    const items = preview
      .filter((_, i) => checked.has(i))
      .map((r) => ({
        id: r.id!, new_title: r.new_title!, new_dek: r.new_dek ?? '', new_body: r.new_body!, updated_at: r.updated_at,
      }));
    if (items.length === 0) return;
    setApplying(true);
    try {
      const res = await importArticlesApply(items);
      setResults(res);
      if (res.every((r) => r.success)) {
        toast.success(`${res.length} article(s) updated.`);
        onImported();
      } else {
        toast.error('Some articles could not be updated — see details below.');
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'Import failed.'));
    } finally {
      setApplying(false);
    }
  }

  const checkedCount = checked.size;

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" style={{ width: 820 }} onClick={(e) => e.stopPropagation()}>
        <h2>Import Articles</h2>
        <p>
          Upload a .html file (one article) or a .zip (several) exported from this list. Only the title,
          dek and body are changed — everything else about the article stays as-is, including its URL.
        </p>

        {!preview && (
          <input
            type="file"
            accept=".html,.zip"
            disabled={loading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        )}
        {loading && <p style={{ marginTop: 12 }}>Reading file…</p>}

        {preview && !results && (
          <>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th></th>
                  <th>File</th>
                  <th>Title</th>
                  <th>Dek</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    <td>
                      {!row.error && (
                        <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.filename}</td>
                    <td colSpan={row.error ? 2 : 1}>
                      {row.error ? (
                        <span style={{ color: 'var(--error)' }}>{row.error}</span>
                      ) : row.old_title === row.new_title ? (
                        <span>{row.new_title} <em style={{ color: 'var(--text-muted)' }}>(no title change)</em></span>
                      ) : (
                        <span>{row.old_title} → <strong>{row.new_title}</strong></span>
                      )}
                    </td>
                    {!row.error && (
                      <td style={{ fontSize: 12 }}>
                        {row.old_dek === row.new_dek ? (
                          <em style={{ color: 'var(--text-muted)' }}>(no change)</em>
                        ) : (
                          <span>{row.old_dek || <em>(empty)</em>} → <strong>{row.new_dek || '(empty)'}</strong></span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="confirm-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={checkedCount === 0 || applying}
                onClick={handleApply}
              >
                {applying ? 'Applying…' : `Apply Selected (${checkedCount})`}
              </button>
            </div>
          </>
        )}

        {results && (
          <>
            <ul style={{ marginTop: 16, paddingLeft: 20 }}>
              {results.map((r) => (
                <li key={r.id} style={{ color: r.success ? 'var(--brand)' : 'var(--error)' }}>
                  Article #{r.id}: {r.success ? 'updated' : r.error}
                </li>
              ))}
            </ul>
            <div className="confirm-actions" style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
