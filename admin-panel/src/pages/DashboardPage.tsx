import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchDashboardStats } from '../api/lookups';
import { LineChart } from '../components/charts/LineChart';
import { CategoryBarList } from '../components/charts/CategoryBarList';
import type { ArticleStatus } from '../api/types';

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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardStats });

  if (isLoading || !data) return <p>Loading…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/articles/new" className="btn btn-primary">+ New Article</Link>
          <Link to="/articles" className="btn">All Articles</Link>
        </div>
      </div>

      <div className="stat-card-row">
        <StatCard label="Total Articles" value={data.total} />
        <StatCard label="Published" value={data.published} />
        <StatCard label="Drafts" value={data.drafts} />
        <StatCard label="Scheduled" value={data.scheduled} />
        <StatCard label="Categories" value={data.categories_count} />
        <StatCard label="Users" value={data.users_count} />
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 20 }}>
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Last 7 days — articles published</h2>
          <LineChart data={data.weekly} />
        </div>
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 16 }}>Published by category</h2>
          <CategoryBarList rows={data.by_category} />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Recent Articles</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.latest.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/articles/${a.id}`}>{a.title}</Link></td>
                  <td>{a.category.name}</td>
                  <td><span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Recent Activity</h2>
          {data.latest.map((a) => (
            <div key={a.id} className="activity-row">
              <span><strong>{a.author.name}</strong> updated — <Link to={`/articles/${a.id}`}>{a.title}</Link></span>
              <span className="activity-row__time">{timeAgo(a.updated_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
