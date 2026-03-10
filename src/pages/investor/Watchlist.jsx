import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Heart, Loader2, MapPin, DollarSign, Download } from 'lucide-react';
import { watchlistApi } from '../../services/api';
import ZapButton from '../../components/ZapButton';

const WatchlistCard = ({ project, onRemove }) => {
    const formatFunding = (val) => {
        if (!val) return '—';
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val}`;
    };

    const categoryLabel = (c) => {
        if (!c) return '—';
        const special = { SAAS: 'SaaS', ECOMMERCE: 'E-Commerce', WEB3: 'Web3', REAL_ESTATE: 'Real Estate' };
        if (special[c]) return special[c];
        return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
    };

    const builderName = project.owner?.profile?.name || project.owner?.name || project.builder;
    const builderId = project.ownerId || project.owner?.id;
    const builderAvatar = project.owner?.profile?.avatar || project.owner?.avatar;

    return (
        <div className="project-card">
            <Link to={`/project/${project.id}`} className="card-image-link">
                <div
                    className="card-image"
                    style={{
                        backgroundColor: project.color || '#E0F2FE',
                        backgroundImage: (project.thumbnail || project.coverImage || project.image) ? `url(${project.thumbnail || project.coverImage || project.image})` : 'none'
                    }}
                >
                    <span className="industry-badge">{categoryLabel(project.category || project.industry)}</span>
                    <span className="stage-badge">{project.stage || '—'}</span>
                </div>
            </Link>
            <div className="card-body">
                <Link to={`/project/${project.id}`} className="card-title-link">
                    <h3>{project.title || project.name}</h3>
                </Link>
                <p className="description">{project.description || ''}</p>

                <div className="meta-row">
                    <div className="meta-item">
                        <MapPin size={14} />
                        <span>{project.location || 'El Salvador'}</span>
                    </div>
                    <div className="meta-item">
                        <DollarSign size={14} />
                        <span>{formatFunding(project.fundingGoal || project.funding)}</span>
                    </div>
                </div>

                {builderName && (
                    <Link to={builderId ? `/builder/${builderId}` : '#'} className="builder-row builder-link" style={{ display: 'flex', alignItems: 'center', marginTop: '0.35rem', marginBottom: '0.85rem' }}>
                        {builderAvatar ? (
                            <img src={builderAvatar} alt={builderName} className="avatar-img" />
                        ) : (
                            <div className="avatar">{(builderName || '?')[0]}</div>
                        )}
                        <span className="builder-name-text" style={{ marginTop: '-6px' }}>{builderName}</span>
                    </Link>
                )}

                <div className="actions">
                    <Link to={`/project/${project.id}`} className="btn btn-outline btn-xs view-details-btn">Details</Link>
                    <button
                        className="icon-btn liked"
                        title="Remove from Watchlist"
                        onClick={() => onRemove(project.id)}
                    >
                        <Heart size={18} fill="currentColor" />
                    </button>
                    <button className="icon-btn btn-secondary-icon" title="Request Pitch Deck"><Download size={18} /></button>
                    {project.owner?.nostrPubkey && (
                        <ZapButton
                            recipients={[{ pubkey: project.owner.nostrPubkey, name: project.owner?.profile?.name || project.owner?.name || 'Builder', avatar: project.owner?.profile?.avatar || '' }]}
                            size="sm"
                        />
                    )}
                </div>
            </div>
            <style jsx>{`
        .project-card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          flex-direction: column;
        }
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }

        .card-image-link {
          text-decoration: none;
          display: block;
        }

        .card-image {
          height: 160px;
          position: relative;
          padding: 1rem;
          background-size: cover;
          background-position: center;
          cursor: pointer;
        }

        .card-title-link {
          text-decoration: none;
          color: inherit;
        }
        .card-title-link:hover h3 {
          color: var(--color-secondary, #F97316);
        }

        .builder-link {
          text-decoration: none;
          color: inherit;
          cursor: pointer;
        }
        .builder-link:hover span {
          color: var(--color-secondary, #F97316);
        }
        
        .industry-badge {
          position: absolute;
          top: 1rem;
          left: 1rem;
          background: rgba(255,255,255,0.9);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-neutral-dark);
        }
        :global([data-theme="dark"]) .industry-badge {
          background: var(--color-gray-100);
          color: inherit;
        }

        .stage-badge {
          position: absolute;
          bottom: 1rem;
          left: 1rem;
          background: rgba(0,0,0,0.6);
          color: white;
          padding: 2px 8px;
          border-radius: 99px;
          font-size: 0.75rem;
        }

        .card-body { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        
        h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
        
        .description {
          font-size: 0.9rem;
          color: var(--color-gray-500);
          margin-bottom: 1rem;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .meta-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: var(--color-gray-500);
        }
        .meta-item { display: flex; align-items: center; gap: 4px; }

        .builder-row {
          display: flex;
          align-items: center;
          font-size: 0.85rem;
          color: inherit;
          font-weight: 500;
        }

        .avatar {
          width: 24px;
          height: 24px;
          background: var(--color-gray-200);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: var(--color-gray-600);
          flex-shrink: 0;
          margin-right: 12px;
        }

        .avatar-img {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          margin-right: 12px;
        }

        .builder-name-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
        }

        .actions > button.icon-btn:first-of-type {
            margin-left: auto;
        }

        .view-details-btn {
            flex: 1;
            white-space: nowrap !important;
            font-size: 0.85rem;
            padding: 0 12px !important;
            height: 36px !important;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: fit-content;
        }
        
        .icon-btn {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-gray-200);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-gray-400);
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .icon-btn:hover { border-color: var(--color-secondary, #F97316); color: var(--color-secondary, #F97316); }
        .icon-btn.liked { color: var(--color-error); border-color: var(--color-error); }
        
        .btn-secondary-icon:hover { 
          background: var(--color-secondary); 
          border-color: var(--color-secondary); 
          color: white; 
        }
      `}</style>
        </div>
    );
};

const InvestorWatchlist = () => {
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await watchlistApi.list();
                setWatchlist(res?.data || res || []);
            } catch (err) {
                console.error('Failed to load watchlist:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

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

    return (
        <div className="watchlist-page">
            <div className="header-section">
                <h1>My Watchlist</h1>
                <p className="subtitle">Projects you are interested in</p>
            </div>

            {loading ? (
                <div className="loading-container">
                    <Loader2 size={28} className="spin" />
                </div>
            ) : watchlist.length === 0 ? (
                <div className="empty-state">
                    <Folder size={48} className="empty-icon" />
                    <h2>Your watchlist is empty</h2>
                    <p>Track promising projects by adding them from the Discover page.</p>
                    <Link to="/discover" className="btn btn-secondary mt-4">Discover Projects</Link>
                </div>
            ) : (
                <div className="projects-grid">
                    {watchlist.map(item => {
                        const project = item.project || item;
                        return (
                            <WatchlistCard
                                key={item.id || project.id}
                                project={project}
                                onRemove={handleRemoveWatchlist}
                            />
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .watchlist-page {
                    /* Container styles inherited from dashboard content */
                }

                .header-section {
                    margin-bottom: 2rem;
                }

                .header-section h1 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.75rem;
                }

                .subtitle {
                    color: var(--color-gray-500);
                    margin: 0;
                }

                .loading-container {
                    display: flex;
                    justify-content: center;
                    padding: 4rem;
                }

                .spin {
                    animation: spin 1s linear infinite;
                    color: var(--color-primary);
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    border: 1px dashed var(--color-gray-300);
                }

                .empty-icon {
                    color: var(--color-gray-300);
                    margin-bottom: 1rem;
                }

                .empty-state h2 {
                    font-size: 1.25rem;
                    color: inherit;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    color: var(--color-gray-500);
                    margin-bottom: 1.5rem;
                }

                .mt-4 {
                    margin-top: 1rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    align-content: flex-start;
                }

                @media (max-width: 1200px) {
                    .projects-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }

                @media (max-width: 768px) {
                    .projects-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default InvestorWatchlist;
