import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, MessageSquare, Plus, MoreHorizontal, Loader2, Edit, Trash2, ExternalLink, Send, Zap, FolderPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApiQuery } from '../../hooks/useApi';
import { projectsApi, analyticsApi, zapsApi } from '../../services/api';

const ActionMenu = ({ project, onDelete, onSubmit }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const navigate = useNavigate();
    const name = project.title || project.name;
    const close = () => setOpen(false);

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.right });
        }
        setOpen(v => !v);
    };

    return (
        <>
            <button ref={btnRef} className="action-menu-trigger" onClick={handleToggle} title="Actions">
                <MoreHorizontal size={18} />
            </button>
            {open && ReactDOM.createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={close} />
                    <div className="ctx-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 9999 }}>
                        <button className="ctx-item" onClick={() => { close(); navigate(`/dashboard/builder/new-project?edit=${project.id}`); }}>
                            <Edit size={15} /> Edit Project
                        </button>
                        <button className="ctx-item" onClick={() => { close(); navigate(`/project/${project.id}`); }}>
                            <ExternalLink size={15} /> View Project
                        </button>
                        {(project.status || 'draft') === 'draft' && (
                            <button className="ctx-item ctx-submit" onClick={() => { close(); onSubmit(project.id, name); }}>
                                <Send size={15} /> Submit for Review
                            </button>
                        )}
                        <div className="ctx-divider" />
                        <button className="ctx-item ctx-delete" onClick={() => { close(); onDelete(project.id, name); }}>
                            <Trash2 size={15} /> Delete
                        </button>
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

const BuilderOverview = () => {
    const { user } = useAuth();
    const { data: projects, loading: projectsLoading, refetch } = useApiQuery(projectsApi.list, { ownerId: user?.id });
    const { data: stats, loading: statsLoading } = useApiQuery(analyticsApi.builderDashboard);
    const [totalSatsReceived, setTotalSatsReceived] = useState(0);

    const projectList = projects?.data || projects || [];
    const totalRaised = stats?.totalRaised || 0;
    const totalGoal = stats?.totalGoal || 0;
    const totalViews = stats?.totalViews || 0;
    const activeEnquiries = stats?.activeEnquiries || 0;
    const progressPct = totalGoal > 0 ? Math.round((totalRaised / totalGoal) * 100) : 0;

    useEffect(() => {
        if (projectList.length === 0) return;
        let cancelled = false;
        Promise.all(
            projectList.map(p => zapsApi.projectZapStats(p.id).catch(() => null))
        ).then(results => {
            if (cancelled) return;
            const total = results.reduce((sum, r) => sum + (r?.totalSats || 0), 0);
            setTotalSatsReceived(total);
        });
        return () => { cancelled = true; };
    }, [projectList.length]);

    const formatCurrency = (val) => {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    const formatSats = (val) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
        return String(val);
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await projectsApi.delete(id);
            refetch();
        } catch (err) {
            alert(err?.message || 'Failed to delete project.');
        }
    };

    const handleSubmit = async (id, name) => {
        if (!window.confirm(`Submit "${name}" for admin review?`)) return;
        try {
            await projectsApi.submit(id);
            refetch();
        } catch (err) {
            alert(err?.message || 'Failed to submit project');
        }
    };

    if (projectsLoading && statsLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <>
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                            Builder Dashboard
                            {/* Mobile icon */}
                            <Link to="/dashboard/builder/new-project" className="hide-on-desktop" title="New Project" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', marginLeft: 'auto' }}>
                                <FolderPlus size={18} />
                            </Link>
                        </h1>
                        <p className="subtitle">Manage your projects and fundraising</p>
                    </div>
                    {/* Desktop button */}
                    <Link to="/dashboard/builder/new-project" className="btn btn-primary hide-on-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 250 }}>
                        <Plus size={18} style={{ marginRight: 8 }} />{' '}New Project
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="stats-grid">
                <div className="stat-box featured">
                    <span className="label">Total Capital Raised</span>
                    <div className="value-row">
                        <span className="value">{formatCurrency(totalRaised)}</span>
                        <span className="fraction">/ {formatCurrency(totalGoal)} Goal</span>
                    </div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(progressPct, 100)}%` }}></div>
                    </div>
                </div>
                <div className="stat-box">
                    <span className="label">Total Project Views</span>
                    <div className="value-row">
                        <Eye size={20} className="text-secondary" />
                        <span className="value">{totalViews.toLocaleString()}</span>
                    </div>
                </div>
                <div className="stat-box">
                    <span className="label">Active Enquiries</span>
                    <div className="value-row">
                        <MessageSquare size={20} className="text-primary" />
                        <span className="value">{activeEnquiries}</span>
                    </div>
                </div>
                <div className="stat-box">
                    <span className="label">Sats Received</span>
                    <div className="value-row">
                        <Zap size={20} style={{ color: '#f7931a' }} />
                        <span className="value">{formatSats(totalSatsReceived)}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-400)' }}>sats</span>
                    </div>
                </div>
            </div>

            {/* Projects Section */}
            <section className="section">
                <h2>Recent Projects</h2>
                {projectList.length === 0 ? (
                    <div className="empty-state">
                        <p>No projects yet. Create your first project to get started.</p>
                        <Link to="/dashboard/builder/new-project" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginTop: '1rem' }}>
                            <Plus size={18} style={{ marginRight: 8 }} /> Create Project
                        </Link>
                    </div>
                ) : (
                    <div className="projects-table-container">
                        <table className="projects-table">
                            <thead>
                                <tr>
                                    <th>Project Name</th>
                                    <th>Status</th>
                                    <th>Capital Progress</th>
                                    <th>Views</th>
                                    <th>Likes</th>
                                    <th>Enquiries</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectList.slice(0, 5).map(project => (
                                    <tr key={project.id}>
                                        <td>
                                            <Link to={`/project/${project.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                                                {project.title || project.name}
                                            </Link>
                                        </td>
                                        <td><span className={`status-badge ${(project.status || 'draft').toLowerCase()}`}>{project.status || 'Draft'}</span></td>
                                        <td>
                                            <div className="text-sm font-semibold">{formatCurrency(project.raised || 0)} / {formatCurrency(project.fundingGoal || 0)}</div>
                                        </td>
                                        <td>{project.views || 0}</td>
                                        <td>{project.likes || 0}</td>
                                        <td>{project.enquiries || 0}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <ActionMenu project={project} onDelete={handleDelete} onSubmit={handleSubmit} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <style jsx>{`
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .subtitle { color: var(--color-gray-500); }

        .empty-state {
          background: white;
          border-radius: var(--radius-lg);
          padding: 3rem;
          text-align: center;
          color: var(--color-gray-500);
          border: 1px solid var(--color-gray-200);
        }

        /* Stats */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-box {
          background: white;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .stat-box.featured {
            background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
            color: white;
        }
        .stat-box.featured .label { color: rgba(255,255,255,0.8); }
        .stat-box.featured .fraction { color: rgba(255,255,255,0.6); font-size: 0.9rem; font-weight: normal; margin-left: 8px;}

        .stat-box .label { display: block; color: var(--color-gray-400); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .value-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
        .value-row .value { font-size: 1.75rem; font-weight: 700; font-family: var(--font-mono); }

        .progress-bar {
            height: 6px;
            background: rgba(255,255,255,0.2);
            border-radius: 99px;
            overflow: hidden;
            margin-top: 0.5rem;
        }
        .progress-fill { height: 100%; background: var(--color-success); border-radius: 99px; }

        .text-success { color: var(--color-success); }
        .text-secondary { color: var(--color-secondary); }

        /* Projects Table */
        .projects-table-container {
            background: white;
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-sm);
            overflow: hidden;
        }

        .projects-table {
            width: 100%;
            border-collapse: collapse;
        }

        .projects-table th {
            text-align: left;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--color-gray-200);
            color: var(--color-gray-500);
            font-size: 0.85rem;
            font-weight: 600;
        }

        .projects-table td {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--color-gray-100);
            font-size: 0.95rem;
        }
        .projects-table tr:last-child td { border-bottom: none; }

        .status-badge {
          display: inline-block;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 99px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .status-badge.active { background: #DCFCE7; color: #166534; }
        .status-badge.draft { background: #F3F4F6; color: #4B5563; }

        @media (max-width: 768px) {
            .header { margin-bottom: 0.75rem; }
            .stats-grid {
                grid-template-columns: 1fr 1fr;
                gap: 0.75rem;
                margin-bottom: 1.5rem;
            }
            .stat-box { padding: 1rem 1.25rem; }
            .stat-box .label { font-size: 0.8rem; margin-bottom: 0.25rem; }
            .value-row { gap: 0.5rem; margin-bottom: 0.25rem; }
            .value-row .value { font-size: 1.4rem; }
            .projects-table-container { overflow-x: auto; }
        }
      `}</style>

            <style>{`
                .action-menu-trigger {
                    width: 32px; height: 32px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 6px; border: 1px solid transparent;
                    background: none; color: #6b7280; cursor: pointer;
                    transition: all 0.15s;
                }
                .action-menu-trigger:hover { background: #f3f4f6; border-color: #e5e7eb; color: #374151; }

                .ctx-menu {
                    min-width: 190px;
                    background: rgba(255,255,255,0.98);
                    backdrop-filter: blur(12px);
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
                    padding: 4px 0;
                    animation: ctxIn 0.1s ease-out;
                }
                @keyframes ctxIn {
                    from { opacity: 0; transform: translateX(-100%) scale(0.95); }
                    to { opacity: 1; transform: translateX(-100%) scale(1); }
                }
                .ctx-item {
                    display: flex; align-items: center; gap: 0.6rem;
                    width: 100%; padding: 0.5rem 0.85rem;
                    font-size: 0.84rem; font-weight: 500; color: #374151;
                    background: none; border: none; cursor: pointer;
                    text-align: left; transition: background 0.08s; white-space: nowrap;
                }
                .ctx-item:hover { background: #f3f4f6; }
                .ctx-item:first-child { border-radius: 8px 8px 0 0; }
                .ctx-item:last-child { border-radius: 0 0 8px 8px; }
                .ctx-submit { color: var(--color-primary, #0052cc); }
                .ctx-submit:hover { background: #eff6ff; }
                .ctx-delete { color: #ef4444; }
                .ctx-delete:hover { background: #fef2f2; }
                .ctx-divider { height: 1px; background: #e5e7eb; margin: 3px 0; }
            `}</style>
        </>
    );
};

export default BuilderOverview;
