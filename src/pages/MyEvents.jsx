import React, { useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Plus, Edit, Trash2, ExternalLink, Loader2, MoreHorizontal, Copy, Check, ShieldCheck, Award, Globe, Lock, EyeOff, Users, UserCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { eventsApi } from '../services/api';
import { useApiQuery } from '../hooks/useApi';
import { getAssetUrl } from '../utils/assets';

const VISIBILITY_CFG = {
    PUBLIC: { label: 'Public', color: '#16a34a', bg: '#dcfce7', icon: <Globe size={12} /> },
    LIMITED_SPACES: { label: 'Limited Spaces', color: '#d97706', bg: '#fef3c7', icon: <Users size={12} /> },
    INVITE_ONLY: { label: 'Invite Only', color: '#7c3aed', bg: '#ede9fe', icon: <UserCheck size={12} /> },
    PRIVATE: { label: 'Private', color: '#dc2626', bg: '#fee2e2', icon: <Lock size={12} /> },
    DRAFT: { label: 'Draft', color: '#6b7280', bg: '#f3f4f6', icon: <EyeOff size={12} /> },
};

const VISIBILITY_OPTIONS = ['PUBLIC', 'LIMITED_SPACES', 'INVITE_ONLY', 'PRIVATE', 'DRAFT'];

const VisibilityBadge = ({ visibility }) => {
    const cfg = VISIBILITY_CFG[visibility] || VISIBILITY_CFG.DRAFT;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 99,
            fontSize: '0.72rem', fontWeight: 700,
            color: cfg.color, background: cfg.bg,
        }}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

