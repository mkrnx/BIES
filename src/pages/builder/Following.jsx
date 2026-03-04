import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Briefcase, Folder, Loader2, UserMinus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { profilesApi, watchlistApi } from '../../services/api';

const TABS = [
    { key: 'projects', label: 'Projects', icon: Folder },
    { key: 'builders', label: 'Builders', icon: Users },
    { key: 'investors', label: 'Investors', icon: Briefcase },
];

const Following = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('projects');
    const [following, setFollowing] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;
        const load = async () => {
            setLoading(true);
            try {
                const [followRes, wlRes] = await Promise.all([
                    profilesApi.getFollowing(user.id, { limit: 50 }),
                    watchlistApi.list(),
                ]);
                setFollowing(followRes?.data || followRes || []);
                setWatchlist(wlRes?.data || wlRes || []);
            } catch (err) {
                console.error('Failed to load following:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user?.id]);

    const categoryLabel = (c) => {
        if (!c) return '—';
        const special = { SAAS: 'SaaS', ECOMMERCE: 'E-Commerce', WEB3: 'Web3', REAL_ESTATE: 'Real Estate' };
        if (special[c]) return special[c];
        return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
    };

    const handleUnfollow = async (id) => {
        try {
            await profilesApi.unfollow(id);
            setFollowing(prev => prev.filter(u => u.id !== id));
        } catch (err) {
            alert('Failed to unfollow');
        }
    };

    const handleRemoveWatchlist = async (projectId) => {
        try {
            await watchlistApi.remove(projectId);
            setWatchlist(prev => prev.filter(item => {
                const pid = item.project?.id || item.projectId || item.id;
                return pid !== projectId;
            }));
        } catch (err) {
            alert('Failed to remove from watchlist');
        }
    };

    const builders = following.filter(u => u.role === 'BUILDER');
    const investors = following.filter(u => u.role === 'INVESTOR');

    const renderProjects = () => {
        if (watchlist.length === 0) {
            return (
                <div className="flw-empty">
                    <Folder size={40} />
                    <p>You're not following any projects yet.</p>
                    <Link to="/discover" className="flw-btn-link">Discover Projects</Link>
                </div>
            );
        }
        return (
            <div className="flw-grid">
                {watchlist.map(item => {
                    const project = item.project || item;
                    return (
                        <div key={item.id || project.id} className="flw-card">
                            <div className="flw-card-top">
                                <div className="flw-avatar project">
                                    {project.thumbnail ? (
                                        <img src={project.thumbnail} alt={project.title || project.name} />
                                    ) : (
                                        <Folder size={20} />
                                    )}
                                </div>
                                <div className="flw-info">
                                    <div>
                                        <Link to={`/project/${project.id}`} className="flw-name">{project.title || project.name || 'Untitled'}</Link>
                                        <span className="flw-sub">{categoryLabel(project.category)} · {project.stage || 'Draft'}</span>
                                    </div>
                                </div>
                            </div>
                            <button className="flw-unfollow" onClick={() => handleRemoveWatchlist(project.id)}>
                                <UserMinus size={14} /> Unfollow
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderUsers = (list, type) => {
        if (list.length === 0) {
            return (
                <div className="flw-empty">
                    <Users size={40} />
                    <p>You're not following any {type.toLowerCase()} yet.</p>
                    <Link to={type === 'Builders' ? '/builders' : '/investors'} className="flw-btn-link">Browse {type}</Link>
                </div>
            );
        }
        return (
            <div className="flw-grid">
                {list.map(person => (
                    <div key={person.id} className="flw-card">
                        <div className="flw-card-top">
                            <div className="flw-avatar">
                                {person.profile?.avatar ? (
                                    <img src={person.profile.avatar} alt={person.profile?.name} />
                                ) : (
                                    <span>{(person.profile?.name || '?')[0]?.toUpperCase()}</span>
                                )}
                            </div>
                            <div className="flw-info">
                                <Link to={`/${person.role === 'BUILDER' ? 'builder' : 'investor'}/${person.id}`} className="flw-name">
                                    {person.profile?.name || 'Unknown'}
                                </Link>
                                <span className="flw-sub">{person.profile?.company || person.role}</span>
                            </div>
                        </div>
                        <button className="flw-unfollow" onClick={() => handleUnfollow(person.id)}>
                            <UserMinus size={14} /> Unfollow
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <>
            <div className="flw-header">
                <h1>Following</h1>
                <p className="flw-subtitle">People and projects you're keeping track of</p>
            </div>

            <div className="flw-tabs">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const count = tab.key === 'projects' ? watchlist.length
                        : tab.key === 'builders' ? builders.length
                            : investors.length;
                    return (
                        <button
                            key={tab.key}
                            className={`flw-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            <Icon size={16} />
                            {tab.label}
                            <span className="flw-tab-count">{count}</span>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flw-loading">
                    <Loader2 size={28} className="flw-spin" />
                </div>
            ) : (
                <div className="flw-content">
                    {activeTab === 'projects' && renderProjects()}
                    {activeTab === 'builders' && renderUsers(builders, 'Builders')}
                    {activeTab === 'investors' && renderUsers(investors, 'Investors')}
                </div>
            )}

            <style>{`
                .flw-header { margin-bottom: 1.5rem; }
                .flw-header h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
                .flw-subtitle { color: #6b7280; margin: 0; }

                .flw-tabs {
                    display: flex; gap: 0.5rem;
                    border-bottom: 2px solid #e5e7eb;
                    margin-bottom: 1.5rem;
                }
                .flw-tab {
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.65rem 1rem;
                    background: none; border: none; border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                    font-size: 0.9rem; font-weight: 500; color: #6b7280;
                    cursor: pointer; transition: all 0.15s;
                }
                .flw-tab:hover { color: #374151; }
                .flw-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); font-weight: 600; }
                .flw-tab-count {
                    background: #f3f4f6; color: #6b7280;
                    font-size: 0.72rem; font-weight: 600;
                    padding: 1px 6px; border-radius: 99px;
                    min-width: 20px; text-align: center;
                }
                .flw-tab.active .flw-tab-count { background: #dbeafe; color: var(--color-primary); }

                .flw-loading { display: flex; justify-content: center; padding: 4rem; }
                .flw-spin { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .flw-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1rem;
                }
                .flw-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 1.25rem;
                    display: flex; flex-direction: column; gap: 1rem;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .flw-card:hover { border-color: #c7d2fe; box-shadow: 0 2px 12px rgba(99,102,241,0.06); }
                .flw-card-top { display: flex; align-items: center; gap: 0.75rem; }

                .flw-avatar {
                    width: 44px; height: 44px; border-radius: 50%;
                    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary, #F97316));
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; flex-shrink: 0;
                    color: white; font-weight: 700; font-size: 1.05rem;
                }
                .flw-avatar.project { border-radius: 10px; }
                .flw-avatar img { width: 100%; height: 100%; object-fit: cover; }

                .flw-info { display: flex; flex-direction: column; min-width: 0; }
                .flw-name {
                    font-weight: 600; color: #111827; font-size: 0.95rem;
                    text-decoration: none; white-space: nowrap;
                    overflow: hidden; text-overflow: ellipsis;
                }
                .flw-name:hover { color: var(--color-primary); }
                .flw-sub { font-size: 0.8rem; color: #9ca3af; }

                .flw-unfollow {
                    display: flex; align-items: center; gap: 0.35rem;
                    align-self: flex-start;
                    padding: 0.35rem 0.75rem;
                    border: 1px solid #e5e7eb; border-radius: 6px;
                    background: white; color: #6b7280;
                    font-size: 0.78rem; font-weight: 500;
                    cursor: pointer; transition: all 0.15s;
                }
                .flw-unfollow:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

                .flw-empty {
                    text-align: center; padding: 4rem 2rem;
                    color: #9ca3af;
                }
                .flw-empty svg { margin-bottom: 1rem; opacity: 0.4; }
                .flw-empty p { margin: 0 0 1rem; }
                .flw-btn-link {
                    display: inline-block;
                    padding: 0.5rem 1.25rem; border-radius: 8px;
                    background: var(--color-primary); color: white;
                    text-decoration: none; font-weight: 600; font-size: 0.88rem;
                }
                .flw-btn-link:hover { filter: brightness(1.1); }

                @media (max-width: 600px) {
                    .flw-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </>
    );
};

export default Following;
