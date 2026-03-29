import React, { useState, useEffect } from 'react';
import { Loader2, LayoutGrid, List, Grid3X3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mediaApi, newsApi } from '../services/api';

const Media = () => {
    const [activeTab, setActiveTab] = useState('substack');
    const [substackItems, setSubstackItems] = useState([]);
    const [youtubeItems, setYoutubeItems] = useState([]);
    const [liveSettings, setLiveSettings] = useState({ livestreamUrl: '', livestreamActive: false });
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'list' | 'icon'
    const [playingVideoId, setPlayingVideoId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                if (activeTab === 'substack' && substackItems.length === 0) {
                    const result = await mediaApi.substack();
                    const list = result?.data || result || [];
                    setSubstackItems(Array.isArray(list) ? list : []);
                } else if (activeTab === 'youtube' && youtubeItems.length === 0) {
                    const result = await mediaApi.youtube();
                    const list = result?.data || result || [];
                    setYoutubeItems(Array.isArray(list) ? list : []);
                } else if (activeTab === 'live') {
                    // Live tab doesn't need additional fetching
                }
            } catch (error) {
                console.error(`[Media] Error fetching ${activeTab}:`, error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [activeTab]);

    // Fetch livestream settings once on mount
    useEffect(() => {
        newsApi.settings()
            .then(data => {
                setLiveSettings({ livestreamUrl: data.livestreamUrl || '', livestreamActive: data.livestreamActive || false });
            })
            .catch(() => {});
    }, []);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    const extractVideoId = (url) => {
        if (!url) return '';
        const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match?.[1] || '';
    };

    return (
        <div className="media-page container py-12">
            <div className="header text-center mb-12">
                <h1 className="page-header">Media & Resources</h1>
                <p className="text-gray-500">Blogs, interviews, and updates from the community.</p>
            </div>

            {/* Tab Navigation */}
            <div className="tabs">
                <button
                    className={`tab-btn ${activeTab === 'substack' ? 'active' : ''}`}
                    onClick={() => setActiveTab('substack')}
                >
                    Substack
                </button>
                <button
                    className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                    onClick={() => setActiveTab('youtube')}
                >
                    YouTube
                </button>
                <button
                    className={`tab-btn ${activeTab === 'live' ? 'active' : ''}`}
                    onClick={() => setActiveTab('live')}
                >
                    {liveSettings.livestreamActive && <span className="live-dot" />}
                    Live
                </button>
                <div className="view-toggles">
                    <button
                        className={`view-btn ${viewMode === 'card' ? 'active' : ''}`}
                        onClick={() => { setViewMode('card'); setPlayingVideoId(null); }}
                        title="Card view"
                    >
                        <LayoutGrid size={16} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => { setViewMode('list'); setPlayingVideoId(null); }}
                        title="List view"
                    >
                        <List size={16} />
                    </button>
                    <button
                        className={`view-btn ${viewMode === 'icon' ? 'active' : ''}`}
                        onClick={() => { setViewMode('icon'); setPlayingVideoId(null); }}
                        title="Icon view"
                    >
                        <Grid3X3 size={16} />
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content mt-8">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    </div>
                ) : (
                    <>
                        {/* Substack Tab */}
                        {activeTab === 'substack' && (
                            substackItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                                    No blog posts yet.
                                </div>
                            ) : viewMode === 'card' ? (
                                <div className="grid grid-cols-3 gap-lg">
                                    {substackItems.map((item, idx) => (
                                        <div key={idx} className="substack-card">
                                            {item.thumbnail && (
                                                <div className="card-img" style={{ backgroundImage: `url(${item.thumbnail})` }}></div>
                                            )}
                                            <div className="card-body">
                                                <div className="meta">{formatDate(item.date)} • {item.author || 'Build In El Salvador'}</div>
                                                <h3>{item.title}</h3>
                                                <p>{item.excerpt}</p>
                                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="read-more">
                                                    Read on Substack →
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : viewMode === 'list' ? (
                                <div className="list-view">
                                    {substackItems.map((item, idx) => (
                                        <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="list-row">
                                            {item.thumbnail && (
                                                <div className="list-thumb" style={{ backgroundImage: `url(${item.thumbnail})` }} />
                                            )}
                                            <div className="list-info">
                                                <h3>{item.title}</h3>
                                                <p>{item.excerpt}</p>
                                            </div>
                                            <div className="list-meta">
                                                <span>{formatDate(item.date)}</span>
                                                <span>{item.author || 'Build In El Salvador'}</span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="icon-grid">
                                    {substackItems.map((item, idx) => (
                                        <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="icon-tile">
                                            <div className="icon-thumb" style={{ backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : 'none' }}>
                                                {!item.thumbnail && <span className="icon-placeholder">📝</span>}
                                            </div>
                                            <div className="icon-label">{item.title}</div>
                                        </a>
                                    ))}
                                </div>
                            )
                        )}

                        {/* YouTube Tab */}
                        {activeTab === 'youtube' && (
                            youtubeItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                                    No videos yet.
                                </div>
                            ) : viewMode === 'card' ? (
                                <div className="grid grid-cols-2 gap-lg">
                                    {youtubeItems.map((item, idx) => {
                                        const autoplay = playingVideoId === item.videoId ? 1 : 0;
                                        return (
                                            <div key={idx} className={`youtube-card${autoplay ? ' yt-highlighted' : ''}`} ref={autoplay ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : undefined}>
                                                {item.videoId && (
                                                    <div className="youtube-embed">
                                                        <iframe
                                                            width="100%"
                                                            height="100%"
                                                            src={`https://www.youtube.com/embed/${item.videoId}?autoplay=${autoplay}`}
                                                            title={item.title}
                                                            frameBorder="0"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                        ></iframe>
                                                    </div>
                                                )}
                                                <div className="card-body">
                                                    <div className="meta">{formatDate(item.date)}</div>
                                                    <h3>{item.title}</h3>
                                                    {item.description && <p>{item.description}</p>}
                                                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="read-more">
                                                        Watch on YouTube →
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : viewMode === 'list' ? (
                                <div className="list-view">
                                    {youtubeItems.map((item, idx) => (
                                        <div key={idx} className="list-row" onClick={() => { setPlayingVideoId(item.videoId); setViewMode('card'); }} style={{ cursor: 'pointer' }}>
                                            <div className="list-thumb" style={{ backgroundImage: `url(https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg)` }} />
                                            <div className="list-info">
                                                <h3>{item.title}</h3>
                                                {item.description && <p>{item.description}</p>}
                                            </div>
                                            <div className="list-meta">
                                                <span>{formatDate(item.date)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="icon-grid">
                                    {youtubeItems.map((item, idx) => (
                                        <div key={idx} className="icon-tile" onClick={() => { setPlayingVideoId(item.videoId); setViewMode('card'); }} style={{ cursor: 'pointer' }}>
                                            <div className="icon-thumb" style={{ backgroundImage: `url(https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg)` }} />
                                            <div className="icon-label">{item.title}</div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Live Tab */}
                        {activeTab === 'live' && (() => {
                            const videoId = extractVideoId(liveSettings.livestreamUrl);
                            const embedDomain = window.location.hostname;

                            if (!liveSettings.livestreamActive || !videoId) {
                                return (
                                    <div className="live-placeholder">
                                        <div className="live-icon">📺</div>
                                        <h3>No livestream currently scheduled</h3>
                                        <p>Check back soon for live content from the Build In El Salvador community.</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="live-layout">
                                    <div className="live-player">
                                        <div className="youtube-embed">
                                            <iframe
                                                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                                                title="Live Stream"
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    </div>
                                    <div className="live-chat">
                                        <iframe
                                            src={`https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${embedDomain}`}
                                            title="Live Chat"
                                            frameBorder="0"
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            <style jsx>{`
        .tabs {
          display: flex;
          gap: 0.25rem;
          margin-bottom: 0;
          background: var(--color-gray-100);
          border: 1px solid #e5e7eb;
          border-radius: var(--radius-xl, 12px);
          padding: 0.25rem;
          width: 100%;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.625rem 1rem;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
          color: #9ca3af;
          flex: 1;
        }
        .tab-btn:hover {
          color: #6b7280;
          background: #f9fafb;
        }
        .tab-btn.active {
          background: #FF9500;
          color: white;
          box-shadow: 0 1px 3px rgba(255, 149, 0, 0.3);
        }
        .tab-btn.active:nth-child(2) {
          background: #FF0000;
          box-shadow: 0 1px 3px rgba(255, 0, 0, 0.3);
        }
        .tab-btn.active:nth-child(3) {
          background: var(--color-surface);
          color: #EF4444;
          box-shadow: 0 1px 3px rgba(239, 68, 68, 0.2);
        }

        /* Substack Cards */
        .substack-card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .substack-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .card-img {
          height: 200px;
          background: var(--color-gray-200);
          background-size: cover;
          background-position: center;
        }
        .card-body {
          padding: 1.5rem;
        }
        .meta {
          font-size: 0.8rem;
          color: var(--color-gray-400);
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .substack-card h3 {
          font-size: 1.25rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
          color: var(--color-gray-900);
        }
        .substack-card p {
          font-size: 0.95rem;
          color: var(--color-gray-500);
          margin-bottom: 1.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .read-more {
          color: var(--color-primary);
          font-weight: 600;
          font-size: 0.9rem;
          text-decoration: none;
          transition: color 0.2s;
        }
        .read-more:hover {
          color: var(--color-primary-dark);
        }

        /* YouTube Cards */
        .youtube-card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .youtube-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
        }
        .youtube-embed {
          width: 100%;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          position: relative;
          height: 0;
          overflow: hidden;
          background: var(--color-gray-200);
        }
        .youtube-embed iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }
        .youtube-card .card-body {
          padding: 1.5rem;
        }
        .youtube-card h3 {
          font-size: 1.15rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
          color: var(--color-gray-900);
        }
        .youtube-card p {
          font-size: 0.9rem;
          color: var(--color-gray-500);
          margin-bottom: 1.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* Live Tab - Pulsing Dot */
        .live-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          background: #EF4444;
          border-radius: 50%;
          margin-right: 4px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }

        /* Live Layout: player left (65%), chat right (35%) */
        .live-layout {
          display: grid;
          grid-template-columns: 65fr 35fr;
          gap: 1.5rem;
          align-items: start;
        }
        .live-player {
          width: 100%;
        }
        .live-player .youtube-embed {
          width: 100%;
          padding-bottom: 56.25%;
          position: relative;
          height: 0;
        }
        .live-player .youtube-embed iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .live-chat iframe {
          width: 100%;
          height: 600px;
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
        }

        /* Live Placeholder */
        .live-placeholder {
          text-align: center;
          padding: 4rem 2rem;
          color: var(--color-gray-500);
        }
        .live-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        .live-placeholder h3 {
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: var(--color-neutral-dark);
        }

        /* YouTube highlighted card (auto-playing from list/icon click) */
        .yt-highlighted {
          box-shadow: 0 0 0 2px var(--color-primary), var(--shadow-md);
        }

        /* View Toggle Buttons */
        .view-toggles {
          display: flex;
          gap: 2px;
          margin-left: auto;
          padding-left: 0.5rem;
          border-left: 1px solid var(--color-gray-300);
          flex-shrink: 0;
        }
        .view-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: transparent;
          color: #9ca3af;
          transition: all 0.2s;
        }
        .view-btn:hover {
          color: #6b7280;
          background: #f3f4f6;
        }
        .view-btn.active {
          color: var(--color-primary);
          background: var(--color-primary-50, rgba(0, 71, 171, 0.08));
        }

        /* List View */
        .list-view {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: var(--color-gray-200);
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .list-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1.25rem;
          background: var(--color-surface);
          text-decoration: none;
          transition: background 0.15s;
        }
        .list-row:hover {
          background: var(--color-gray-50, #f9fafb);
        }
        .list-thumb {
          width: 72px;
          height: 48px;
          border-radius: 6px;
          background-size: cover;
          background-position: center;
          background-color: var(--color-gray-200);
          flex-shrink: 0;
        }
        .list-info {
          flex: 1;
          min-width: 0;
        }
        .list-info h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-gray-900);
          margin: 0 0 0.2rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .list-info p {
          font-size: 0.8rem;
          color: var(--color-gray-500);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .list-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.15rem;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .list-meta span {
          font-size: 0.75rem;
          color: var(--color-gray-400);
        }

        /* Icon / Grid View */
        .icon-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }
        .icon-tile {
          text-decoration: none;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition: transform 0.15s;
        }
        .icon-tile:hover {
          transform: translateY(-2px);
        }
        .icon-thumb {
          width: 100%;
          aspect-ratio: 1;
          border-radius: var(--radius-lg);
          background-size: cover;
          background-position: center;
          background-color: var(--color-gray-200);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon-placeholder {
          font-size: 2rem;
        }
        .icon-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--color-gray-900);
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-align: center;
        }

        @media (max-width: 768px) {
          .grid-cols-3,
          .grid-cols-2 {
            grid-template-columns: 1fr;
          }
          .icon-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
          }
          .list-thumb {
            width: 56px;
            height: 38px;
          }
          .list-meta {
            display: none;
          }
          .page-header {
            display: none !important;
          }
          .live-layout {
            grid-template-columns: 1fr;
          }
          .live-chat iframe {
            height: 400px;
          }
        }
      `}</style>
        </div>
    );
};

export default Media;