const ActionMenu = ({ event, onDelete, onVisibilityChange, onCopyLink }) => {
    const [open, setOpen] = useState(false);
    const [showVisibility, setShowVisibility] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const navigate = useNavigate();

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!open && btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, left: rect.right });
        }
        setOpen(v => !v);
        setShowVisibility(false);
    };

    const close = () => { setOpen(false); setShowVisibility(false); };

    return (
        <>
            <button ref={btnRef} className="action-menu-trigger" onClick={handleToggle} title="Actions">
                <MoreHorizontal size={18} />
            </button>

            {open && ReactDOM.createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={close} />
                    <div className="ctx-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-100%)', zIndex: 9999 }}>
                        {!showVisibility ? (
                            <>
                                <button className="ctx-item" onClick={() => { close(); navigate(`/events/edit/${event.id}`); }}>
                                    <Edit size={15} /> Edit Event
                                </button>
                                <button className="ctx-item" onClick={() => { close(); navigate(`/events/${event.id}`); }}>
                                    <ExternalLink size={15} /> View Event
                                </button>
                                <button className="ctx-item" onClick={() => { setShowVisibility(true); }}>
                                    <Globe size={15} /> Change Visibility
                                </button>
                                {(event.visibility === 'PRIVATE' || event.visibility === 'INVITE_ONLY') && (
                                    <button className="ctx-item ctx-copy" onClick={() => { close(); onCopyLink(event.id); }}>
                                        <Copy size={15} /> Copy Event Link
                                    </button>
                                )}
                                <div className="ctx-divider" />
                                <button className="ctx-item ctx-delete" onClick={() => { close(); onDelete(event.id, event.title); }}>
                                    <Trash2 size={15} /> Delete
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="ctx-submenu-header">Change Visibility</div>
                                {VISIBILITY_OPTIONS.map(v => {
                                    const cfg = VISIBILITY_CFG[v];
                                    return (
                                        <button
                                            key={v}
                                            className={`ctx-item ctx-visibility ${event.visibility === v ? 'ctx-active' : ''}`}
                                            onClick={() => { close(); onVisibilityChange(event.id, v); }}
                                        >
                                            <span style={{ color: cfg.color }}>{cfg.icon}</span> {cfg.label}
                                            {event.visibility === v && <Check size={12} style={{ marginLeft: 'auto', color: cfg.color }} />}
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </>,
                document.body
            )}
        </>
    );
};

const MyEvents = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const { data: eventsData, loading, refetch } = useApiQuery(eventsApi.listMine);
    const eventList = eventsData?.data || eventsData || [];

    const filteredEvents = eventList.filter(e => {
        const vis = (e.visibility || 'DRAFT').toLowerCase();
        if (filter === 'published' && (vis === 'draft' || vis === 'private')) return false;
        if (filter === 'draft' && vis !== 'draft') return false;
        if (filter === 'private' && vis !== 'private') return false;
        if (search && !(e.title || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
        setActionLoading(id);
        try {
            await eventsApi.delete(id);
            refetch();
        } catch (err) {
            alert(err?.message || 'Failed to delete event.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleVisibilityChange = useCallback(async (id, newVisibility) => {
        setActionLoading(id);
        try {
            await eventsApi.update(id, { visibility: newVisibility });
            refetch();
        } catch {
            alert('Failed to update visibility.');
        } finally {
            setActionLoading(null);
        }
    }, [refetch]);

    const handleCopyLink = (id) => {
        const base = window.location.origin + (window.location.pathname.includes('/biestest') ? '/biestest' : '');
        navigator.clipboard.writeText(`${base}/events/${id}`);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDate = (d) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
        catch { return d; }
    };

    const categoryLabel = (c) => {
        if (!c) return '—';
        return c.replace(/_/g, ' ').split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}>
                            My Events
                            <Link to="/events/create" className="hide-on-desktop" title="Create Event" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-secondary)', color: 'white', textDecoration: 'none', marginLeft: 'auto' }}>
                                <Plus size={18} strokeWidth={2.5} />
                            </Link>
                        </h1>
                        <p className="subtitle">Manage and track all your events</p>
                    </div>
                    <Link to="/events/create" className="btn btn-primary hide-on-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', width: 250 }}>
                        <Plus size={18} style={{ marginRight: 8 }} />{' '}Create Event
                    </Link>
                </div>
            </div>

            <div className="card-container">
                <div className="toolbar">
                    <div className="tabs">
                        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                            All Events
                        </button>
                        <button className={`tab ${filter === 'published' ? 'active' : ''}`} onClick={() => setFilter('published')}>
                            Published
                        </button>
                        <button className={`tab ${filter === 'draft' ? 'active' : ''}`} onClick={() => setFilter('draft')}>
                            Drafts
                        </button>
                        <button className={`tab ${filter === 'private' ? 'active' : ''}`} onClick={() => setFilter('private')}>
                            Private
                        </button>
                    </div>
                    <div className="search-wrapper">
                        <input
                            type="text"
                            placeholder="Search events..."
                            className="search-input"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {filteredEvents.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>
                        {eventList.length === 0 ? 'No events yet. Create your first one!' : 'No events match your filter.'}
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="events-table">
                            <thead>
                                <tr>
                                    <th>Event Name</th>
                                    <th>Category</th>
                                    <th>Date</th>
                                    <th>Visibility</th>
                                    <th>Badges</th>
                                    <th>Attendees</th>
                                    <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.map(event => (
                                    <tr key={event.id} style={{ opacity: actionLoading === event.id ? 0.5 : 1 }}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {event.thumbnail && (
                                                    <img
                                                        src={getAssetUrl(event.thumbnail)}
                                                        alt=""
                                                        style={{ width: 36, height: 30, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                                                    />
                                                )}
                                                <div>
                                                    <Link to={`/events/${event.id}`} style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none' }}>
                                                        {event.title}
                                                    </Link>
                                                    {event.location && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', marginTop: 1 }}>{event.location}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--color-gray-600)', fontSize: '0.88rem' }}>
                                            {categoryLabel(event.category)}
                                        </td>
                                        <td style={{ color: 'var(--color-gray-500)', fontSize: '0.88rem' }}>
                                            {formatDate(event.startDate)}
                                        </td>
                                        <td>
                                            <VisibilityBadge visibility={event.visibility || 'DRAFT'} />
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {event.isOfficial && (
                                                    <span className="badge-sm badge-official"><ShieldCheck size={10} /> Official</span>
                                                )}
                                                {event.isEndorsed && (
                                                    <span className="badge-sm badge-endorsed"><Award size={10} /> Endorsed</span>
                                                )}
                                                {event.endorsementRequested && !event.isEndorsed && (
                                                    <span className="badge-sm badge-pending">Pending Review</span>
                                                )}
                                                {copiedId === event.id && (
                                                    <span className="badge-sm badge-copied"><Check size={10} /> Copied!</span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--color-gray-500)', fontSize: '0.88rem' }}>
                                            {event.attendeeCount || 0}
                                            {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <ActionMenu
                                                event={event}
                                                onDelete={handleDelete}
                                                onVisibilityChange={handleVisibilityChange}
                                                onCopyLink={handleCopyLink}
                                            />
                                        </td>
                                    </tr>
                                ))}
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
                    overflow: hidden;
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
                    width: 220px;
                    outline: none;
                }

                .table-wrapper { overflow-x: auto; overflow-y: visible; }
                .events-table { width: 100%; border-collapse: collapse; }

                .events-table th {
                    text-align: left;
                    padding: 1rem;
                    background: var(--color-gray-50);
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: var(--color-gray-500);
                    font-weight: 600;
                }

                .events-table td { padding: 1rem; border-bottom: 1px solid var(--color-gray-100); font-size: 0.9rem; vertical-align: middle; }
                .events-table tr:last-child td { border-bottom: none; }

                .badge-sm {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    padding: 2px 7px;
                    border-radius: 99px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    white-space: nowrap;
                }
                .badge-official { background: var(--color-secondary); color: white; }
                .badge-endorsed { background: #fef3c7; color: #d97706; }
                .badge-pending { background: #f3f4f6; color: #6b7280; }
                .badge-copied { background: #dcfce7; color: #16a34a; }
            `}</style>

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
                .ctx-submenu-header {
                    padding: 0.4rem 0.85rem;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #9ca3af;
                    letter-spacing: 0.04em;
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
                .ctx-copy { color: #1d4ed8; }
                .ctx-copy:hover { background: #eff6ff; }
                .ctx-active { font-weight: 700; }
                .ctx-delete { color: #ef4444; }
                .ctx-delete:hover { background: #fef2f2; }
                .ctx-divider { height: 1px; background: #e5e7eb; margin: 3px 0; }
            `}</style>
        </div>
    );
};

export default MyEvents;
