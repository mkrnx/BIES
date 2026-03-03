import React, { useState, useEffect } from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNostrFeed } from '../hooks/useNostr';
import NostrIcon from '../components/NostrIcon';
import { contentApi } from '../services/api';

const BIES_NPUBS = [
    'npub1qqqqqq9rxsat07sykh39gg0gapnnlnmz3wjyw5m576jh85n225dsqfcwhm', // placeholder
];

const News = () => {
    const { posts, loading: feedLoading, profiles } = useNostrFeed(BIES_NPUBS);
    const [articles, setArticles] = useState([]);
    const [articlesLoading, setArticlesLoading] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const result = await contentApi.articles({ limit: 10 });
                const list = result?.data || result || [];
                setArticles(Array.isArray(list) ? list : []);
            } catch {
                setArticles([]);
            } finally {
                setArticlesLoading(false);
            }
        };
        fetchNews();
    }, []);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return dateStr; }
    };

    return (
        <div className="news-page container py-8">
            <div className="grid news-layout">

                {/* Left Column: Social Pulse (Nostr) */}
                <aside className="news-col sidebar-col">
                    <div className="col-header">
                        <h3>Social Pulse</h3>
                        <span className="live-badge">LIVE</span>
                    </div>
                    <div className="social-feed">
                        {feedLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                            </div>
                        ) : posts.length === 0 ? (
                            <p style={{ color: 'var(--color-gray-400)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
                                No posts from the Nostr relay yet.
                            </p>
                        ) : (
                            posts.slice(0, 10).map(post => {
                                const profile = profiles[post.pubkey] || {};
                                return (
                                    <div key={post.id} className="tweet-card">
                                        <div className="tweet-header">
                                            <div className="avatar">
                                                {profile.picture ? (
                                                    <img src={profile.picture} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                ) : (
                                                    (profile.name || 'N')[0].toUpperCase()
                                                )}
                                            </div>
                                            <div className="u-info">
                                                <span className="u-name">{profile.name || post.pubkey.slice(0, 8)}</span>
                                                <NostrIcon size={12} style={{ color: '#a855f7', marginLeft: 4 }} />
                                            </div>
                                        </div>
                                        <p>{post.content?.slice(0, 280)}{post.content?.length > 280 ? '...' : ''}</p>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>

                {/* Middle Column: Top Stories from API */}
                <main className="news-col main-col">
                    <div className="col-header">
                        <h3>Top Stories</h3>
                    </div>

                    {articlesLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                        </div>
                    ) : articles.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-gray-500)' }}>
                            No news articles yet.
                        </div>
                    ) : (
                        articles.map((article, i) => (
                            <Link to={`/news/${article.slug || article.id}`} key={article.id} className="news-item-link">
                                <div className={`news-item ${i === 0 ? 'featured' : ''}`}>
                                    {i === 0 && (article.image || article.coverImage) && (
                                        <div className="news-img" style={{ backgroundImage: `url(${article.image || article.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                                    )}
                                    <div className="news-content">
                                        {article.category && <span className="tag">{article.category}</span>}
                                        {i === 0 ? (
                                            <>
                                                <h2>{article.title}</h2>
                                                <p className="excerpt">{article.description || article.excerpt}</p>
                                                <span className="date">{formatDate(article.date || article.createdAt)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <h3>{article.title}</h3>
                                                <span className="date">{formatDate(article.date || article.createdAt)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </main>

                {/* Right Column: Platform Updates */}
                <aside className="news-col sidebar-col">
                    <div className="col-header">
                        <h3>BIES Updates</h3>
                    </div>
                    <div className="update-card">
                        <TrendingUp size={24} className="text-secondary mb-2" />
                        <h4>New Feature: Investor Match</h4>
                        <p>Our algorithm now suggests investors based on your project thesis.</p>
                    </div>
                    <div className="update-card">
                        <h4>Builder Spotlight</h4>
                        <p>Meet the team building the first lightning-native POS system in San Miguel.</p>
                    </div>
                </aside>

            </div>

            <style jsx>{`
        .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

        .news-layout {
          display: grid;
          grid-template-columns: 300px 1fr 300px;
          gap: 2rem;
        }

        .col-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid var(--color-neutral-dark);
          padding-bottom: 0.5rem;
        }

        .col-header h3 { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; }

        .live-badge {
          background: var(--color-error);
          color: white;
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .tweet-card {
          background: white;
          padding: 1rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-gray-200);
          margin-bottom: 1rem;
        }
        .tweet-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .avatar {
          width: 32px; height: 32px; background: var(--color-neutral-dark);
          color: white; border-radius: 50%; font-size: 0.75rem;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
        }
        .u-info { font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; }
        .u-name { }
        .tweet-card p { font-size: 0.9rem; line-height: 1.4; }

        .news-item-link { text-decoration: none; color: inherit; display: block; }
        .news-item {
          background: white;
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: 1.5rem;
          border: 1px solid var(--color-gray-200);
          transition: transform 0.2s;
        }
        .news-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
        .news-item.featured .news-img {
          height: 250px;
          background: var(--color-gray-200);
        }
        .news-content { padding: 1.5rem; }
        .tag { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; color: var(--color-primary); text-transform: uppercase; display: block; margin-bottom: 0.5rem; }
        .news-item h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .news-item h3 { font-size: 1.1rem; }
        .excerpt { color: var(--color-gray-500); font-size: 1rem; margin-bottom: 0.5rem; }
        .date { color: var(--color-gray-400); font-size: 0.8rem; }

        .update-card {
          background: var(--color-neutral-dark);
          color: white;
          padding: 1.5rem;
          border-radius: var(--radius-md);
          margin-bottom: 1rem;
        }
        .update-card h4 { color: white; margin-bottom: 0.5rem; }
        .update-card p { font-size: 0.9rem; opacity: 0.8; }

        @media (max-width: 1024px) {
          .news-layout { grid-template-columns: 1fr; }
          .sidebar-col { display: none; }
        }
      `}</style>
        </div>
    );
};

export default News;
