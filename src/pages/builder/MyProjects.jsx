import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Edit, Trash2, ExternalLink, Loader2, Send, MoreHorizontal, FolderPlus, Search, X } from 'lucide-react';
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
    const [view, setView] = useState('projects'); // 'projects' | 'requests'
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(null);

    const { data: projects, loading: projectsLoading, refetch: refetchProjects } = useApiQuery(projectsApi.list, { ownerId: user?.id });
    const { data: requestsData, loading: requestsLoading, refetch: refetchRequests } = useApiQuery(projectsApi.getAllDeckRequests);

    const projectList = Array.isArray(projects?.data) ? projects.data : Array.isArray(projects) ? projects : [];
    const requestList = Array.isArray(requestsData?.data) ? requestsData.data : Array.isArray(requestsData) ? requestsData : [];

    const filteredProjects = projectList.filter(p => {
        if (filter !== 'all' && (p.status || 'draft').toLowerCase() !== filter) return false;
        const projectName = (p.title || p.name || '').toLowerCase();
        if (search && !projectName.includes(search.toLowerCase())) return false;
        return true;
    });

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await projectsApi.delete(id);
            refetchProjects();
        } catch (err) {
            alert(err?.message || 'Failed to delete project.');
        }
    };

    const handleSubmit = async (id, name) => {
        if (!window.confirm(`Submit "${name}" for admin review? It will be highlighted as a verified project on the Discover page.`)) return;
        try {
            await projectsApi.submit(id);
            refetchProjects();
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

    const handleReviewRequest = async (projectId, requestId, status) => {
        try {
            await projectsApi.reviewDeckRequest(projectId, requestId, status);
            refetchRequests();
        } catch (err) {
            alert(err?.message || `Failed to ${status.toLowerCase()} request.`);
        }
    };

    if (projectsLoading || requestsLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="page-content">
            <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                            <span className="page-title-block">My Projects</span>
                            <Link to="/dashboard/builder/new-project" className="hide-on-desktop" title="New Project" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary)', color: 'white', textDecoration: 'none', marginLeft: 'auto' }}>
                                <FolderPlus size={18} />
                            </Link>
                        </h1>
                        <p className="subtitle page-title-block">Manage and track all your ventures</p>
                    </div>
                    <Link to="/dashboard/builder/new-project" className="btn btn-primary hide-on-mobile" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                        <Plus size={18} style={{ marginRight: 8 }} /> Create Project
                    </Link>
                </div>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <div className="tabs">
                        <button
                            className={`tab ${view === 'projects' && filter === 'all' ? 'active' : ''}`}
                            onClick={() => { setView('projects'); setFilter('all'); }}
                        >
                            All Projects
                        </button>
                        <button
                            className={`tab ${view === 'projects' && filter === 'active' ? 'active' : ''}`}
                            onClick={() => { setView('projects'); setFilter('active'); }}
                        >
                            Active
                        </button>
                        <button
                            className={`tab ${view === 'projects' && filter === 'pending-review' ? 'active' : ''}`}
                            onClick={() => { setView('projects'); setFilter('pending-review'); }}
                        >
                            Pending Review
                        </button>
                        <button
                            className={`tab ${view === 'projects' && filter === 'draft' ? 'active' : ''}`}
                            onClick={() => { setView('projects'); setFilter('draft'); }}
                        >
                            Drafts
                        </button>
                        <button
                            className={`tab ${view === 'requests' ? 'active' : ''}`}
                            onClick={() => setView('requests')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            Deck Requests
                            {requestList.filter(r => r.status === 'PENDING').length > 0 && (
                                <span className="badge">{requestList.filter(r => r.status === 'PENDING').length}</span>
                            )}
                        </button>
                    </div>
                    {view === 'projects' && (
                        searchOpen ? (
                            <div className="search-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="text" placeholder="Search..." className="search-input" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                                <button className="search-toggle" onClick={() => { setSearchOpen(false); setSearch(''); }}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button className="search-toggle" onClick={() => setSearchOpen(true)}>
                                <Search size={16} />
                            </button>
                        )
                    )}
                </div>

                {view === 'projects' ? (
                    filteredProjects.length === 0 ? (
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
                                    {filteredProjects.map(project => {
                                        const raised = project.raised || 0;
                                        const goal = project.fundingGoal || 0;
                                        const pct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
                                        return (
                                            <tr key={project.id}>
                                                <td>
                                                    <Link to={`/project/${project.id}`} className="project-name-link">
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
                    )
                ) : (
                    requestList.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                            No deck requests yet. Requests from investors will appear here.
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="projects-table">
                                <thead>
                                    <tr>
                                        <th>Investor</th>
                                        <th>Project</th>
                                        <th>Message</th>
                                        <th>Date</th>
                                        <th style={{ textAlign: 'center' }}>Status</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requestList.map(req => {
                                        const name = req.investor?.profile?.name || 'Investor';
                                        const company = req.investor?.profile?.company || '';
                                        return (
                                            <tr key={req.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--color-gray-500)', fontSize: '0.8rem', overflow: 'hidden' }}>
                                                            {req.investor?.profile?.avatar ? (
                                                                <img src={req.investor?.profile?.avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                name.charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600 }}>{name}</div>
                                                            {company && <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{company}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td><span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>{req.project?.title || 'Unknown Project'}</span></td>
                                                <td style={{ maxWidth: '250px' }}>
                                                    {req.message ? (
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--color-gray-600)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic' }}>
                                                            "{req.message}"
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 font-italic text-sm">No message provided</span>
                                                    )}
                                                </td>
                                                <td className="text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`status-badge ${req.status.toLowerCase()}`}>{req.status}</span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {req.status === 'PENDING' ? (
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-bg)' }}
                                                                onClick={() => handleReviewRequest(req.projectId, req.id, 'APPROVED')}
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-bg)' }}
                                                                onClick={() => handleReviewRequest(req.projectId, req.id, 'DENIED')}
                                                            >
                                                                Deny
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            <style jsx>{`
                .project-name-link {
                    font-weight: 600;
                    color: var(--color-primary);
                    text-decoration: none;
                }
                :global([data-theme="dark"]) .project-name-link {
                    color: #0047AB !important;
                }
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }

                .card-container {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                    overflow: hidden;
                }

                .badge {
                    background: var(--color-primary);
                    color: white;
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 99px;
                    font-weight: 700;
                }

                .toolbar {
                    padding: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .tabs { display: flex; gap: 1rem; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .tab {
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    border: none;
                    background: none;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .tab.active { background: var(--color-gray-100); color: #F97316; font-weight: 600; }

                .search-input {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                    width: 180px;
                }
                .search-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: var(--radius-md);
                    border: 1px solid var(--color-gray-300);
                    background: none;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    flex-shrink: 0;
                }
                .search-toggle:hover {
                    background: var(--color-gray-100);
                    color: var(--color-gray-700);
                }

                .table-wrapper { overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch; }
                .projects-table { width: 100%; min-width: 700px; border-collapse: collapse; }

                .projects-table th {
                    text-align: left;
                    padding: 1rem;
                    background: var(--color-gray-50);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--color-gray-500);
                    font-weight: 600;
                    white-space: nowrap;
                }

                .projects-table td { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); font-size: 0.9rem; white-space: nowrap; }
                .projects-table tr:last-child td { border-bottom: none; }

                .status-badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
                .status-badge.active { background: var(--badge-success-bg); color: var(--badge-success-text); }
                .status-badge.draft { background: var(--badge-draft-bg); color: var(--badge-draft-text); }
                .status-badge.pending-review { background: var(--badge-warning-bg); color: var(--badge-warning-text); }
                .status-badge.pending { background: var(--badge-warning-bg); color: var(--badge-warning-text); }
                .status-badge.approved { background: var(--badge-success-bg); color: var(--badge-success-text); }
                .status-badge.denied { background: var(--badge-error-bg); color: var(--badge-error-text); }

                .progress-bar-sm { width: 100px; height: 4px; background: var(--color-gray-200); border-radius: 99px; margin-top: 4px; overflow: hidden; }
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
                    color: var(--color-gray-500);
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .action-menu-trigger:hover {
                    background: var(--color-gray-100);
                    border-color: var(--color-gray-200);
                    color: var(--color-gray-600);
                }

                .ctx-menu {
                    min-width: 190px;
                    background: var(--color-surface);
                    backdrop-filter: blur(12px);
                    border: 1px solid var(--color-gray-200);
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
                    color: var(--color-gray-600);
                    background: none;
                    border: none;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.08s;
                    white-space: nowrap;
                }
                .ctx-item:hover { background: var(--color-gray-100); }
                .ctx-item:first-child { border-radius: 8px 8px 0 0; }
                .ctx-item:last-child { border-radius: 0 0 8px 8px; }
                .ctx-submit { color: var(--color-primary, #0052cc); }
                .ctx-submit:hover { background: var(--color-blue-tint); }
                .ctx-delete { color: #ef4444; }
                .ctx-delete:hover { background: var(--color-red-tint); }

                .ctx-divider {
                    height: 1px;
                    background: var(--color-gray-200);
                    margin: 3px 0;
                }
            `}</style>
        </div >
    );
};

export default MyProjects;
