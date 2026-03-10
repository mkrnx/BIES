import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folder, Heart, MessageSquare, BarChart2, Settings, LogOut, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const mainTabs = [
  { to: '/dashboard/builder', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/builder/projects', label: 'Projects', icon: Folder },
  { to: '/dashboard/builder/my-events', label: 'Events', icon: CalendarDays },
  { to: '/dashboard/builder/following', label: 'Following', icon: Heart },
  { to: '/dashboard/builder/messages', label: 'Messages', icon: MessageSquare },
  { to: '/dashboard/builder/analytics', label: 'Analytics', icon: BarChart2 },
];

const BuilderDashboard = () => {
  const location = useLocation();
  const { logout } = useAuth();

  const isTabActive = (path, end) => end ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="dashboard-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-sidebar">
        <div className="sidebar-menu">
          <div className="menu-group">
            <p className="menu-label">Main</p>
            {mainTabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <tab.icon size={18} /> <span className="link-label">{tab.label}</span>
              </NavLink>
            ))}
          </div>

          <div className="menu-group mt-auto">
            <div className="divider"></div>
            <NavLink
              to="/dashboard/builder/settings"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Settings size={18} /> <span className="link-label">Settings</span>
            </NavLink>
            <button onClick={logout} className="sidebar-link text-error">
              <LogOut size={18} /> <span className="link-label">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Tab Bar */}
      <div className="mobile-tab-bar" style={{ display: 'none' }}>
        {mainTabs.map(tab => {
          const active = isTabActive(tab.to, tab.end);
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                flex: 1,
                textDecoration: 'none',
                color: active ? 'var(--color-primary)' : 'var(--color-gray-400)',
                fontSize: '0.65rem',
                fontWeight: active ? 700 : 500,
                padding: '8px 0',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: active ? 'var(--color-blue-tint)' : 'var(--color-gray-100)',
                color: active ? 'var(--color-primary)' : 'var(--color-gray-400)',
                transition: 'all 0.2s',
              }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span>{tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="dashboard-content">
        <Outlet />
      </main>

      <style>{`
        .dashboard-layout {
          display: flex;
          min-height: calc(100vh - 70px);
          background: var(--color-gray-50);
        }

        .desktop-sidebar {
          width: 260px;
          background: var(--color-surface);
          border-right: 1px solid var(--color-gray-200);
          display: flex;
          flex-direction: column;
        }

        .desktop-sidebar .sidebar-menu {
            padding: 2rem 1.5rem;
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .desktop-sidebar .menu-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .desktop-sidebar .menu-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            color: var(--color-gray-400);
            font-weight: 700;
            margin-bottom: 0.75rem;
            padding-left: 0.5rem;
        }

        .desktop-sidebar .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.75rem 1rem;
          color: var(--color-gray-500);
          border-radius: var(--radius-md);
          margin-bottom: 0.25rem;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          border: none;
          background: none;
          width: 100%;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .desktop-sidebar .sidebar-link:hover { background: var(--color-primary-dark); color: white; }
        .desktop-sidebar .sidebar-link.active { background: var(--color-primary); color: white; font-weight: 600; }
        .desktop-sidebar .sidebar-link.text-error { color: var(--color-error); }
        .desktop-sidebar .sidebar-link.text-error:hover { background: var(--color-red-tint); }

        .desktop-sidebar .divider { height: 1px; background: var(--color-gray-200); margin: 1rem 0; }
        .desktop-sidebar .mt-auto { margin-top: auto; }

        .dashboard-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .mobile-tab-bar { display: none; }

        @media (max-width: 768px) {
          .dashboard-layout { flex-direction: column; }
          .desktop-sidebar { display: none; }
          .mobile-tab-bar {
            display: flex !important;
            justify-content: space-evenly;
            align-items: flex-start;
            background: var(--color-surface);
            border-bottom: 1px solid var(--color-gray-200);
            padding: 6px 0;
            position: sticky;
            top: 70px;
            z-index: 50;
          }
          .dashboard-content { padding: 1rem; }
        }
      `}</style>
    </div>
  );
};

export default BuilderDashboard;
