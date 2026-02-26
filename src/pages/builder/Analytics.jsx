import React from 'react';
import { BarChart2, TrendingUp, Users, Calendar } from 'lucide-react';

const Analytics = () => {
    return (
        <div className="page-content">
            <div className="header">
                <div>
                    <h1>Analytics</h1>
                    <p className="subtitle">Performance metrics for your projects</p>
                </div>
                <div className="date-filter">
                    <Calendar size={16} /> Last 30 Days
                </div>
            </div>

            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-header">
                        <span>Total Views</span>
                        <EyeIcon />
                    </div>
                    <div className="metric-value">2,450</div>
                    <div className="metric-change positive">
                        <TrendingUp size={14} /> +12%
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-header">
                        <span>Unique Visitors</span>
                        <Users size={18} className="text-gray-400" />
                    </div>
                    <div className="metric-value">1,820</div>
                    <div className="metric-change positive">
                        <TrendingUp size={14} /> +8%
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-header">
                        <span>Investor Interest</span>
                        <BarChart2 size={18} className="text-gray-400" />
                    </div>
                    <div className="metric-value">45</div>
                    <div className="metric-change neutral">
                        <span>0%</span>
                    </div>
                </div>
            </div>

            <div className="charts-section">
                <div className="chart-card main-chart">
                    <h3>Traffic Overview</h3>
                    <div className="chart-placeholder">
                        <div className="fake-graph">
                            {/* CSS Art Graph */}
                            <div className="bar" style={{ height: '40%' }}></div>
                            <div className="bar" style={{ height: '60%' }}></div>
                            <div className="bar" style={{ height: '50%' }}></div>
                            <div className="bar" style={{ height: '80%' }}></div>
                            <div className="bar" style={{ height: '70%' }}></div>
                            <div className="bar" style={{ height: '90%' }}></div>
                            <div className="bar" style={{ height: '65%' }}></div>
                        </div>
                    </div>
                </div>
                <div className="chart-card side-chart">
                    <h3>Visitor Locations</h3>
                    <ul className="location-list">
                        <li>
                            <span>El Salvador</span>
                            <span className="font-mono">45%</span>
                        </li>
                        <li>
                            <span>United States</span>
                            <span className="font-mono">30%</span>
                        </li>
                        <li>
                            <span>Canada</span>
                            <span className="font-mono">10%</span>
                        </li>
                        <li>
                            <span>Germany</span>
                            <span className="font-mono">8%</span>
                        </li>
                        <li>
                            <span>Other</span>
                            <span className="font-mono">7%</span>
                        </li>
                    </ul>
                </div>
            </div>

            <style jsx>{`
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }
                
                .date-filter {
                    background: white;
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    color: var(--color-gray-600);
                    cursor: pointer;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .metric-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--color-gray-200);
                }
                
                .metric-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--color-gray-500); text-transform: uppercase; font-weight: 600; }
                .metric-value { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
                .metric-change { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; }
                .metric-change.positive { color: var(--color-success); }
                .metric-change.neutral { color: var(--color-gray-400); }

                .charts-section {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                }

                .chart-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--color-gray-200);
                }
                .chart-card h3 { margin-bottom: 1.5rem; font-size: 1.1rem; }

                .chart-placeholder {
                    height: 200px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                }
                
                .fake-graph {
                    display: flex;
                    align-items: flex-end;
                    gap: 1rem;
                    height: 100%;
                    width: 100%;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }
                .bar {
                    flex: 1;
                    background: var(--color-primary);
                    opacity: 0.8;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.5s ease;
                }

                .location-list { list-style: none; padding: 0; }
                .location-list li {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--color-gray-100);
                    color: var(--color-gray-700);
                    font-size: 0.95rem;
                }
                .location-list li:last-child { border-bottom: none; }

                @media (max-width: 768px) {
                    .metrics-grid { grid-template-columns: 1fr; }
                    .charts-section { grid-template-columns: 1fr; }
                }

                .text-gray-400 { color: var(--color-gray-400); }
            `}</style>
        </div>
    );
};

// Helper
const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);

export default Analytics;
