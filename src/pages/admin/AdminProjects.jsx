import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Star, ExternalLink, Trash2, Loader2, Search } from 'lucide-react';
import { adminApi } from '../../services/api';

const TABS = [
    { key: 'pending-review', label: 'Pending Review' },
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: '', label: 'All' },
];

const AdminProjects = () => {
    const [tab, setTab] = useState('pending-review');
    const [search, setSearch] = useState('');
    const [projects, setProjects] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchProjects = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (tab) params.status = tab;
            if (search) params.search = search;
            const res = await adminApi.listProjects(params);
            setProjects(res?.data || []);
            setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        } finally {
            setLoading(false);
        }
    }, [tab, search]);

    useEffect(() => { fetchProjects(1); }, [fetchProjects]);

    const handleReview = async (id, action) => {
        const label = action === 'approve' ? 'approve' : 'reject';
        if (!window.confirm(`Are you sure you want to ${label} this project?`)) return;
        setActionLoading(id);
        try {
            await adminApi.reviewProject(id, action);
            fetchProjects(pagination.page);
        } catch (err) {
            alert(`Failed to ${label} project`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleFeature = async (id, currentFeatured) => {
        setActionLoading(id);
        try {
            await adminApi.featureProject(id, !currentFeatured);
            fetchProjects(pagination.page);
        } catch (err) {
            alert('Failed to update featured status');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
        setActionLoading(id);
        try {
            await adminApi.deleteProject(id);
            fetchProjects(pagination.page);
        } catch (err) {
            alert('Failed to delete project');
        } finally {
            setActionLoading(null);
        }
    };

    const statusBadge = (status) => {
        const cls = (status || 'draft').replace(' ', '-').toLowerCase();
        const label = status === 'pending-review' ? 'Pending' : (status || 'Draft');
        return <span className={`status-badge ${cls}`}>{label}</span>;
    };

    return (
        <>
            <div className="header">
                <div>
                    <h1>Project Management</h1>
                    <p className="subtitle">Review and manage project submissions</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="tabs">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            className={`tab ${tab === t.key ? 'active' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="search-wrap">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : projects.length === 0 ? (
                <div className="empty-state">
                    <p>No projects found{tab ? ` with status "${tab}"` : ''}.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Project</th>
                                <th>Owner</th>
                                <th>Category</th>
                                <th>Status</th>
                                <th>Featured</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(p => (
                                <tr key={p.id}>
                                    <td className="font-semibold">{p.title}</td>
                                    <td>{p.owner?.profile?.name || p.owner?.email || '—'}</td>
                                    <td>{p.category}</td>
                                    <td>{statusBadge(p.status)}</td>
                                    <td>
                                        <button
                                            className={`icon-btn ${p.isFeatured ? 'featured-active' : ''}`}
                                            onClick={() => handleFeature(p.id, p.isFeatured)}
                                            title={p.isFeatured ? 'Unfeature' : 'Feature'}
                                            disabled={actionLoading === p.id}
                                        >
                                            <Star size={16} fill={p.isFeatured ? 'currentColor' : 'none'} />
                                        </button>
                                    </td>
                                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-group">
                                            {p.status === 'pending-review' && (
                                                <>
                                                    <button
                                                        className="icon-btn approve"
                                                        onClick={() => handleReview(p.id, 'approve')}
                                                        title="Approve"
                                                        disabled={actionLoading === p.id}
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        className="icon-btn reject"
                                                        onClick={() => handleReview(p.id, 'reject')}
                                                        title="Reject"
                                                        disabled={actionLoading === p.id}
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            )}
                                            <Link to={`/project/${p.id}`} className="icon-btn" title="View">
                                                <ExternalLink size={16} />
                                            </Link>
                                            <button
                                                className="icon-btn delete"
                                                onClick={() => handleDelete(p.id, p.title)}
                                                title="Delete"
                                                disabled={actionLoading === p.id}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pagination.totalPages > 1 && (
                <div className="pagination">
                    <button
                        disabled={pagination.page <= 1}
                        onClick={() => fetchProjects(pagination.page - 1)}
                    >Previous</button>
                    <span>Page {pagination.page} of {pagination.totalPages}</span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchProjects(pagination.page + 1)}
                    >Next</button>
                </div>
            )}

            <style jsx>{`
                .header { margin-bottom: 1.5rem; }
                .subtitle { color: var(--color-gray-500); }
                .toolbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
                .tabs { display: flex; gap: 0.5rem; }
                .tab {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    cursor: pointer;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    transition: all 0.15s;
                }
                .tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
                .search-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    padding: 0.5rem 0.75rem;
                    color: var(--color-gray-400);
                }
                .search-wrap input {
                    border: none;
                    outline: none;
                    font-size: 0.875rem;
                    background: transparent;
                    width: 200px;
                }
                .empty-state {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    padding: 3rem;
                    text-align: center;
                    color: var(--color-gray-500);
                    border: 1px solid var(--color-gray-200);
                }
                .table-container {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    overflow-x: auto;
                }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th {
                    text-align: left;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    color: var(--color-gray-500);
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .data-table td {
                    padding: 0.875rem 1.25rem;
                    border-bottom: 1px solid var(--color-gray-100);
                    font-size: 0.9rem;
                }
                .data-table tr:last-child td { border-bottom: none; }
                .font-semibold { font-weight: 600; }
                .status-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-badge.active { background: var(--color-green-tint); color: #166534; }
                .status-badge.draft { background: var(--badge-draft-bg); color: var(--color-gray-600); }
                .status-badge.pending-review { background: var(--color-amber-tint); color: #854D0E; }
                .action-group { display: flex; gap: 0.25rem; align-items: center; }
                .icon-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0.4rem;
                    border-radius: var(--radius-md);
                    border: none;
                    background: none;
                    cursor: pointer;
                    color: var(--color-gray-400);
                    transition: all 0.15s;
                    text-decoration: none;
                }
                .icon-btn:hover { background: var(--color-gray-100); color: var(--color-neutral-dark); }
                .icon-btn.approve { color: #16a34a; }
                .icon-btn.approve:hover { background: var(--color-green-tint); }
                .icon-btn.reject { color: #dc2626; }
                .icon-btn.reject:hover { background: var(--color-red-tint); }
                .icon-btn.delete { color: #dc2626; }
                .icon-btn.delete:hover { background: var(--color-red-tint); }
                .icon-btn.featured-active { color: #eab308; }
                .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 1rem;
                    margin-top: 1.5rem;
                }
                .pagination button {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    cursor: pointer;
                    font-size: 0.875rem;
                }
                .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination span { font-size: 0.875rem; color: var(--color-gray-500); }
                @media (max-width: 768px) {
                    .toolbar { flex-direction: column; align-items: stretch; }
                    .tabs { overflow-x: auto; }
                }
            `}</style>
        </>
    );
};

export default AdminProjects;
