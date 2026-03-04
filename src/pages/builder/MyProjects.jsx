import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Edit, Trash2, ExternalLink, Loader2, Send, MoreHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApiQuery } from '../../hooks/useApi';
import { projectsApi } from '../../services/api';

const ActionMenu = ({ project, onDelete, onSubmit }) => {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const navigate = useNavigate();
    const name = project.title || project.name;

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.right });
        }
        setOpen(v => !v);
    };

    const close = () => setOpen(false);

    return (
        <>
            <button ref={btnRef} className="action-menu-trigger" onClick={handleToggle} title="Actions">
                <MoreHorizontal size={18} />
            </button>

            {open && ReactDOM.createPortal(
                <>
                    {/* Full-screen invisible backdrop */}
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={close} />
                    <div
                        className="ctx-menu"
                        style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 9999 }}
                    >
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

const MyProjects = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState(null); // Added for copyLink functionality, though copyLink is not used in this component

    const { data: projects, loading, refetch } = useApiQuery(projectsApi.list, { ownerId: user?.id });

    const projectList = projects?.data || projects || [];

    const filtered = projectList.filter(p => {
        if (filter !== 'all' && (p.status || 'draft').toLowerCase() !== filter) return false;
        const projectName = (p.title || p.name || '').toLowerCase();
        if (search && !projectName.includes(search.toLowerCase())) return false;
        return true;
    });

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
        if (!window.confirm(`Submit "${name}" for admin review? It will be highlighted as a verified project on the Discover page.`)) return;
        try {
            await projectsApi.submit(id);
            refetch();
        } catch (err) {
            alert(err?.message || 'Failed to submit project');
        }
    };

    const formatCurrency = (val) => {
        if (!val) return '$0';
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    const copyLink = (id) => {
        navigator.clipboard.writeText(`${window.location.origin}/project/${id}`);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const categoryLabel = (c) => {
        if (!c) return '—';
        const special = { SAAS: 'SaaS', ECOMMERCE: 'E-Commerce', WEB3: 'Web3', REAL_ESTATE: 'Real Estate' };
        if (special[c]) return special[c];
        return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="header">
                <div>
                    <h1>My Projects</h1>
                    <p className="subtitle">Manage and track all your ventures</p>
                </div>
                <Link to="/dashboard/builder/new-project" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <Plus size={18} style={{ marginRight: 8 }} /> Create Project
                </Link>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <div className="tabs">
                        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Projects</button>
                        <button className={`tab ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Active</button>
                        <button className={`tab ${filter === 'pending-review' ? 'active' : ''}`} onClick={() => setFilter('pending-review')}>Pending Review</button>
                        <button className={`tab ${filter === 'draft' ? 'active' : ''}`} onClick={() => setFilter('draft')}>Drafts</button>
                    </div>
                    <div className="search-wrapper">
                        <input type="text" placeholder="Search projects..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                        {projectList.length === 0 ? 'No projects yet. Create your first one!' : 'No projects match your filter.'}
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="projects-table">
                            <thead>
                                <tr>
                                    <th>Project Name</th>
                                    <th>Stage</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th>Date Created</th>
                                    <th>Fundraising</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(project => {
                                    const raised = project.raised || 0;
                                    const goal = project.fundingGoal || 0;
                                    const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
                                    return (
                                        <tr key={project.id}>
                                            <td>
                                                <Link to={`/project/${project.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                                                    {project.title || project.name}
                                                </Link>
                                            </td>
                                            <td>{project.stage || '—'}</td>
                                            <td>{categoryLabel(project.category)}</td>
                                            <td><span className={`status-badge ${(project.status || 'draft').toLowerCase().replace(' ', '-')}`}>{project.status || 'Draft'}</span></td>
                                            <td className="text-gray-500">{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '—'}</td>
                                            <td>
                                                <div className="text-sm font-semibold">{formatCurrency(raised)} / {formatCurrency(goal)}</div>
                                                <div className="progress-bar-sm">
                                                    <div className="fill" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <ActionMenu
                                                    project={project}
                                                    onDelete={handleDelete}
                                                    onSubmit={handleSubmit}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style jsx>{`
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }

                .card-container {
                    background: white;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                }

                .toolbar {
                    padding: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tabs { display: flex; gap: 1rem; }
                .tab {
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    border: none;
                    background: none;
                }
                .tab.active { background: var(--color-gray-100); color: var(--color-primary); }

                .search-input {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    width: 250px;
                }

                .table-wrapper { overflow-x: auto; overflow-y: visible; }
                .projects-table { width: 100%; border-collapse: collapse; }

                .projects-table th {
                    text-align: left;
                    padding: 1rem;
                    background: var(--color-gray-50);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--color-gray-500);
                    font-weight: 600;
                }

                .projects-table td { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); font-size: 0.9rem; }
                .projects-table tr:last-child td { border-bottom: none; }

                .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
                .status-badge.active { background: #DCFCE7; color: #166534; }
                .status-badge.draft { background: #F3F4F6; color: #4B5563; }
                .status-badge.pending-review { background: #FEF9C3; color: #854D0E; }

                .progress-bar-sm { width: 100px; height: 4px; background: #E5E7EB; border-radius: 99px; margin-top: 4px; overflow: hidden; }
                .progress-bar-sm .fill { height: 100%; background: var(--color-success); border-radius: 99px; }
            `}</style>

            {/* Global styles for action menu (child component) and portal context menu */}
            <style>{`
                .action-menu-trigger {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    border: 1px solid transparent;
                    background: none;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .action-menu-trigger:hover {
                    background: #f3f4f6;
                    border-color: #e5e7eb;
                    color: #374151;
                }

                .ctx-menu {
                    min-width: 190px;
                    background: rgba(255,255,255,0.98);
                    backdrop-filter: blur(12px);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: 10px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
                    z-index: 9999;
                    padding: 4px 0;
                    animation: ctxIn 0.1s ease-out;
                }

                @keyframes ctxIn {
                    from { opacity: 0; transform: translateX(-100%) scale(0.95); }
                    to { opacity: 1; transform: translateX(-100%) scale(1); }
                }

                .ctx-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    width: 100%;
                    padding: 0.5rem 0.85rem;
                    font-size: 0.84rem;
                    font-weight: 500;
                    color: #374151;
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.08s;
                    white-space: nowrap;
                }
                .ctx-item:hover { background: #f3f4f6; }
                .ctx-item:first-child { border-radius: 8px 8px 0 0; }
                .ctx-item:last-child { border-radius: 0 0 8px 8px; }
                .ctx-submit { color: var(--color-primary, #0052cc); }
                .ctx-submit:hover { background: #eff6ff; }
                .ctx-delete { color: #ef4444; }
                .ctx-delete:hover { background: #fef2f2; }

                .ctx-divider {
                    height: 1px;
                    background: #e5e7eb;
                    margin: 3px 0;
                }
            `}</style>
        </div>
    );
};

export default MyProjects;
