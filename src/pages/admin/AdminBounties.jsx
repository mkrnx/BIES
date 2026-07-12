import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, ExternalLink, Trash2, Loader2, Zap, Trophy } from 'lucide-react';
import { adminApi } from '../../services/api';

const STATUS_TABS = ['', 'OPEN', 'AWARDED', 'PAID', 'EXPIRED', 'CANCELLED'];

const TYPE_OPTIONS = ['', 'SATS', 'POINTS'];

const AdminBounties = () => {
    const { t } = useTranslation();
    const [tab, setTab] = useState('');
    const [type, setType] = useState('');
    const [bounties, setBounties] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchBounties = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (tab) params.status = tab;
            if (type) params.rewardType = type;
            const res = await adminApi.listBounties(params);
            setBounties(Array.isArray(res?.data) ? res.data : []);
            setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Failed to fetch bounties:', err);
        } finally {
            setLoading(false);
        }
    }, [tab, type]);

    useEffect(() => { fetchBounties(1); }, [fetchBounties]);

    const handleFeature = async (id, currentFeatured) => {
        setActionLoading(id);
        try {
            await adminApi.featureBounty(id, !currentFeatured);
            fetchBounties(pagination.page);
        } catch (err) {
            alert(t('admin.bounties.featureFailed'));
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (b) => {
        // Deleting an OPEN points bounty releases the escrow back to the poster
        const refundsEscrow = b.rewardType === 'POINTS' && b.status === 'OPEN';
        const confirmMsg = refundsEscrow
            ? t('admin.bounties.deleteConfirmRefund', { title: b.title, amount: b.amount })
            : t('admin.bounties.deleteConfirm', { title: b.title });
        if (!window.confirm(confirmMsg)) return;
        setActionLoading(b.id);
        try {
            await adminApi.deleteBounty(b.id);
            fetchBounties(pagination.page);
        } catch (err) {
            alert(t('admin.bounties.deleteFailed'));
        } finally {
            setActionLoading(null);
        }
    };

    const statusBadge = (status) => (
        <span className={`status-badge ${(status || '').toLowerCase()}`}>
            {t(`bounties.status.${(status || '').toLowerCase()}`)}
        </span>
    );

    return (
        <>
            <div className="header">
                <div>
                    <h1>{t('admin.bounties.title')}</h1>
                    <p className="subtitle">{t('admin.bounties.subtitle')}</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="tabs">
                    {STATUS_TABS.map(key => (
                        <button
                            key={key || 'all'}
                            className={`tab ${tab === key ? 'active' : ''}`}
                            onClick={() => setTab(key)}
                        >
                            {key ? t(`bounties.status.${key.toLowerCase()}`) : t('admin.bounties.tabAll')}
                        </button>
                    ))}
                </div>
                <select
                    className="type-select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                >
                    {TYPE_OPTIONS.map(key => (
                        <option key={key || 'all'} value={key}>
                            {key ? t(`admin.bounties.type${key === 'SATS' ? 'Sats' : 'Points'}`) : t('admin.bounties.typeAll')}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : bounties.length === 0 ? (
                <div className="empty-state">
                    <p>{t('admin.bounties.empty')}</p>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('admin.bounties.colTitle')}</th>
                                <th>{t('admin.bounties.colPoster')}</th>
                                <th>{t('admin.bounties.colType')}</th>
                                <th>{t('admin.bounties.colAmount')}</th>
                                <th>{t('admin.bounties.colStatus')}</th>
                                <th>{t('admin.bounties.colFeatured')}</th>
                                <th>{t('admin.bounties.colCreated')}</th>
                                <th>{t('admin.bounties.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bounties.map(b => (
                                <tr key={b.id}>
                                    <td className="font-semibold">{b.title}</td>
                                    <td data-label={t('admin.bounties.colPoster')}>
                                        {b.poster?.profile?.name || b.poster?.email || '—'}
                                    </td>
                                    <td data-label={t('admin.bounties.colType')}>
                                        <span className={`type-chip ${b.rewardType === 'SATS' ? 'sats' : 'points'}`}>
                                            {b.rewardType === 'SATS' ? <Zap size={11} /> : <Trophy size={11} />}
                                            {b.rewardType === 'SATS' ? t('admin.bounties.typeSats') : t('admin.bounties.typePoints')}
                                        </span>
                                    </td>
                                    <td data-label={t('admin.bounties.colAmount')} className="amount-cell">
                                        {Number(b.amount).toLocaleString()}
                                    </td>
                                    <td data-label={t('admin.bounties.colStatus')}>{statusBadge(b.status)}</td>
                                    <td data-label={t('admin.bounties.colFeatured')}>
                                        <button
                                            className={`icon-btn ${b.featured ? 'featured-active' : ''}`}
                                            onClick={() => handleFeature(b.id, b.featured)}
                                            title={b.featured ? t('admin.bounties.unfeature') : t('admin.bounties.feature')}
                                            disabled={actionLoading === b.id}
                                        >
                                            <Star size={16} fill={b.featured ? 'currentColor' : 'none'} />
                                        </button>
                                    </td>
                                    <td data-label={t('admin.bounties.colCreated')} className="mobile-hide">
                                        {new Date(b.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="action-group">
                                            <Link to={`/bounties/${b.id}`} className="icon-btn" title={t('admin.bounties.view')}>
                                                <ExternalLink size={16} />
                                            </Link>
                                            <button
                                                className="icon-btn delete"
                                                onClick={() => handleDelete(b)}
                                                title={t('admin.bounties.delete')}
                                                disabled={actionLoading === b.id}
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
                        onClick={() => fetchBounties(pagination.page - 1)}
                    >{t('common.previous')}</button>
                    <span>{t('common.page', { current: pagination.page, total: pagination.totalPages })}</span>
                    <button
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchBounties(pagination.page + 1)}
                    >{t('common.next')}</button>
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
                .type-select {
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    color: var(--color-gray-600);
                    font-size: 0.875rem;
                    cursor: pointer;
                    outline: none;
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
                .type-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .type-chip.sats { background: rgba(247, 147, 26, 0.12); color: #b45309; }
                .type-chip.points { background: var(--color-blue-tint); color: var(--color-primary); }
                .status-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-badge.open { background: var(--color-green-tint); color: var(--badge-success-text); }
                .status-badge.awarded { background: var(--color-amber-tint); color: var(--badge-warning-text); }
                .status-badge.paid { background: var(--color-blue-tint); color: var(--color-primary); }
                .status-badge.expired { background: var(--badge-draft-bg); color: var(--color-gray-600); }
                .status-badge.cancelled { background: var(--color-red-tint); color: #dc2626; }
                .amount-cell { font-weight: 600; font-variant-numeric: tabular-nums; }
                .action-group { display: flex; gap: 0.25rem; align-items: center; }
                /* :global so the view Link (a composite component) is styled too */
                .data-table :global(.icon-btn) {
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
                .data-table :global(.icon-btn:hover) { background: var(--color-gray-100); color: var(--color-neutral-dark); }
                .data-table :global(.icon-btn.delete) { color: #dc2626; }
                .data-table :global(.icon-btn.delete:hover) { background: var(--color-red-tint); }
                .data-table :global(.icon-btn.featured-active) { color: #eab308; }
                .data-table :global(.icon-btn:disabled) { opacity: 0.5; cursor: not-allowed; }
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
                    .data-table :global(.icon-btn) { padding: 0.5rem; }
                }
            `}</style>
        </>
    );
};

export default AdminBounties;
