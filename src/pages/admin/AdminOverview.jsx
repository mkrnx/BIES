import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Folder, Calendar, Users, Loader2 } from 'lucide-react';
import { adminApi } from '../../services/api';

const AdminOverview = () => {
    const [stats, setStats] = useState({ pendingProjects: 0, totalUsers: 0, totalEvents: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [projectsRes, usersRes, eventsRes] = await Promise.all([
                    adminApi.listProjects({ status: 'pending-review', limit: 1 }),
                    adminApi.users({ limit: 1 }),
                    adminApi.listEvents({ limit: 1 }),
                ]);
                setStats({
                    pendingProjects: projectsRes?.pagination?.total || 0,
                    totalUsers: usersRes?.pagination?.total || 0,
                    totalEvents: eventsRes?.pagination?.total || 0,
                });
            } catch (err) {
                console.error('Failed to fetch admin stats:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <>
            <div className="header">
                <div>
                    <h1>Admin Overview</h1>
                    <p className="subtitle">Platform management dashboard</p>
                </div>
            </div>

            <div className="stats-grid">
                <Link to="/admin/projects" className="stat-box featured" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="label">Pending Projects</span>
                    <div className="value-row">
                        <Folder size={20} />
                        <span className="value">{stats.pendingProjects}</span>
                    </div>
                    <span className="action-hint">Review submissions →</span>
                </Link>
                <Link to="/admin/users" className="stat-box" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="label">Total Users</span>
                    <div className="value-row">
                        <Users size={20} style={{ color: 'var(--color-primary)' }} />
                        <span className="value">{stats.totalUsers}</span>
                    </div>
                    <span className="action-hint">Manage users →</span>
                </Link>
                <Link to="/admin/events" className="stat-box" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <span className="label">Total Events</span>
                    <div className="value-row">
                        <Calendar size={20} style={{ color: 'var(--color-secondary)' }} />
                        <span className="value">{stats.totalEvents}</span>
                    </div>
                    <span className="action-hint">Manage events →</span>
                </Link>
            </div>

            <style jsx>{`
                .header { margin-bottom: 2rem; }
                .subtitle { color: var(--color-gray-500); }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }
                .stat-box {
                    background: var(--color-surface-raised);
                    padding: 1.5rem;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    transition: transform 0.15s;
                }
                .stat-box:hover { transform: translateY(-2px); }
                .stat-box.featured {
                    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
                    color: white;
                }
                .stat-box.featured .label { color: rgba(255,255,255,0.8); }
                .stat-box.featured .action-hint { color: rgba(255,255,255,0.7); }
                .stat-box .label { display: block; color: var(--color-gray-500); font-size: 0.875rem; margin-bottom: 0.5rem; }
                .value-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
                .value-row .value { font-size: 1.75rem; font-weight: 700; font-family: var(--font-mono); }
                .action-hint { font-size: 0.8rem; color: var(--color-gray-500); }
                @media (max-width: 768px) {
                    .header { margin-bottom: 1.25rem; }
                    .header h1 { font-size: 1.25rem; }
                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 0.75rem;
                        margin-bottom: 2rem;
                    }
                    .stat-box { padding: 1rem; }
                    .value-row .value { font-size: 1.35rem; }
                    .stat-box .label { font-size: 0.8rem; margin-bottom: 0.25rem; }
                    .action-hint { font-size: 0.7rem; }
                }
            `}</style>
        </>
    );
};

export default AdminOverview;
