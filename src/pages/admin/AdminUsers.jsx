import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Ban, ExternalLink, Loader2, Search, Shield } from 'lucide-react';
import { adminApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = ['', 'BUILDER', 'INVESTOR', 'ADMIN'];

const AdminUsers = () => {
    const { isMasterAdmin } = useAuth();
    const [roleFilter, setRoleFilter] = useState('');
    const [bannedFilter, setBannedFilter] = useState('');
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchUsers = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (roleFilter) params.role = roleFilter;
            if (bannedFilter) params.banned = bannedFilter;
            if (search) params.search = search;
            const res = await adminApi.users(params);
            setUsers(res?.data || []);
            setPagination(res?.pagination || { page: 1, total: 0, totalPages: 1 });
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    }, [roleFilter, bannedFilter, search]);

    useEffect(() => { fetchUsers(1); }, [fetchUsers]);

    const handleBan = async (id, currentBanned, name) => {
        const action = currentBanned ? 'unban' : 'ban';
        if (!window.confirm(`Are you sure you want to ${action} ${name || 'this user'}? ${!currentBanned ? 'This will also remove their npub from the relay whitelist.' : 'This will restore their relay access.'}`)) return;
        setActionLoading(id);
        try {
            await adminApi.banUser(id, !currentBanned);
            fetchUsers(pagination.page);
        } catch (err) {
            alert(`Failed to ${action} user`);
        } finally {
            setActionLoading(null);
        }
    };

    const handleVerify = async (id) => {
        setActionLoading(id);
        try {
            await adminApi.verifyUser(id);
            fetchUsers(pagination.page);
        } catch (err) {
            alert('Failed to verify user');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRoleChange = async (id, newRole) => {
        if (!window.confirm(`Change role to ${newRole}?`)) return;
        setActionLoading(id);
        try {
            await adminApi.setRole(id, newRole);
            fetchUsers(pagination.page);
        } catch (err) {
            alert('Failed to change role');
        } finally {
            setActionLoading(null);
        }
    };

    const roleBadge = (role) => {
        const cls = (role || '').toLowerCase();
        return <span className={`role-badge ${cls}`}>{role}</span>;
    };

    const truncatePubkey = (pk) => pk ? `${pk.substring(0, 8)}...${pk.substring(pk.length - 4)}` : '—';

    return (
        <>
            <div className="header">
                <div>
                    <h1>User Management</h1>
                    <p className="subtitle">Manage platform users and access</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="filters">
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="filter-select">
                        <option value="">All Roles</option>
                        {ROLE_OPTIONS.filter(Boolean).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={bannedFilter} onChange={(e) => setBannedFilter(e.target.value)} className="filter-select">
                        <option value="">All Status</option>
                        <option value="true">Banned</option>
                        <option value="false">Active</option>
                    </select>
                </div>
                <div className="search-wrap">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
            ) : users.length === 0 ? (
                <div className="empty-state"><p>No users found.</p></div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Npub</th>
                                <th>Role</th>
                                <th>Projects</th>
                                <th>Verified</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className={u.isBanned ? 'row-banned' : ''}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {u.profile?.avatar ? (
                                                <img src={u.profile.avatar} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--color-gray-500)' }}>
                                                    {(u.profile?.name || '?')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-semibold">{u.profile?.name || '—'}</span>
                                        </div>
                                    </td>
                                    <td>{u.email || '—'}</td>
                                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{truncatePubkey(u.nostrPubkey)}</td>
                                    <td>
                                        <select
                                            value={u.role}
                                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            disabled={actionLoading === u.id || (u.role === 'ADMIN' && !isMasterAdmin)}
                                            className="role-select"
                                            title={u.role === 'ADMIN' && !isMasterAdmin ? 'Only master admins can change admin roles' : ''}
                                        >
                                            <option value="BUILDER">BUILDER</option>
                                            <option value="INVESTOR">INVESTOR</option>
                                            {isMasterAdmin && <option value="ADMIN">ADMIN</option>}
                                            {!isMasterAdmin && u.role === 'ADMIN' && <option value="ADMIN">ADMIN</option>}
                                        </select>
                                    </td>
                                    <td>{u._count?.projects || 0}</td>
                                    <td>
                                        {u.isVerified ? (
                                            <CheckCircle size={16} style={{ color: '#16a34a' }} />
                                        ) : (
                                            <button
                                                className="icon-btn approve"
                                                onClick={() => handleVerify(u.id)}
                                                title="Verify user"
                                                disabled={actionLoading === u.id}
                                            >
                                                <Shield size={16} />
                                            </button>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${u.isBanned ? 'banned' : 'active'}`}>
                                            {u.isBanned ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-group">
                                            <button
                                                className={`icon-btn ${u.isBanned ? 'approve' : 'delete'}`}
                                                onClick={() => handleBan(u.id, u.isBanned, u.profile?.name)}
                                                title={u.role === 'ADMIN' && !isMasterAdmin ? 'Only master admins can ban other admins' : u.isBanned ? 'Unban (restore relay access)' : 'Ban (remove from relay whitelist)'}
                                                disabled={actionLoading === u.id || (u.role === 'ADMIN' && !isMasterAdmin)}
                                            >
                                                <Ban size={16} />
                                            </button>
                                            <Link
                                                to={`/${u.role === 'INVESTOR' ? 'investor' : 'builder'}/${u.id}`}
                                                className="icon-btn"
                                                title="View profile"
                                            >
                                                <ExternalLink size={16} />
                                            </Link>
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
                    <button disabled={pagination.page <= 1} onClick={() => fetchUsers(pagination.page - 1)}>Previous</button>
                    <span>Page {pagination.page} of {pagination.totalPages}</span>
                    <button disabled={pagination.page >= pagination.totalPages} onClick={() => fetchUsers(pagination.page + 1)}>Next</button>
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
                .filters { display: flex; gap: 0.5rem; }
                .filter-select {
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: white;
                    font-size: 0.875rem;
                    color: var(--color-gray-600);
                    cursor: pointer;
                }
                .search-wrap {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: white;
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
                    width: 220px;
                }
                .empty-state {
                    background: white;
                    border-radius: var(--radius-lg);
                    padding: 3rem;
                    text-align: center;
                    color: var(--color-gray-500);
                    border: 1px solid var(--color-gray-200);
                }
                .table-container {
                    background: white;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    overflow-x: auto;
                }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th {
                    text-align: left;
                    padding: 1rem 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    color: var(--color-gray-500);
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    white-space: nowrap;
                }
                .data-table td {
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid var(--color-gray-100);
                    font-size: 0.875rem;
                }
                .data-table tr:last-child td { border-bottom: none; }
                .row-banned { background: #FEF2F2; }
                .font-semibold { font-weight: 600; }
                .role-select {
                    padding: 0.25rem 0.5rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    font-size: 0.8rem;
                    background: white;
                    cursor: pointer;
                }
                .status-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .status-badge.active { background: #DCFCE7; color: #166534; }
                .status-badge.banned { background: #FEE2E2; color: #991B1B; }
                .role-badge {
                    display: inline-block;
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 99px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                .role-badge.admin { background: #EDE9FE; color: #5B21B6; }
                .role-badge.builder { background: #DBEAFE; color: #1E40AF; }
                .role-badge.investor { background: #FEF3C7; color: #92400E; }
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
                .icon-btn.approve:hover { background: #DCFCE7; }
                .icon-btn.delete { color: #dc2626; }
                .icon-btn.delete:hover { background: #FEE2E2; }
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
                    background: white;
                    cursor: pointer;
                    font-size: 0.875rem;
                }
                .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
                .pagination span { font-size: 0.875rem; color: var(--color-gray-500); }
                @media (max-width: 768px) {
                    .toolbar { flex-direction: column; align-items: stretch; }
                }
            `}</style>
        </>
    );
};

export default AdminUsers;
