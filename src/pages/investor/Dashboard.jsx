import React from 'react';
import { TrendingUp, Search, ArrowUpRight, Loader2, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiQuery } from '../../hooks/useApi';
import { watchlistApi, analyticsApi, projectsApi } from '../../services/api';

const InvestorDashboard = () => {
    const location = useLocation();
    const { user, logout } = useAuth();
    const isRoot = location.pathname === '/dashboard/investor';

    const { data: watchlistData, loading: wlLoading } = useApiQuery(watchlistApi.list);
    const { data: stats, loading: statsLoading } = useApiQuery(analyticsApi.investorDashboard);
    const { data: recommended, loading: recLoading } = useApiQuery(projectsApi.list, { featured: true, limit: 3 });

    const watchlist = watchlistData?.data || watchlistData || [];
    const forYou = recommended?.data || recommended || [];

    const capitalDeployed = stats?.capitalDeployed || 0;
    const capitalChange = stats?.capitalChange || 0;
    const activeProjects = stats?.activeProjects || 0;
    const pitchDecks = stats?.pitchDecksReviewed || 0;

    const formatCurrency = (val) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-menu">
                    <NavLink to="/dashboard/investor" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
                    <NavLink to="/dashboard/investor/watchlist" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>My Watchlist</NavLink>
                    <NavLink to="/dashboard/investor/messages" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>Messages</NavLink>
                    <NavLink to="/dashboard/investor/deal-flow" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>Deal Flow</NavLink>
                    <NavLink to="/dashboard/investor/create-event" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>Create Event</NavLink>
                    <div className="divider"></div>
                    <NavLink to="/dashboard/investor/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>Settings</NavLink>
                    <button onClick={logout} className="sidebar-link text-error">
                        <LogOut size={18} style={{ marginRight: 8 }} /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="dashboard-content">
                {isRoot ? (
                    <>
                        <div className="header">
                            <div>
                                <h1>Investor Dashboard</h1>
                                <p className="subtitle">Welcome back{user?.profile?.name ? `, ${user.profile.name}` : ''}.</p>
                            </div>
                            <Link to="/discover" className="btn btn-secondary">
                                <Search size={18} style={{ marginRight: 8 }} /> Find Projects
                            </Link>
                        </div>

                        {/* Portfolio Stats Widgets */}
                        <div className="stats-grid">
                            <div className="stat-box featured">
                                <span className="label">Capital Deployed</span>
                                <div className="value-row">
                                    <span className="value">{formatCurrency(capitalDeployed)}</span>
                                    {capitalChange !== 0 && (
                                        <span className="change positive">
                                            <TrendingUp size={16} /> +{capitalChange}%
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="stat-box">
                                <span className="label">Active Projects</span>
                                <div className="value-row">
                                    <span className="value">{activeProjects}</span>
                                    <span className="sub">in portfolio</span>
                                </div>
                            </div>
                            <div className="stat-box">
                                <span className="label">Pitch Decks Reviewed</span>
                                <div className="value-row">
                                    <span className="value">{pitchDecks}</span>
                                    <span className="sub">this month</span>
                                </div>
                            </div>
                        </div>

                        <div className="content-grid">
                            {/* Watchlist Section */}
                            <section className="dashboard-card main-card">
                                <div className="card-header">
                                    <h3>My Watchlist</h3>
                                    <Link to="/dashboard/investor/watchlist" className="text-secondary text-sm font-semibold" style={{ textDecoration: 'none' }}>View All</Link>
                                </div>
                                {wlLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                                ) : watchlist.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-gray-500)' }}>
                                        No projects in your watchlist yet. <Link to="/discover" style={{ color: 'var(--color-primary)' }}>Discover projects</Link>
                                    </div>
                                ) : (
                                    <table className="watchlist-table">
                                        <thead>
                                            <tr>
                                                <th>Project</th>
                                                <th>Industry</th>
                                                <th>Stage</th>
                                                <th>Target</th>
                                                <th>Growth</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {watchlist.slice(0, 5).map(item => {
                                                const project = item.project || item;
                                                return (
                                                    <tr key={item.id || project.id}>
                                                        <td className="font-semibold">
                                                            <Link to={`/project/${project.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                                                                {project.name}
                                                            </Link>
                                                        </td>
                                                        <td>{project.category || project.industry || '—'}</td>
                                                        <td><span className="pill">{project.stage || '—'}</span></td>
                                                        <td>{project.fundingGoal ? formatCurrency(project.fundingGoal) : '—'}</td>
                                                        <td className="text-success">{project.growth || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </section>

                            {/* For You Section */}
                            <section className="dashboard-card side-card">
                                <div className="card-header">
                                    <h3>For You</h3>
                                </div>
                                {recLoading ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                                ) : forYou.length === 0 ? (
                                    <div style={{ padding: '1rem', color: 'var(--color-gray-500)', fontSize: '0.9rem' }}>No recommendations yet.</div>
                                ) : (
                                    <div className="recommendations-list">
                                        {forYou.slice(0, 3).map(item => (
                                            <Link key={item.id} to={`/project/${item.id}`} className="rec-item" style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <div className="rec-icon">
                                                    <ArrowUpRight size={18} />
                                                </div>
                                                <div className="rec-content">
                                                    <h4>{item.name}</h4>
                                                    <p>{item.tagline || item.description?.substring(0, 80) || ''}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                                <Link to="/discover" className="btn btn-outline w-full mt-4" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>Discover More</Link>
                            </section>
                        </div>
                    </>
                ) : (
                    <Outlet />
                )}
            </main>

            <style jsx>{`
        .dashboard-layout {
          display: flex;
          min-height: calc(100vh - 70px);
          background: var(--color-gray-100);
        }

        .sidebar {
          width: 250px;
          background: white;
          border-right: 1px solid var(--color-gray-200);
          padding: 2rem 1rem;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: var(--color-gray-500);
          border-radius: var(--radius-md);
          margin-bottom: 0.25rem;
          font-weight: 500;
          text-decoration: none;
          border: none;
          background: none;
          width: 100%;
          cursor: pointer;
          font-size: 0.95rem;
        }

        .sidebar-link:hover { background: var(--color-gray-100); color: var(--color-neutral-dark); }
        .sidebar-link.active { background: rgba(255, 91, 0, 0.05); color: var(--color-secondary); font-weight: 600; }
        .sidebar-link.text-error { color: var(--color-error); }
        .sidebar-link.text-error:hover { background: #FEF2F2; }

        .divider { height: 1px; background: var(--color-gray-200); margin: 1rem 0; }

        .dashboard-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .subtitle { color: var(--color-gray-500); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-box {
          background: white;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .stat-box.featured {
            background: linear-gradient(135deg, var(--color-secondary) 0%, var(--color-secondary-dark) 100%);
            color: white;
        }
        .stat-box.featured .label { color: rgba(255,255,255,0.9); }
        .stat-box.featured .change { color: white; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 99px; }

        .stat-box .label { display: block; color: var(--color-gray-400); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .value-row { display: flex; align-items: center; gap: 0.75rem; }
        .value-row .value { font-size: 2rem; font-weight: 700; font-family: var(--font-mono); }
        .change { display: flex; align-items: center; font-size: 0.875rem; font-weight: 600; gap: 4px; }
        .sub { font-size: 0.875rem; color: var(--color-gray-400); }

        .content-grid {
            display: flex;
            gap: 1.5rem;
        }

        .dashboard-card {
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          padding: 1.5rem;
        }
        .main-card { flex: 2; }
        .side-card { flex: 1; }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        /* Watchlist Table */
        .watchlist-table { width: 100%; border-collapse: collapse; }
        .watchlist-table th { text-align: left; padding-bottom: 1rem; color: var(--color-gray-400); font-size: 0.85rem; }
        .watchlist-table td { padding: 0.75rem 0; font-size: 0.95rem; border-bottom: 1px solid var(--color-gray-100); }
        .watchlist-table tr:last-child td { border-bottom: none; }

        .pill { background: var(--color-gray-100); padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; color: var(--color-gray-600); }
        .text-success { color: var(--color-success); font-weight: 600; }

        /* Recommendations */
        .rec-item {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            padding: 1rem;
            border: 1px solid var(--color-gray-100);
            border-radius: var(--radius-md);
            transition: transform 0.2s;
        }
        .rec-item:hover { transform: translateY(-2px); border-color: var(--color-secondary); }

        .rec-icon {
            width: 32px; height: 32px; background: #FFF7ED; border-radius: 50%; color: var(--color-secondary);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .rec-content h4 { font-size: 0.95rem; margin-bottom: 0.25rem; }
        .rec-content p { font-size: 0.85rem; color: var(--color-gray-500); line-height: 1.3; }

        .mt-4 { margin-top: 1rem; }

        @media (max-width: 1024px) {
            .content-grid { flex-direction: column; }
        }

        @media (max-width: 768px) {
          .dashboard-layout { flex-direction: column; }
          .sidebar { width: 100%; border-right: none; display: flex; overflow-x: auto; padding: 0.5rem; border-bottom: 1px solid var(--color-gray-200); }
          .sidebar-menu { display: flex; gap: 0.5rem; width: 100%; }
          .sidebar-link { white-space: nowrap; width: auto; }
          .divider { display: none; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
        </div>
    );
};

export default InvestorDashboard;
