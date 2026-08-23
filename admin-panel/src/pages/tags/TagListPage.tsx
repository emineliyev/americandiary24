import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { deleteTag, fetchTagList } from '../../api/tags';
import { Pagination } from '../../components/Pagination';
import { useAuth } from '../../auth/AuthContext';
import { canManageTaxonomy } from '../../utils/roles';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useConfirm } from '../../components/confirm/ConfirmContext';

export function TagListPage() {
  const { user } = useAuth();
  const canManage = canManageTaxonomy(user?.role);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tags-admin', page, search],
    queryFn: () => fetchTagList({ page, search: search || undefined }),
  });

  async function handleDelete(id: number, name: string) {
    const ok = await confirm({ message: `Delete tag "${name}"?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteTag(id);
      queryClient.invalidateQueries({ queryKey: ['tags-admin'] });
      toast.success(`Tag "${name}" deleted.`);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to delete tag.'));
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Tags</h1>
        {canManage && <Link to="/tags/new" className="btn btn-primary">+ New Tag</Link>}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search tags…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ height: 38, padding: '0 10px', border: '1px solid var(--border-strong)', width: 260 }}
        />
      </div>

      {isLoading || !data ? <p>Loading…</p> : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {data.results.map((t) => (
                <tr key={t.id}>
                  <td>{canManage ? <Link to={`/tags/${t.id}`}>{t.name}</Link> : t.name}</td>
                  <td>{t.slug}</td>
                  {canManage && (
                    <td>
                      <button className="btn" onClick={() => handleDelete(t.id, t.name)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination page={page} count={data.count} hasPrevious={!!data.previous} hasNext={!!data.next} onChange={setPage} />
        </>
      )}
    </div>
  );
}
