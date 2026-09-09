import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteArticle, duplicateArticle, exportArticles, fetchArticles, permanentDeleteArticle, restoreArticle,
} from '../../api/articles';
import { fetchCategories } from '../../api/lookups';
import { Pagination } from '../../components/Pagination';
import { ImportArticlesModal } from '../../components/articles/ImportArticlesModal';
import { useAuth } from '../../auth/AuthContext';
import { canDeleteArticle } from '../../utils/roles';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';
import type { ArticleListItem, ArticleStatus } from '../../api/types';

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ArticleListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canDelete = canDeleteArticle(user?.role);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<'active' | 'trash'>('active');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { setPage(1); }, [tab, status, category, search]);
  useEffect(() => { setSelected(new Set()); }, [tab, page, status, category, search]);

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data, isLoading } = useQuery({
    queryKey: ['articles', tab, page, status, category, search],
    queryFn: () => fetchArticles({
      page,
      deleted: tab === 'trash',
      status: tab === 'active' && status ? status : undefined,
      category: category ? Number(category) : undefined,
      search: search || undefined,
    }),
  });

  useEffect(() => {
    function closeOnOutsideClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.row-menu, .row-menu-btn')) setOpenMenuId(null);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  }

  async function handleDelete(article: ArticleListItem) {
    setOpenMenuId(null);
    const ok = await confirm({
      message: `Move "${article.title}" to Trash? It will be removed from the live site immediately.`,
      confirmLabel: 'Move to Trash',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteArticle(article.id);
      invalidate();
      toast.success(`"${article.title}" moved to Trash.`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete the article.'));
    }
  }

  async function handleDuplicate(article: ArticleListItem) {
    setOpenMenuId(null);
    try {
      const copy = await duplicateArticle(article.id);
      invalidate();
      toast.success(`Duplicated as "${copy.title}".`);
      navigate(`/articles/${copy.id}`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to duplicate the article.'));
    }
  }

  async function handleRestore(article: ArticleListItem) {
    try {
      await restoreArticle(article.id);
      invalidate();
      toast.success(`"${article.title}" restored.`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to restore the article.'));
    }
  }

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    setSelected((prev) => (
      prev.size === data.results.length ? new Set() : new Set(data.results.map((a) => a.id))
    ));
  }

  async function handleExport() {
    setExporting(true);
    try {
      await exportArticles(Array.from(selected));
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to export the selected article(s).'));
    } finally {
      setExporting(false);
    }
  }

  async function handlePermanentDelete(article: ArticleListItem) {
    const ok = await confirm({
      message: `Permanently delete "${article.title}"? This can't be undone — the article and its image will be removed for good.`,
      confirmLabel: 'Delete Forever',
      danger: true,
    });
    if (!ok) return;
    try {
      await permanentDeleteArticle(article.id);
      invalidate();
      toast.success(`"${article.title}" permanently deleted.`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to permanently delete the article.'));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Articles</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'active' && selected.size > 0 && (
            <button type="button" className="btn" disabled={exporting} onClick={handleExport}>
              {exporting ? 'Exporting…' : `Export Selected (${selected.size})`}
            </button>
          )}
          {tab === 'active' && (
            <button type="button" className="btn" onClick={() => setShowImport(true)}>Import</button>
          )}
          <Link to="/articles/new" className="btn btn-primary">+ New Article</Link>
        </div>
      </div>

      <div className="list-filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {tab === 'active' && (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="list-tabs">
        <button type="button" className={tab === 'active' ? 'is-active' : ''} onClick={() => setTab('active')}>Articles</button>
        <button type="button" className={tab === 'trash' ? 'is-active' : ''} onClick={() => setTab('trash')}>🗑 Trash</button>
      </div>

      {isLoading || !data ? <p>Loading…</p> : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                {tab === 'active' && (
                  <th style={{ width: 24 }}>
                    <input
                      type="checkbox"
                      checked={data.results.length > 0 && selected.size === data.results.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th>Title</th>
                <th>Author</th>
                <th>Category</th>
                <th>Status</th>
                {tab === 'trash' && <th>Deleted</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((a) => (
                <tr key={a.id}>
                  {tab === 'active' && (
                    <td>
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSelected(a.id)} />
                    </td>
                  )}
                  <td>
                    {tab === 'active' ? <Link to={`/articles/${a.id}`}>{a.title}</Link> : a.title}
                  </td>
                  <td>{a.author.name}</td>
                  <td>{a.category.name}</td>
                  <td><span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status]}</span></td>
                  {tab === 'trash' && <td>{a.deleted_at ? timeAgo(a.deleted_at) : ''}</td>}
                  <td style={{ position: 'relative', textAlign: 'right' }}>
                    {tab === 'active' ? (
                      <>
                        <button
                          type="button"
                          className="row-menu-btn"
                          onClick={() => setOpenMenuId(openMenuId === a.id ? null : a.id)}
                        >
                          ⋯
                        </button>
                        {openMenuId === a.id && (
                          <div className="row-menu">
                            <Link to={`/articles/${a.id}`} onClick={() => setOpenMenuId(null)}>Edit</Link>
                            <button type="button" onClick={() => handleDuplicate(a)}>Duplicate</button>
                            {canDelete && <button type="button" className="danger" onClick={() => handleDelete(a)}>Delete</button>}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn" onClick={() => handleRestore(a)}>Restore</button>
                        {canDelete && <button className="btn btn-danger" onClick={() => handlePermanentDelete(a)}>Delete Forever</button>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.results.length === 0 && (
            <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
              {tab === 'trash' ? 'Trash is empty.' : 'No articles found.'}
            </p>
          )}

          <Pagination page={page} count={data.count} hasPrevious={!!data.previous} hasNext={!!data.next} onChange={setPage} />
        </>
      )}

      {showImport && (
        <ImportArticlesModal
          onClose={() => setShowImport(false)}
          onImported={invalidate}
        />
      )}
    </div>
  );
}
