import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchPageList } from '../../api/pages';

export function PageListPage() {
  const { data, isLoading } = useQuery({ queryKey: ['pages-admin'], queryFn: fetchPageList });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Pages</h1>
      </div>
      <p className="field-hint" style={{ marginBottom: 10 }}>
        Static pages (About, Contact, Privacy Policy, ...) — each is wired to a fixed URL, so pages can be edited here but not added or removed.
      </p>

      {isLoading || !data ? <p>Loading…</p> : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((page) => (
              <tr key={page.id}>
                <td><Link to={`/pages/${page.id}`}>{page.title}</Link></td>
                <td>{page.slug}</td>
                <td>
                  {page.is_active
                    ? <span className="badge badge-published">Active</span>
                    : <span className="badge badge-archived">Inactive</span>}
                </td>
                <td>{new Date(page.updated_at).toLocaleDateString()}</td>
                <td>
                  {!page.body.trim() && <span className="badge badge-archived">Empty</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
