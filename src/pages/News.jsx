import React from 'react';
import { Twitter, TrendingUp } from 'lucide-react';

const News = () => {
    return (
        <div className="news-page container py-8">
            <div className="grid news-layout">

                {/* Left Column: Social Pulse */}
                <aside className="news-col sidebar-col">
                    <div className="col-header">
                        <h3>Social Pulse</h3>
                        <span className="live-badge">LIVE</span>
                    </div>
                    <div className="social-feed">
                        <div className="tweet-card">
                            <div className="tweet-header">
                                <div className="avatar">NB</div>
                                <div className="u-info">@nayibbukele <Twitter size={12} className="inline ml-1 text-blue-400" /></div>
                            </div>
                            <p>El Salvador is the spark that will ignite the real revolution. #Bitcoin</p>
                        </div>
                        <div className="tweet-card">
                            <div className="tweet-header">
                                <div className="avatar">BO</div>
                                <div className="u-info">@BitcoinOffice</div>
                            </div>
                            <p>New investment laws are now in effect. 0% capital gains tax for foreign tech investment.</p>
                        </div>
                        <div className="tweet-card">
                            <div className="tweet-header">
                                <div className="avatar">MK</div>
                                <div className="u-info">@MaxKeiser</div>
                            </div>
                            <p>It's happening. The Volcanic Bonds are oversubscribed.</p>
                        </div>
                    </div>
                </aside>

                {/* Middle Column: Main News */}
                <main className="news-col main-col">
                    <div className="col-header">
                        <h3>Top Stories</h3>
                    </div>

                    <div className="news-item featured">
                        <div className="news-img"></div>
                        <div className="news-content">
                            <span className="tag">Economy</span>
                            <h2>IMF Updates Economic Outlook for El Salvador</h2>
                            <p className="excerpt">International Monetary Fund acknowledges the significant growth driven by tourism and digital asset adoption.</p>
                        </div>
                    </div>

                    <div className="news-item">
                        <div className="news-content">
                            <span className="tag">Infrastructure</span>
                            <h3>"Bitcoin City" Airport Construction Begins Phase 1</h3>
                        </div>
                    </div>

                    <div className="news-item">
                        <div className="news-content">
                            <span className="tag">Energy</span>
                            <h3>Volcano Energy Pool Hashrate Hits All Time High</h3>
                        </div>
                    </div>
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

        /* Tweet Card */
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
        }
        .u-info { font-size: 0.85rem; font-weight: 600; }
        .tweet-card p { font-size: 0.9rem; line-height: 1.4; }

        /* News Items */
        .news-item {
          background: white;
          border-radius: var(--radius-md);
          overflow: hidden;
          margin-bottom: 1.5rem;
          border: 1px solid var(--color-gray-200);
        }
        .news-item.featured .news-img {
          height: 250px;
          background: var(--color-gray-200);
        }
        .news-content { padding: 1.5rem; }
        .tag { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.05em; color: var(--color-primary); text-transform: uppercase; display: block; margin-bottom: 0.5rem; }
        .news-item h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .news-item h3 { font-size: 1.1rem; }
        .excerpt { color: var(--color-gray-500); font-size: 1rem; }

        /* Updates */
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
          .sidebar-col { display: none; } /* Show only main on tablet/mobile for mvp */
        }
      `}</style>
        </div>
    );
};

export default News;
