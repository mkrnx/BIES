import React from 'react';
import { BarChart2, TrendingUp, TrendingDown, Users, Calendar, Loader2 } from 'lucide-react';
import { useApiQuery } from '../../hooks/useApi';
import { analyticsApi } from '../../services/api';

const Analytics = () => {
    const { data: stats, loading, error } = useApiQuery(analyticsApi.builderDashboard);

    const totalViews = stats?.totalViews || 0;
    const uniqueVisitors = stats?.uniqueVisitors || 0;
    const investorInterest = stats?.investorInterest || 0;
    const viewsChange = stats?.viewsChange || 0;
    const visitorsChange = stats?.visitorsChange || 0;
    const interestChange = stats?.interestChange || 0;
    const trafficData = stats?.trafficData || [];
    const locations = stats?.locations || [];

    const maxTraffic = Math.max(...trafficData.map(d => d.value || 0), 1);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (error) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-gray-500)' }}>Failed to load analytics data.</div>;
    }

    return (
        <div className="page-content">
            <div className="header">
                <div className="page-title-block">
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
                    <div className="metric-value">{totalViews.toLocaleString()}</div>
                    <div className={`metric-change ${viewsChange >= 0 ? 'positive' : 'negative'}`}>
                        {viewsChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {viewsChange >= 0 ? '+' : ''}{viewsChange}%
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-header">
                        <span>Unique Visitors</span>
                        <Users size={18} className="text-gray-400" />
                    </div>
                    <div className="metric-value">{uniqueVisitors.toLocaleString()}</div>
                    <div className={`metric-change ${visitorsChange >= 0 ? 'positive' : 'negative'}`}>
                        {visitorsChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {visitorsChange >= 0 ? '+' : ''}{visitorsChange}%
                    </div>
                </div>
                <div className="metric-card">
                    <div className="metric-header">
                        <span>Investor Interest</span>
                        <BarChart2 size={18} className="text-gray-400" />
                    </div>
                    <div className="metric-value">{investorInterest}</div>
                    <div className={`metric-change ${interestChange === 0 ? 'neutral' : interestChange > 0 ? 'positive' : 'negative'}`}>
                        {interestChange === 0 ? <span>0%</span> : (
                            <>{interestChange > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {interestChange > 0 ? '+' : ''}{interestChange}%</>
                        )}
                    </div>
                </div>
            </div>

            <div className="charts-section">
                <div className="chart-card main-chart">
                    <h3>Traffic Overview</h3>
                    <div className="chart-placeholder">
                        <div className="fake-graph">
                            {trafficData.length > 0 ? trafficData.map((d, i) => (
                                <div key={i} className="bar" style={{ height: `${(d.value / maxTraffic) * 100}%` }} title={`${d.label || ''}: ${d.value}`}></div>
                            )) : (
                                <>
                                    <div className="bar" style={{ height: '40%' }}></div>
                                    <div className="bar" style={{ height: '60%' }}></div>
                                    <div className="bar" style={{ height: '50%' }}></div>
                                    <div className="bar" style={{ height: '80%' }}></div>
                                    <div className="bar" style={{ height: '70%' }}></div>
                                    <div className="bar" style={{ height: '90%' }}></div>
                                    <div className="bar" style={{ height: '65%' }}></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="chart-card side-chart">
                    <h3>Visitor Locations</h3>
                    <ul className="location-list">
                        {locations.length > 0 ? locations.map((loc, i) => (
                            <li key={i}>
                                <span>{loc.country || loc.name}</span>
                                <span className="font-mono">{loc.percentage || loc.pct}%</span>
                            </li>
                        )) : (
                            <li style={{ color: 'var(--color-gray-400)' }}>No location data yet</li>
                        )}
                    </ul>
                </div>
            </div>

            <style jsx>{`
                .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }

                .date-filter {
                    background: var(--color-surface);
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-200);
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
                    background: var(--color-surface);
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--color-gray-200);
                }

                .metric-header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--color-gray-500); text-transform: uppercase; font-weight: 600; }
                .metric-value { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
                .metric-change { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 600; }
                .metric-change.positive { color: var(--color-success); }
                .metric-change.negative { color: var(--color-error); }
                .metric-change.neutral { color: var(--color-gray-400); }

                .charts-section {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 1.5rem;
                }

                .chart-card {
                    background: var(--color-surface);
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
                    background: var(--color-secondary);
                    opacity: 0.8;
                    border-radius: 4px 4px 0 0;
                    transition: height 0.5s ease;
                    min-height: 4px;
                }

                .location-list { list-style: none; padding: 0; }
                .location-list li {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid var(--color-gray-100);
                    color: inherit;
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
