import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Folder, Calendar, Users, FileText, Newspaper, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminDashboard = () => {
  const { logout } = useAuth();

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-menu">
          <div className="menu-group">
            <p className="menu-label">Admin Panel</p>
            <NavLink to="/admin" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} /> Overview
            </NavLink>
            <NavLink to="/admin/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Folder size={18} /> Projects
            </NavLink>
            <NavLink to="/admin/events" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Calendar size={18} /> Events
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Users size={18} /> Users
            </NavLink>
            <NavLink to="/admin/audit-log" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <FileText size={18} /> Audit Log
            </NavLink>
            <NavLink to="/admin/news-settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Newspaper size={18} /> News Settings
            </NavLink>
            <NavLink to="/admin/investor-vetting" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Users size={18} /> Investor Vetting
            </NavLink>
          </div>

          <div className="menu-group mt-auto">
            <div className="divider"></div>
            <button onClick={logout} className="sidebar-link text-error">
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="dashboard-content">
        <Outlet />
      </main>

      <style jsx>{`
        .dashboard-layout {
          display: flex;
          min-height: calc(100vh - 70px);
          background: var(--color-gray-100);
        }
        .sidebar {
          width: 260px;
          background: white;
          border-right: 1px solid var(--color-gray-200);
          display: flex;
          flex-direction: column;
        }
        .sidebar-menu {
          padding: 2rem 1.5rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .menu-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .menu-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--color-gray-400);
          font-weight: 700;
          margin-bottom: 0.75rem;
          padding-left: 0.5rem;
        }
        .sidebar-link {
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
        .sidebar-link:hover { background: var(--color-gray-100); color: var(--color-neutral-dark); }
        .sidebar-link.active { background: #EDF5FF; color: var(--color-primary); font-weight: 600; }
        .sidebar-link.text-error { color: var(--color-error); }
        .sidebar-link.text-error:hover { background: #FEF2F2; }
        .divider { height: 1px; background: var(--color-gray-200); margin: 1rem 0; }
        .mt-auto { margin-top: auto; }
        .dashboard-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .dashboard-layout { flex-direction: column; }
          .sidebar { width: 100%; padding: 0.5rem; overflow-x: auto; flex-direction: row; border-right: none; border-bottom: 1px solid var(--color-gray-200); height: auto; }
          .sidebar-menu { flex-direction: row; padding: 0; width: 100%; gap: 0.5rem; }
          .menu-label, .divider, .mt-auto { display: none; }
          .menu-group { display: flex; gap: 0.5rem; width: 100%; flex-direction: row; }
          .sidebar-link { white-space: nowrap; width: auto; justify-content: center; padding: 0.5rem; margin-bottom: 0; }
          .sidebar-link span { display: none; }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
