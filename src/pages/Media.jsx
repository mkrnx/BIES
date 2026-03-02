import React, { useState } from 'react';
import { Play } from 'lucide-react';

const Media = () => {
    const [activeTab, setActiveTab] = useState('news');

    return (
        <div className="media-page container py-12">
            <div className="header text-center mb-12">
                <h1>Media & Resources</h1>
                <p className="text-gray-500">Updates, guides, and stories from the ecosystem.</p>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button className={`tab-btn ${activeTab === 'news' ? 'active' : ''}`} onClick={() => setActiveTab('news')}>News & Blog</button>
                <button className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>Video Series</button>
                <button className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Legal & Resources</button>
            </div>

            <div className="tab-content mt-8">
                {activeTab === 'news' && (
                    <div className="grid grid-cols-3 gap-lg">
                        {[
                            {
                                id: 1,
                                date: 'Oct 24, 2024',
                                category: 'Regulatory',
                                title: 'El Salvador Passes New Digital Securities Law',
                                description: 'What this means for builders and international investors looking to tokenize assets.',
                                image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=800&q=80',
                            },
                            {
                                id: 2,
                                date: 'Oct 18, 2024',
                                category: 'Infrastructure',
                                title: 'Bitcoin City Masterplan Reveals Phase One Timeline',
                                description: 'The first phase of Bitcoin City breaks ground in 2025 with geothermal-powered mining facilities.',
                                image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
                            },
                            {
                                id: 3,
                                date: 'Oct 12, 2024',
                                category: 'Community',
                                title: 'Lightning Adoption Hits 3M Wallets in El Salvador',
                                description: 'Chivo wallet alternatives and third-party Lightning apps drive a new wave of Bitcoin usage nationwide.',
                                image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
                            },
                        ].map(article => (
                            <div key={article.id} className="article-card">
                                <div
                                    className="card-img"
                                    style={{
                                        backgroundImage: `url(${article.image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                ></div>
                                <div className="card-body">
                                    <div className="meta">{article.date} • {article.category}</div>
                                    <h3>{article.title}</h3>
                                    <p>{article.description}</p>
                                    <a href="#" className="read-more">Read Article →</a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'video' && (
                    <div className="grid grid-cols-3 gap-lg">
                        {[
                            {
                                id: 1,
                                title: 'Builder Spotlight: Geothermal Inc.',
                                description: 'Interview with CEO Maria Gonzalez on mining with volcano power.',
                                image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80',
                                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                                duration: '12:34',
                            },
                            {
                                id: 2,
                                title: 'Why Invest in El Salvador Now?',
                                description: 'Panel discussion with Max Keiser and Stacy Herbert.',
                                image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80',
                                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                                duration: '24:10',
                            },
                            {
                                id: 3,
                                title: 'How Bitcoin Beach Changed El Zonte',
                                description: 'Documentary on the grassroots movement that started it all.',
                                image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
                                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                                duration: '18:45',
                            },
                        ].map(video => (
                            <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" className="video-card">
                                <div
                                    className="video-thumb"
                                    style={{
                                        backgroundImage: `url(${video.image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                >
                                    <div className="play-btn"><Play size={24} fill="white" /></div>
                                    <span className="duration-badge">{video.duration}</span>
                                </div>
                                <div className="card-body">
                                    <h3>{video.title}</h3>
                                    <p>{video.description}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                )}

                {activeTab === 'resources' && (
                    <div className="resources-list">
                        <div className="resource-item">
                            <div>
                                <h3>Investment Guide 2025</h3>
                                <p>Comprehensive guide to tax incentives and legal structures.</p>
                            </div>
                            <button className="btn btn-outline btn-sm">Download PDF</button>
                        </div>
                        <div className="resource-item">
                            <div>
                                <h3>Tokenization Framework</h3>
                                <p>Technical specs for issuing digital assets under the new law.</p>
                            </div>
                            <button className="btn btn-outline btn-sm">Download PDF</button>
                        </div>
                    </div>
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

        /* Article Card */
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

        /* Video Card */
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
          background-size: cover;
          background-position: center;
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

        /* Resources */
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
