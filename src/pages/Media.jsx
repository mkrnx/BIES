import React, { useState, useEffect } from 'react';
import { Play, Loader2, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { contentApi } from '../services/api';

const Media = () => {
    const [activeTab, setActiveTab] = useState('news');
    const [articles, setArticles] = useState([]);
    const [videos, setVideos] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                if (activeTab === 'news') {
                    const result = await contentApi.articles({ limit: 12 });
                    const list = result?.data || result || [];
                    setArticles(Array.isArray(list) ? list : []);
                } else if (activeTab === 'video') {
                    const result = await contentApi.videos({ limit: 12 });
                    const list = result?.data || result || [];
                    setVideos(Array.isArray(list) ? list : []);
                } else if (activeTab === 'resources') {
                    const result = await contentApi.resources({ limit: 20 });
                    const list = result?.data || result || [];
                    setResources(Array.isArray(list) ? list : []);
                }
            } catch {
                // silently fail — empty state shown
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
        } catch { return dateStr; }
    };

    return (
        <div className="media-page container py-12">
            <div className="header text-center mb-12">
                <h1>Media & Resources</h1>
                <p className="text-gray-500">Updates, guides, and stories from the ecosystem.</p>
            </div>

            <div className="tabs">
                <button className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>News & Blog</button>
                <button className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>Video Series</button>
                <button className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Legal & Resources</button>
            </div>

            <div className="tab-content mt-8">
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                    </div>
                ) : (
                    <>
                        {activeTab === 'news' && (
                            articles.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>No articles yet.</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-lg">
                                    {articles.map(article => (
                                        <div key={article.id} className="article-card">
                                            <div
                                                className="card-img"
                                                style={{
                                                    backgroundImage: article.image || article.coverImage ? `url(${article.image || article.coverImage})` : undefined,
                                                    backgroundColor: !article.image && !article.coverImage ? 'var(--color-gray-200)' : undefined,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                }}
                                            ></div>
                                            <div className="card-body">
                                                <div className="meta">{formatDate(article.date || article.createdAt)} {article.category ? `• ${article.category}` : ''}</div>
                                                <h3>{article.title}</h3>
                                                <p>{article.description || article.excerpt}</p>
                                                <Link to={`/news/${article.slug || article.id}`} className="read-more">Read Article &rarr;</Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {activeTab === 'video' && (
                            videos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>No videos yet.</div>
                            ) : (
                                <div className="grid grid-cols-3 gap-lg">
                                    {videos.map(video => (
                                        <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" className="video-card">
                                            <div
                                                className="video-thumb"
                                                style={{
                                                    backgroundImage: video.image || video.thumbnail ? `url(${video.image || video.thumbnail})` : undefined,
                                                    backgroundColor: !video.image && !video.thumbnail ? '#0A192F' : undefined,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                }}
                                            >
                                                <div className="play-btn"><Play size={24} fill="white" /></div>
                                                {video.duration && <span className="duration-badge">{video.duration}</span>}
                                            </div>
                                            <div className="card-body">
                                                <h3>{video.title}</h3>
                                                <p>{video.description}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )
                        )}

                        {activeTab === 'resources' && (
                            resources.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>No resources yet.</div>
                            ) : (
                                <div className="resources-list">
                                    {resources.map(resource => (
                                        <div key={resource.id} className="resource-item">
                                            <div>
                                                <h3>{resource.title}</h3>
                                                <p>{resource.description}</p>
                                            </div>
                                            {resource.fileUrl && (
                                                <a href={resource.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                                                    <Download size={14} style={{ marginRight: 4 }} /> Download
                                                </a>
                                            )}
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
        }
        .tab-btn:hover { color: var(--color-neutral-dark); }
        .tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

        .article-card {
          background: white;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
        }
        .card-img { height: 200px; background: var(--color-gray-200); }
        .card-body { padding: 1.5rem; }
        .meta { font-size: 0.8rem; color: var(--color-gray-400); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .article-card h3 { font-size: 1.25rem; margin-bottom: 0.75rem; line-height: 1.3; }
        .article-card p { font-size: 0.95rem; color: var(--color-gray-500); margin-bottom: 1.5rem; }
        .read-more { color: var(--color-primary); font-weight: 600; font-size: 0.9rem; }

        .video-card {
          background: white;
          border-radius: var(--radius-lg);
          overflow: hidden;
          border: 1px solid var(--color-gray-200);
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: block;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .video-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        .video-thumb {
          height: 200px;
          background: var(--color-neutral-dark);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .play-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0,0,0,0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, background 0.2s;
        }
        .video-card:hover .play-btn { transform: scale(1.1); background: var(--color-primary); }
        .duration-badge {
          position: absolute;
          bottom: 0.75rem;
          right: 0.75rem;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: var(--font-mono);
        }
        .video-card .card-body h3 { font-size: 1.1rem; margin-bottom: 0.5rem; line-height: 1.3; }
        .video-card .card-body p { font-size: 0.9rem; color: var(--color-gray-500); }

        .resources-list { max-width: 800px; margin: 0 auto; }
        .resource-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          background: white;
          border: 1px solid var(--color-gray-200);
          border-radius: var(--radius-md);
          margin-bottom: 1rem;
        }
        .resource-item h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
        .resource-item p { color: var(--color-gray-500); font-size: 0.9rem; }

        @media (max-width: 768px) {
          .grid-cols-3, .grid-cols-2 { grid-template-columns: 1fr; }
        }
      `}</style>
        </div>
    );
};

export default Media;
