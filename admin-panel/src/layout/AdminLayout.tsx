import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChangePasswordModal } from '../components/ChangePasswordModal';

function Icon({ path, viewBox = '0 0 24 24' }: { path: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

const KEY_ICON = 'M15.5 8.5a4 4 0 11-4-4M11.5 4.5L3 13v3h3l1-1h2v-2h2l1.5-1.5';
const LOGOUT_ICON = 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: 'M4 4h6v7H4zM14 4h6v4h-6zM14 11h6v9h-6zM4 14h6v6H4z' },
  { to: '/articles', label: 'Articles', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3' },
  { to: '/categories', label: 'Categories', icon: 'M3 7l3-4h5l1 2h9v13H3zM3 7v11' },
  { to: '/tags', label: 'Tags', icon: 'M12 2l9 9-9 9-9-9 3-9zM7.5 6.5h.01' },
  { to: '/media', label: 'Media', icon: 'M3 4h18v16H3zM3 16l5-5 4 4 4-5 5 6M9 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
  { to: '/pages', label: 'Pages', icon: 'M7 3h7l5 5v13H7zM14 3v5h5M10 12h6M10 16h6' },
  { to: '/inquiries', label: 'Inquiries', icon: 'M4 4h16v14H8l-4 4zM4 8h16M8 12h8' },
  { to: '/seo', label: 'SEO', icon: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3' },
  { to: '/users', label: 'Users', icon: 'M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 10a4 4 0 100-8 4 4 0 000 8zM23 20v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { to: '/settings', label: 'Site Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z' },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">American<span>Diary24</span></div>
        <nav className="sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'sidebar__link' + (isActive ? ' is-active' : '')}
            >
              <Icon path={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <div className="topbar">
          <strong>Admin Panel</strong>
          <div className="topbar__user">
            {user?.author_avatar ? (
              <img src={user.author_avatar} alt="" className="topbar__avatar" />
            ) : (
              <div className="topbar__avatar" />
            )}
            <div>
              <div className="topbar__name">{user?.author_name || user?.username}</div>
              <div className="topbar__role">{user?.role}</div>
            </div>
            <button type="button" className="topbar__icon-btn" title="Change Password" onClick={() => setShowPasswordModal(true)}>
              <Icon path={KEY_ICON} />
            </button>
            <button type="button" className="topbar__icon-btn" title="Log Out" onClick={logout}>
              <Icon path={LOGOUT_ICON} />
            </button>
          </div>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </div>
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
