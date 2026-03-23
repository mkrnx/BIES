import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { mediaApi } from '../services/api';

const Media = () => {
    const [activeTab, setActiveTab] = useState('substack');
    const [substackItems, setSubstackItems] = useState([]);
    const [youtubeItems, setYoutubeItems] = useState([]);
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
                }
            } catch (error) {
                console.error(`[Media] Error fetching ${activeTab}:`, error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [activeTab]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
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
                    Substack (Blogs)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'youtube' ? 'active' : ''}`}
                    onClick={() => setActiveTab('youtube')}
                >
                    YouTube (Interviews)
                </button>
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
                            ) : (
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
                            )
                        )}

                        {/* YouTube Tab */}
                        {activeTab === 'youtube' && (
                            youtubeItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                                    No videos yet.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-lg">
                                    {youtubeItems.map((item, idx) => (
                                        <div key={idx} className="youtube-card">
                                            {/* Embedded YouTube iframe */}
                                            {item.videoId && (
                                                <div className="youtube-embed">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        src={`https://www.youtube.com/embed/${item.videoId}`}
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
                                    ))}
                                </div>
                            )
                        )}
                    </>
                )}
            </div>

            <style jsx>{`
        .tabs {
          display: flex;
          justify-content: center;
          gap: 1rem;
          border-bottom: 1px solid var(--color-gray-200);
          padding-bottom: 1px;
        }

        .tab-btn {
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          color: var(--color-gray-500);
          border-bottom: 2px solid transparent;
          cursor: pointer;
          background: none;
          border: none;
          transition: all 0.2s;
        }
        .tab-btn:hover {
          color: var(--color-neutral-dark);
        }
        .tab-btn.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

        /* Substack Cards */
        .substack-card {
          background: white;
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
          color: var(--color-neutral-dark);
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
          background: white;
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
          color: var(--color-neutral-dark);
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

        @media (max-width: 768px) {
          .grid-cols-3,
          .grid-cols-2 {
            grid-template-columns: 1fr;
          }
          .page-header {
            display: none !important;
          }
        }
      `}</style>
        </div>
    );
};

export default Media;
