import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Users, Folder, Loader2, Search, LayoutGrid, List as ListIcon, Columns, X } from 'lucide-react';
import { useApiQuery } from '../hooks/useApi';
import { watchlistApi, profilesApi } from '../services/api';
import { stripHtml } from '../utils/text';

const Following = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('projects');
    const [viewMode, setViewMode] = useState('standard');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const [viewMenuOpen, setViewMenuOpen] = useState(false);

    // Fetch watchlist (followed projects)
    const { data: watchlist, loading: watchlistLoading } = useApiQuery(watchlistApi.list);
    
    // Fetch social lists
    const { data: following, loading: followingLoading } = useApiQuery(profilesApi.getFollowing, user?.id, { enabled: !!user?.id });
    const { data: followers, loading: followersLoading } = useApiQuery(profilesApi.getFollowers, user?.id, { enabled: !!user?.id });

    const tabs = [
        { id: 'projects', label: 'Projects', icon: Folder },
        { id: 'following', label: 'Following', icon: Users },
        { id: 'followers', label: 'Followers', icon: Users }
    ];

    const getListContent = () => {
        let list = [];
        if (activeTab === 'projects') list = watchlist?.data || watchlist || [];
        else if (activeTab === 'following') list = following?.data || following || [];
        else if (activeTab === 'followers') list = followers?.data || followers || [];
        
        if (!searchQuery) return list;
        
        const q = searchQuery.toLowerCase();
        return (Array.isArray(list) ? list : []).filter(item => {
            const data = activeTab === 'projects' ? (item.project || item) : item;
            const name = (data.title || data.name || '').toLowerCase();
            const bio = (data.description || data.bio || '').toLowerCase();
            const tagline = (data.tagline || '').toLowerCase();
            return name.includes(q) || bio.includes(q) || tagline.includes(q);
        });
    };

    const currentList = getListContent();
    const loading = watchlistLoading || followingLoading || followersLoading;

    return (
        <div className="following-wrapper">
            <div className="header">
                <div>
                    <h1>Network</h1>
                    <p className="subtitle">Manage connections across the BIES ecosystem.</p>
                </div>
            </div>

            <div className="tab-control-row">
                <div className="tabs">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => { setActiveTab(t.id); setSearchQuery(''); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <t.icon size={16} />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="controls">
                    <div className="search-dropdown-container">
                        <button className={`control-btn ${searchExpanded ? 'active' : ''}`} onClick={() => { setSearchExpanded(!searchExpanded); setViewMenuOpen(false); }} title="Search">
                            <Search size={20} />
                        </button>
                        {searchExpanded && (
                            <div className="search-dropdown">
                                <Search size={16} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search network..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    autoFocus
                                    onBlur={(e) => {
                                        // Delay to allow clicking close or other elements
                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                            // Optional: close on blur if needed
                                        }
                                    }}
                                />
                                {searchQuery && (
                                    <button className="clear-btn" onClick={() => setSearchQuery('')}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="view-toggle-container">
                        <button className="control-btn" onClick={() => { setViewMenuOpen(!viewMenuOpen); setSearchExpanded(false); }} title="View Toggle">
                            {viewMode === 'icons' && <LayoutGrid size={20} />}
                            {viewMode === 'list' && <ListIcon size={20} />}
                            {viewMode === 'standard' && <Columns size={20} />}
                        </button>
                        {viewMenuOpen && (
                            <div className="view-menu-dropdown">
                                <button onClick={() => { setViewMode('icons'); setViewMenuOpen(false); }} className={viewMode === 'icons' ? 'active' : ''}>
                                    <LayoutGrid size={16} /> Icons
                                </button>
                                <button onClick={() => { setViewMode('list'); setViewMenuOpen(false); }} className={viewMode === 'list' ? 'active' : ''}>
                                    <ListIcon size={16} /> List
                                </button>
                                <button onClick={() => { setViewMode('standard'); setViewMenuOpen(false); }} className={viewMode === 'standard' ? 'active' : ''}>
                                    <Columns size={16} /> Standard
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="content">
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="empty-state">
                        <Users size={40} className="empty-icon" />
                        <h3>Nothing to see here yet.</h3>
                        <p>{searchQuery ? `No results found for "${searchQuery}"` : "You haven't connected with anyone in this section."}</p>
                        <Link to="/discover" className="btn btn-primary mt-4" style={{ display: 'inline-block', textDecoration: 'none' }}>
                            Discover Members
                        </Link>
                    </div>
                ) : (
                    <div className={`results-container mode-${viewMode}`}>
                        {currentList.map(item => {
                            const isProject = activeTab === 'projects';
                            const data = isProject ? item.project || item : item;
                            const title = isProject ? data.title : data.name;
                            const link = isProject ? `/project/${data.id}` : `/builder/${data.id}`;
                            const image = isProject ? (data.thumbnail || data.coverImage) : (data.avatar || data.profilePic);

                            if (viewMode === 'icons') {
                                return (
                                    <Link key={item.id} to={link} className="icon-entry" title={title}>
                                        <div className="icon-avatar">
                                            {image ? <img src={image} alt={title} /> : <span>{title[0]}</span>}
                                        </div>
                                        <span className="icon-label">{title}</span>
                                    </Link>
                                );
                            }

                            if (viewMode === 'list') {
                                return (
                                    <Link key={item.id} to={link} className="list-entry">
                                        <div className="list-avatar">
                                            {image ? <img src={image} alt={title} /> : <span>{title[0]}</span>}
                                        </div>
                                        <div className="list-info">
                                            <h3>{title}</h3>
                                            <p>{isProject ? data.tagline : (data.title || data.role || 'Member')}</p>
                                        </div>
                                        <div className="list-tags">
                                            {(data.skills || data.tags || []).slice(0, 2).map((t, i) => (
                                                <span key={i} className="tiny-tag">{t}</span>
                                            ))}
                                        </div>
                                    </Link>
                                );
                            }

                            return (
                                <Link key={item.id} to={link} className="card-link">
                                    <div className="card">
                                        <div className="card-image">
                                            {image ? <img src={image} alt={title} /> : <div className="placeholder"><Users size={24} /></div>}
                                        </div>
                                        <div className="card-info">
                                            <h3>{title}</h3>
                                            <p className="tagline">{isProject ? data.tagline : stripHtml(data.bio || '')}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            <style jsx>{`
                .header { margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }
                
                .tab-control-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid var(--color-gray-200);
                    margin-bottom: 2rem;
                    gap: 1rem;
                }

                .tabs {
                    display: flex;
                    gap: 0.5rem;
                }
                .tab-btn {
                    padding: 0.75rem 1rem;
                    background: none;
                    border: none;
                    font-weight: 500;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    position: relative;
                    white-space: nowrap;
                }
                .tab-btn:hover { color: var(--color-gray-700); }
                .tab-btn.active { color: var(--color-primary); }
                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -1px; left: 0; right: 0;
                    height: 2px;
                    background: var(--color-primary);
                }

                .controls {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding-bottom: 0.5rem;
                }
                .control-btn {
                    width: 36px; height: 36px;
                    border-radius: 50%;
                    border: 1px solid var(--color-gray-200);
                    background: var(--color-surface);
                    color: var(--color-gray-500);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .control-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .control-btn.active { border-color: var(--color-primary); background: var(--color-primary); color: white; }

                .search-dropdown-container { position: relative; }
                .search-dropdown {
                    position: absolute; top: 100%; right: 0; margin-top: 0.5rem;
                    background: var(--color-surface); border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-full); padding: 0 0.75rem; z-index: 60;
                    box-shadow: var(--shadow-md); min-width: 280px;
                    display: flex; align-items: center; height: 40px;
                }
                .search-dropdown input {
                    flex: 1; background: none; border: none; padding: 0 0.75rem;
                    font-size: 0.9rem; outline: none; color: var(--color-gray-800);
                }
                .search-icon { color: var(--color-gray-400); }
                .clear-btn { background: var(--color-gray-100); border: none; color: var(--color-gray-500); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; }

                .view-toggle-container { position: relative; }
                .view-menu-dropdown {
                    position: absolute; top: 100%; right: 0; margin-top: 0.5rem;
                    background: var(--color-surface); border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md); padding: 0.5rem; z-index: 50;
                    box-shadow: var(--shadow-md); minWidth: 160px;
                    display: flex; flexDirection: column; gap: 4px;
                }
                .view-menu-dropdown button {
                    display: flex; align-items: center; gap: 8px; padding: 8px; border: none; background: transparent; 
                    color: inherit; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 0.85rem; width: 100%;
                }
                .view-menu-dropdown button:hover { background: var(--color-gray-100); }
                .view-menu-dropdown button.active { background: var(--color-primary); color: white; }

                .empty-state {
                    background: var(--color-surface);
                    text-align: center;
                    padding: 4rem 2rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--color-gray-200);
                }
                .empty-icon { color: var(--color-gray-300); margin-bottom: 1rem; }
                .empty-state h3 { margin-bottom: 0.5rem; }
                .empty-state p { color: var(--color-gray-500); }
                
                /* Grid rendering (Standard) */
                .mode-standard {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .card-link { text-decoration: none; color: inherit; }
                .card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    transition: all 0.2s;
                    height: 100%;
                    display: flex; flex-direction: column;
                }
                .card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--color-primary-light); }
                
                .card-image {
                    height: 160px;
                    background: var(--color-gray-100);
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden;
                }
                .card-image img { width: 100%; height: 100%; object-fit: cover; }
                .placeholder { color: var(--color-gray-300); }
                
                .card-info { padding: 1.25rem; flex: 1; }
                .card-info h3 { font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--color-gray-800); }
                .card-info .tagline { font-size: 0.875rem; color: var(--color-gray-500); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

                /* List rendering */
                .mode-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .list-entry {
                    display: flex; align-items: center; gap: 1rem; padding: 0.75rem;
                    background: var(--color-surface); border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg); text-decoration: none; color: inherit;
                    transition: all 0.2s;
                }
                .list-entry:hover { border-color: var(--color-primary-light); background: var(--color-gray-50); }
                .list-avatar { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: var(--color-gray-100); flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--color-gray-400); font-weight: 700; }
                .list-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .list-info { flex: 1; min-width: 0; }
                .list-info h3 { font-size: 0.95rem; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .list-info p { font-size: 0.8rem; color: var(--color-gray-500); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .list-tags { display: flex; gap: 4px; }
                .tiny-tag { font-size: 0.65rem; padding: 1px 6px; background: var(--color-gray-100); color: var(--color-gray-500); border-radius: 99px; }

                /* Icons rendering */
                .mode-icons {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 1.5rem;
                    justify-items: center;
                }
                .icon-entry { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-decoration: none; color: inherit; width: 80px; }
                .icon-avatar { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: var(--color-gray-100); display: flex; align-items: center; justify-content: center; color: var(--color-gray-400); font-weight: 700; border: 2px solid transparent; transition: all 0.2s; }
                .icon-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .icon-entry:hover .icon-avatar { border-color: var(--color-primary); }
                .icon-label { font-size: 0.75rem; text-align: center; color: var(--color-gray-600); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

                .mt-4 { margin-top: 1rem; }
            `}</style>
        </div>
    );
};

export default Following;
