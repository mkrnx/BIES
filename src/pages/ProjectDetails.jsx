import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, DollarSign, Users, Download, ArrowLeft, Share2, MessageSquare, Loader2, Heart, AlertTriangle } from 'lucide-react';
import { projectsApi, analyticsApi, watchlistApi } from '../services/api';
import DeckRequestButton from '../components/DeckRequestButton';

const ProjectDetails = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWatchlisted, setIsWatchlisted] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const data = await projectsApi.get(id);
                setProject(data);

                // Record view
                analyticsApi.recordView(id).catch(() => {});

                // Check watchlist status
                watchlistApi.check(id).then(res => {
                    setIsWatchlisted(res?.watched || false);
                }).catch(() => {});
            } catch (err) {
                setError('Project not found');
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [id]);

    const toggleWatchlist = async () => {
        try {
            if (isWatchlisted) {
                await watchlistApi.remove(id);
            } else {
                await watchlistApi.add(id);
            }
            setIsWatchlisted(!isWatchlisted);
        } catch { /* ignore */ }
    };

    const formatCurrency = (val) => {
        if (!val) return '—';
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="container py-8" style={{ textAlign: 'center', padding: '4rem' }}>
                <AlertTriangle size={48} style={{ color: 'var(--color-gray-400)', marginBottom: '1rem' }} />
                <p>{error || 'Project not found'}</p>
                <Link to="/discover" style={{ color: 'var(--color-primary)', marginTop: '1rem', display: 'inline-block' }}>Back to Discover</Link>
            </div>
        );
    }

    const raised = project.raised || 0;
    const goal = project.fundingGoal || 0;
    const progressPct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
    const traction = project.traction || [];
    const team = project.team || [];

    return (
        <div className="container py-8">
            <Link to="/discover" className="back-link">
                <ArrowLeft size={16} /> Back to Discover
            </Link>

            <div className="project-header">
                <div>
                    <div className="badges">
                        <span className="badge industry">{project.category || project.industry || '—'}</span>
                        <span className="badge stage">{project.stage || '—'}</span>
                    </div>
                    <h1>{project.name}</h1>
                    <div className="meta">
                        <div className="meta-item"><MapPin size={16} /> {project.location || 'El Salvador'}</div>
                        {(project.owner?.name || project.builder) && (
                            <div className="meta-item"><Users size={16} /> Built by {project.owner?.name || project.builder}</div>
                        )}
                    </div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-outline" onClick={() => navigator.clipboard.writeText(window.location.href)}><Share2 size={18} /> Share</button>
                    <button className="btn btn-primary">
                        <MessageSquare size={18} style={{ marginRight: 8 }} /> Contact Builder
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8 main-layout">
                {/* Main Content */}
                <div className="col-span-2">
                    {project.coverImage && (
                        <div className="detail-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                            <img src={project.coverImage} alt={project.name} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
                        </div>
                    )}

                    <section className="detail-card">
                        <h3>About the Project</h3>
                        <p className="text-body">{project.description}</p>
                    </section>

                    {traction.length > 0 && (
                        <section className="detail-card">
                            <h3>Traction & Metrics</h3>
                            <div className="metrics-grid">
                                {traction.map((stat, i) => (
                                    <div key={i} className="metric-box">
                                        <span className="metric-value">{stat.value}</span>
                                        <span className="metric-label">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {team.length > 0 && (
                        <section className="detail-card">
                            <h3>Core Team</h3>
                            <div className="team-list">
                                {team.map((member, i) => (
                                    <div key={i} className="team-member">
                                        <div className="member-avatar">{(member.name || '?')[0]}</div>
                                        <div>
                                            <div className="member-name">{member.name}</div>
                                            <div className="member-role">{member.role}{member.exp ? ` • ${member.exp}` : ''}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="sidebar">
                    <div className="detail-card funding-card">
                        <h3>Funding Status</h3>
                        <div className="funding-progress">
                            <div className="flex justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Raised</span>
                                <span className="text-sm font-bold text-primary">{formatCurrency(raised)} <span className="text-gray-400 font-normal">/ {formatCurrency(goal)}</span></span>
                            </div>
                            <div className="progress-bar">
                                <div className="fill" style={{ width: `${Math.min(progressPct, 100)}%` }}></div>
                            </div>
                            {project.minTicket && (
                                <p className="text-xs text-gray-500 mt-2">Min. Ticket: {formatCurrency(project.minTicket)}</p>
                            )}
                        </div>
                        <DeckRequestButton projectId={id} />
                        <button className={`btn ${isWatchlisted ? 'btn-primary' : 'btn-outline'} w-full mt-2`} onClick={toggleWatchlist}>
                            <Heart size={16} fill={isWatchlisted ? 'currentColor' : 'none'} style={{ marginRight: 6 }} />
                            {isWatchlisted ? 'Watching' : 'Follow Project'}
                        </button>
                    </div>

                    {project.website && (project.website.startsWith('https://') || project.website.startsWith('http://')) && (
                        <div className="detail-card">
                            <h3>Links</h3>
                            <a href={project.website} target="_blank" rel="noopener noreferrer" className="project-link">{project.website}</a>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .back-link { display: flex; align-items: center; gap: 0.5rem; color: var(--color-gray-500); margin-bottom: 2rem; font-weight: 500; }
                .back-link:hover { color: var(--color-primary); }

                .project-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; border-bottom: 1px solid var(--color-gray-200); padding-bottom: 2rem; }
                .project-header h1 { font-size: 2.5rem; margin: 0.5rem 0; letter-spacing: -0.02em; }

                .badges { display: flex; gap: 0.5rem; }
                .badge { padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
                .badge.industry { background: #E0F2FE; color: var(--color-primary); }
                .badge.stage { background: var(--color-gray-100); color: var(--color-gray-700); }

                .meta { display: flex; gap: 1.5rem; color: var(--color-gray-500); font-weight: 500; }
                .meta-item { display: flex; align-items: center; gap: 6px; }

                .header-actions { display: flex; gap: 1rem; }

                .gap-8 { gap: 2rem; }

                .detail-card { background: white; border-radius: var(--radius-lg); border: 1px solid var(--color-gray-200); padding: 2rem; margin-bottom: 2rem; }
                .detail-card h3 { font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--color-neutral-dark); }
                .text-body { line-height: 1.6; color: var(--color-gray-600); }

                .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                .metric-box { background: var(--color-gray-100); padding: 1.5rem; border-radius: var(--radius-md); text-align: center; }
                .metric-value { display: block; font-size: 1.5rem; font-weight: 700; color: var(--color-primary); }
                .metric-label { font-size: 0.85rem; color: var(--color-gray-500); }

                .team-list { display: flex; flex-direction: column; gap: 1rem; }
                .team-member { display: flex; align-items: center; gap: 1rem; }
                .member-avatar { width: 48px; height: 48px; background: var(--color-gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--color-gray-500); }
                .member-name { font-weight: 600; }
                .member-role { font-size: 0.9rem; color: var(--color-gray-500); }

                .funding-card { border-top: 4px solid var(--color-secondary); }
                .progress-bar { height: 8px; background: var(--color-gray-100); border-radius: 99px; overflow: hidden; margin-bottom: 0.5rem; }
                .fill { height: 100%; background: var(--color-success); }

                .main-layout { grid-template-columns: 2fr 1fr; }

                .project-link { color: var(--color-primary); word-break: break-all; }

                @media (max-width: 768px) {
                    .project-header { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
                    .main-layout { grid-template-columns: 1fr; }
                    .metrics-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default ProjectDetails;
