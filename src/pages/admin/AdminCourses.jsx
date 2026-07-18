import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Star, ExternalLink, Trash2, Loader2, Search } from 'lucide-react';
import { adminApi } from '../../services/api';

const STATUS_TABS = [
    { key: 'pending-review', label: 'Pending Review' },
    { key: 'active', label: 'Active' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'draft', label: 'Draft' },
    { key: '', label: 'All' },
];

const AdminCourses = () => {
    const [tab, setTab] = useState('pending-review');
    const [search, setSearch] = useState('');
    const [courses, setCourses] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchCourses = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (tab) params.status = tab;
            if (search) params.search = search;
            const res = await adminApi.listCourses(params);
            setCourses(Array.isArray(res?.data) ? res.data : []);
            setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Failed to fetch courses:', err);
        } finally {
            setLoading(false);
        }
    }, [tab, search]);

    useEffect(() => { fetchCourses(1); }, [fetchCourses]);

    const handleApprove = async (id) => {
        if (!window.confirm('Are you sure you want to approve this course?')) return;
        setActionLoading(id);
        try {
            await adminApi.reviewCourse(id, 'approve');
            fetchCourses(pagination.page);
        } catch (err) {
            alert(err?.data?.error || 'Failed to approve course');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id) => {
        const note = window.prompt('Rejection note for the author (optional):');
        if (note === null) return;
        setActionLoading(id);
        try {
            await adminApi.reviewCourse(id, 'reject', note.trim() || undefined);
            fetchCourses(pagination.page);
        } catch (err) {
            alert(err?.data?.error || 'Failed to reject course');
        } finally {
            setActionLoading(null);
        }
    };

    const handleFeature = async (id, currentFeatured) => {
        setActionLoading(id);
        try {
            await adminApi.featureCourse(id, !currentFeatured);
            fetchCourses(pagination.page);
        } catch (err) {
            alert(err?.data?.error || 'Failed to update featured status');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
        setActionLoading(id);
        try {
            await adminApi.deleteCourse(id);
            fetchCourses(pagination.page);
        } catch (err) {
            alert(err?.data?.error || 'Failed to delete course');
        } finally {
            setActionLoading(null);
        }
    };

    const statusBadge = (status) => {
        const cls = (status || 'draft').replace(' ', '-').toLowerCase();
        const label = status === 'pending-review' ? 'Pending' : (status || 'Draft');
        return <span className={`status-badge ${cls}`}>{label}</span>;
    };

    const priceLabel = (priceSats) => (
        priceSats > 0 ? `${Number(priceSats).toLocaleString()} sats` : 'Free'
    );

    return (
        <>
            <div className="header">
                <div>
                    <h1>Course Management</h1>
                    <p className="subtitle">Review and manage community courses</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="tabs">
                    {STATUS_TABS.map(t => (
                        <button
                            key={t.key}
                            className={`tab ${tab === t.key ? 'active' : ''}`}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="filters-right">
                    <div className="search-wrap">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : courses.length === 0 ? (
                <div className="empty-state">
                    <p>No courses found{tab ? ` with status "${tab}"` : ''}.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Course</th>
                                <th>Author</th>
                                <th>Price</th>
                                <th>Lessons</th>
                                <th>Students</th>
                                <th>Status</th>
                                <th>Featured</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.map(c => (
                                <tr key={c.id}>
                                    <td className="font-semibold">{c.title}</td>
                                    <td data-label="Author">
                                        <div className="author-cell">
                                            <span>{c.author?.profile?.name || '—'}</span>
                                            {c.author?.email && (
                                                <span className="author-email">{c.author.email}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td data-label="Price">
                                        <span className={`price-chip ${c.priceSats > 0 ? 'paid' : 'free'}`}>
                                            {priceLabel(c.priceSats)}
                                        </span>
                                    </td>
                                    <td data-label="Lessons">{c.lessonCount ?? 0}</td>
                                    <td data-label="Students">{c.studentCount ?? 0}</td>
                                    <td data-label="Status">{statusBadge(c.status)}</td>
                                    <td data-label="Featured">
                                        {c.status === 'active' ? (
                                            <button
                                                className={`icon-btn ${c.isFeatured ? 'featured-active' : ''}`}
                                                onClick={() => handleFeature(c.id, c.isFeatured)}
                                                title={c.isFeatured ? 'Unfeature' : 'Feature'}
                                                disabled={actionLoading === c.id}
                                            >
                                                <Star size={16} fill={c.isFeatured ? 'currentColor' : 'none'} />
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td data-label="Created" className="mobile-hide">{new Date(c.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-group">
                                            {c.status === 'pending-review' && (
                                                <>
                                                    <button
                                                        className="icon-btn approve"
                                                        onClick={() => handleApprove(c.id)}
                                                        title="Approve"
                                                        disabled={actionLoading === c.id}
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        className="icon-btn reject"
                                                        onClick={() => handleReject(c.id)}
                                                        title="Reject"
                                                        disabled={actionLoading === c.id}
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                </>
                                            )}
                                            <Link to={`/courses/${c.id}`} className="icon-btn" title="View">
                                                <ExternalLink size={16} />
                                            </Link>
                                            <button
                                                className="icon-btn delete"
                                                onClick={() => handleDelete(c.id, c.title)}
                                                title="Delete"
                                                disabled={actionLoading === c.id}
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
                        onClick={() => fetchCourses(pagination.page - 1)}
                    >Previous</button>
                    <span>Page {pagination.page} of {pagination.totalPages}</span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchCourses(pagination.page + 1)}
                    >Next</button>
                </div>
            )}

            <style jsx>{`
                .header {
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 1rem;
                    flex-wrap: wrap;
                }
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
                    white-space: nowrap;
                }
                .tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
                .filters-right { display: flex; gap: 0.5rem; align-items: center; }
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
                .author-cell { display: flex; flex-direction: column; }
                .author-email { font-size: 0.75rem; color: var(--color-gray-400); }
                .price-chip {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .price-chip.free { background: var(--color-green-tint); color: var(--badge-success-text); }
                .price-chip.paid { background: var(--color-amber-tint); color: var(--badge-warning-text); }
                .status-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-badge.active { background: var(--color-green-tint); color: var(--badge-success-text); }
                .status-badge.draft { background: var(--badge-draft-bg); color: var(--color-gray-600); }
                .status-badge.pending-review { background: var(--color-amber-tint); color: var(--badge-warning-text); }
                .status-badge.rejected { background: var(--color-red-tint); color: #dc2626; }
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
                    .header h1 { font-size: 1.25rem; }
                    .toolbar { flex-direction: column; align-items: stretch; }
                    .tabs { overflow-x: auto; scrollbar-width: none; }
                    .tabs::-webkit-scrollbar { display: none; }
                    .filters-right { flex-direction: column; align-items: stretch; }
                    .search-wrap { display: flex; }
                    .search-wrap input { width: 100%; }
                    .table-container { background: none; box-shadow: none; overflow: visible; }
                    .data-table,
                    .data-table thead,
                    .data-table tbody,
                    .data-table tr,
                    .data-table th,
                    .data-table td { display: block; }
                    .data-table thead { display: none; }
                    .data-table tr {
                        background: var(--color-surface);
                        border: 1px solid var(--color-gray-200);
                        border-radius: var(--radius-lg);
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                    }
                    .data-table td {
                        display: flex;
                        align-items: center;
                        padding: 0.3rem 0;
                        border-bottom: none;
                        gap: 0.5rem;
                    }
                    .data-table td::before {
                        content: attr(data-label);
                        font-weight: 600;
                        font-size: 0.7rem;
                        color: var(--color-gray-400);
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        min-width: 72px;
                        flex-shrink: 0;
                    }
                    .data-table td:first-child {
                        font-size: 1rem;
                        font-weight: 600;
                        padding-bottom: 0.5rem;
                        margin-bottom: 0.25rem;
                        border-bottom: 1px solid var(--color-gray-100);
                    }
                    .data-table td:first-child::before { display: none; }
                    .data-table td.mobile-hide { display: none; }
                    .data-table td:last-child {
                        padding-top: 0.5rem;
                        margin-top: 0.25rem;
                        border-top: 1px solid var(--color-gray-100);
                    }
                    .data-table td:last-child::before { display: none; }
                    .action-group { gap: 0.5rem; }
                    .icon-btn { padding: 0.5rem; }
                }
            `}</style>
        </>
    );
};

export default AdminCourses;
