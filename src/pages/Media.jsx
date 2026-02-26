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
                        {[1, 2, 3].map(i => (
                            <div key={i} className="article-card">
                                <div className="card-img"></div>
                                <div className="card-body">
                                    <div className="meta">Oct 24, 2024 • Regulatory</div>
                                    <h3>El Salvador Passes New Digital Securities Law</h3>
                                    <p>What this means for builders and international investors looking to tokenize assets.</p>
                                    <a href="#" className="read-more">Read Article →</a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'video' && (
                    <div className="grid grid-cols-2 gap-lg">
                        <div className="video-card">
                            <div className="video-thumb">
                                <div className="play-btn"><Play size={24} fill="white" /></div>
                            </div>
                            <h3>Builder Spotlight: Geothermal Inc.</h3>
                            <p>Interview with CEO Maria Gonzalez on mining with volcano power.</p>
                        </div>
                        <div className="video-card">
                            <div className="video-thumb">
                                <div className="play-btn"><Play size={24} fill="white" /></div>
                            </div>
                            <h3>Why Invest in El Salvador Now?</h3>
                            <p>Panel discussion with Max Keiser and Stacy Herbert.</p>
                        </div>
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
        .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
        .mb-12 { margin-bottom: 3rem; }
        .mt-8 { margin-top: 2rem; }
        .text-center { text-align: center; }
        .text-gray-500 { color: var(--color-gray-500); }

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
        .video-card { cursor: pointer; }
        .video-thumb {
          height: 300px;
          background: #0A192F;
          border-radius: var(--radius-lg);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }
        .play-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        .video-card:hover .play-btn { transform: scale(1.1); background: var(--color-primary); }

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
