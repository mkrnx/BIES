import React, { useState } from 'react';
import { TrendingUp, Clock, MessageCircle, ArrowUpRight, Search, Filter, CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';

const InvestorDashboard = () => {
    // Mock Data
    const watchlist = [
        { id: 101, name: 'BitBonds El Salvador', industry: 'Fintech', stage: 'Seed', amount: '250k', raised: '150k', growth: '+12%' },
        { id: 102, name: 'AgriTech Volcanica', industry: 'Agriculture', stage: 'Pre-Seed', amount: '100k', raised: '20k', growth: '+5%' },
        { id: 103, name: 'La Libertad Hotels', industry: 'Real Estate', stage: 'Series A', amount: '5M', raised: '3.2M', growth: '+24%' },
    ];

    const forYou = [
        { id: 201, name: 'Geothermal One', description: 'Bitcoin mining powered by volcano energy.' },
        { id: 202, name: 'Lightning ATM Network', description: 'Expanding BTMs across San Miguel.' },
    ];

    return (
        <div className="dashboard-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-menu">
                    <Link to="/dashboard/investor" className="sidebar-link active">Dashboard</Link>
                    <Link to="/dashboard/investor" className="sidebar-link">My Watchlist</Link>
                    <Link to="/messages" className="sidebar-link">Messages</Link>
                    <Link to="/discover" className="sidebar-link">Deal Flow</Link>
                    <Link to="/dashboard/investor/create-event" className="sidebar-link">Create Event</Link>
                    <div className="divider"></div>
                    <Link to="/settings" className="sidebar-link">Settings</Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="dashboard-content">
                <div className="header">
                    <div>
                        <h1>Investor Dashboard</h1>
                        <p className="subtitle">Welcome back, Capital Ventures.</p>
                    </div>
                    <Link to="/discover" className="btn btn-secondary">
                        <Search size={18} style={{ marginRight: 8 }} /> Find Projects
                    </Link>
                </div>

                {/* Portfolio Stats Widgets */}
                <div className="stats-grid">
                    <div className="stat-box featured">
                        <span className="label">Capital Deployed</span>
                        <div className="value-row">
                            <span className="value">$1.2M</span>
                            <span className="change positive">
                                <TrendingUp size={16} /> +12%
                            </span>
                        </div>
                    </div>
                    <div className="stat-box">
                        <span className="label">Active Projects</span>
                        <div className="value-row">
                            <span className="value">12</span>
                            <span className="sub">in portfolio</span>
                        </div>
                    </div>
                    <div className="stat-box">
                        <span className="label">Pitch Decks Reviewed</span>
                        <div className="value-row">
                            <span className="value">48</span>
                            <span className="sub">this month</span>
                        </div>
                    </div>
                </div>

                <div className="content-grid">
                    {/* Watchlist Section */}
                    <section className="dashboard-card main-card">
                        <div className="card-header">
                            <h3>My Watchlist</h3>
                            <button className="text-secondary text-sm font-semibold">View All</button>
                        </div>
                        <table className="watchlist-table">
                            <thead>
                                <tr>
                                    <th>Project</th>
                                    <th>Industry</th>
                                    <th>Stage</th>
                                    <th>Target</th>
                                    <th>Growth</th>
                                </tr>
                            </thead>
                            <tbody>
                                {watchlist.map(item => (
                                    <tr key={item.id}>
                                        <td className="font-semibold">{item.name}</td>
                                        <td>{item.industry}</td>
                                        <td><span className="pill">{item.stage}</span></td>
                                        <td>${item.amount}</td>
                                        <td className="text-success">{item.growth}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    {/* For You Section */}
                    <section className="dashboard-card side-card">
                        <div className="card-header">
                            <h3>For You</h3>
                        </div>
                        <div className="recommendations-list">
                            {forYou.map(item => (
                                <div key={item.id} className="rec-item">
                                    <div className="rec-icon">
                                        <ArrowUpRight size={18} />
                                    </div>
                                    <div className="rec-content">
                                        <h4>{item.name}</h4>
                                        <p>{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-outline w-full mt-4">Discover More</button>
                    </section>
                </div>
            </main>

            <style jsx>{`
        .dashboard-layout {
          display: flex;
          min-height: calc(100vh - 70px);
          background: var(--color-gray-100);
        }

        .sidebar {
          width: 250px;
          background: white;
          border-right: 1px solid var(--color-gray-200);
          padding: 2rem 1rem;
        }

        .sidebar-link {
          display: flex;
          align-items: center;
          padding: 0.75rem 1rem;
          color: var(--color-gray-500);
          border-radius: var(--radius-md);
          margin-bottom: 0.25rem;
          font-weight: 500;
        }
        
        .sidebar-link:hover { background: var(--color-gray-100); color: var(--color-neutral-dark); }
        .sidebar-link.active { background: #FFF7ED; color: var(--color-secondary); font-weight: 600; }

        .divider { height: 1px; background: var(--color-gray-200); margin: 1rem 0; }

        .dashboard-content {
          flex: 1;
          padding: 2rem;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .subtitle { color: var(--color-gray-500); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stat-box {
          background: white;
          padding: 1.5rem;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }
        
        .stat-box.featured {
            background: linear-gradient(135deg, #FF5B00 0%, #CC4A00 100%);
            color: white;
        }
        .stat-box.featured .label { color: rgba(255,255,255,0.9); }
        .stat-box.featured .change { color: white; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 99px; }


        .stat-box .label { display: block; color: var(--color-gray-400); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .value-row { display: flex; align-items: center; gap: 0.75rem; }
        .value-row .value { font-size: 2rem; font-weight: 700; font-family: var(--font-mono); }
        .change { display: flex; align-items: center; font-size: 0.875rem; font-weight: 600; gap: 4px; }
        .sub { font-size: 0.875rem; color: var(--color-gray-400); }

        .content-grid {
            display: flex;
            gap: 1.5rem;
        }

        .dashboard-card {
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          padding: 1.5rem;
        }
        .main-card { flex: 2; }
        .side-card { flex: 1; }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        
        /* Watchlist Table */
        .watchlist-table { width: 100%; border-collapse: collapse; }
        .watchlist-table th { text-align: left; padding-bottom: 1rem; color: var(--color-gray-400); font-size: 0.85rem; }
        .watchlist-table td { padding: 0.75rem 0; font-size: 0.95rem; border-bottom: 1px solid var(--color-gray-100); }
        .watchlist-table tr:last-child td { border-bottom: none; }
        
        .pill { background: var(--color-gray-100); padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; color: var(--color-gray-600); }
        .text-success { color: var(--color-success); font-weight: 600; }

        /* Recommendations */
        .rec-item {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            padding: 1rem;
            border: 1px solid var(--color-gray-100);
            border-radius: var(--radius-md);
            transition: transform 0.2s;
        }
        .rec-item:hover { transform: translateY(-2px); border-color: var(--color-secondary); }
        
        .rec-icon {
            width: 32px; height: 32px; background: #FFF7ED; border-radius: 50%; color: var(--color-secondary);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .rec-content h4 { font-size: 0.95rem; margin-bottom: 0.25rem; }
        .rec-content p { font-size: 0.85rem; color: var(--color-gray-500); line-height: 1.3; }

        .w-full { width: 100%; }
        .mt-4 { margin-top: 1rem; }

        @media (max-width: 1024px) {
            .content-grid { flex-direction: column; }
        }

        @media (max-width: 768px) {
          .dashboard-layout { flex-direction: column; }
          .sidebar { width: 100%; border-right: none; display: flex; overflow-x: auto; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
        </div>
    );
};

export default InvestorDashboard;
