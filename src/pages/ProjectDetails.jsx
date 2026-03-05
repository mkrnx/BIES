import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Users, ArrowLeft, Share2, MessageSquare, Loader2, Heart, AlertTriangle, ExternalLink, FileText, Globe, Briefcase, TrendingUp, Target, Layers } from 'lucide-react';
import { projectsApi, analyticsApi, watchlistApi } from '../services/api';
import DeckRequestButton from '../components/DeckRequestButton';
import ZapButton from '../components/ZapButton';

const ProjectDetails = () => {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isWatchlisted, setIsWatchlisted] = useState(false);
    const [shareTooltip, setShareTooltip] = useState(false);

    useEffect(() => {
        const fetchProject = async () => {
            try {
                const data = await projectsApi.get(id);
                setProject(data);
                analyticsApi.recordView(id).catch(() => { });
                watchlistApi.check(id).then(res => {
                    setIsWatchlisted(res?.watched || false);
                }).catch(() => { });
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

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setShareTooltip(true);
        setTimeout(() => setShareTooltip(false), 2000);
    };

    const formatCurrency = (val) => {
        if (!val) return '—';
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
        return `$${val}`;
    };

    const stageLabel = (s) => {
        const map = { IDEA: 'Ideation', MVP: 'MVP / Prototype', GROWTH: 'Growth', SCALING: 'Scaling' };
        return map[s] || s || '—';
    };

    const categoryLabel = (c) => {
        if (!c) return '—';
        return c.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');
    };

    if (loading) {
        return (
            <div className="pd-loading">
                <Loader2 size={36} className="pd-spin" />
                <p>Loading project...</p>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="pd-error">
                <AlertTriangle size={48} />
                <p>{error || 'Project not found'}</p>
                <Link to="/discover" className="pd-error-link">Back to Discover</Link>
            </div>
        );
    }

    const title = project.title || project.name || 'Untitled';
    const description = project.description || '';
    const ownerName = project.owner?.profile?.name || 'Builder';
    const ownerCompany = project.owner?.profile?.company || '';
    const ownerRole = project.ownerRole || '';
    const ownerAvatar = project.owner?.profile?.avatar || '';
    const ownerBio = project.owner?.profile?.bio || '';
    const coverImage = project.thumbnail || project.coverImage || '';
    const website = project.websiteUrl || project.website || '';
    const demoUrl = project.demoUrl || '';
    const raised = project.raisedAmount || project.raised || 0;
    const goal = project.fundingGoal || 0;
    const progressPct = goal > 0 ? Math.round((raised / goal) * 100) : 0;
    const tags = project.tags || [];
    const teamMembers = project.teamMembers || [];
    const teamInfo = project.teamInfo || [];
    const hasDeck = !!project.deckKey;
    const stage = project.stage || 'IDEA';
    const category = project.category || 'OTHER';
    const followerCount = project._count?.watchlisted || 0;
    const viewCount = project._count?.views || project.viewCount || 0;
    const customSections = project.customSections || [];

    return (
        <div className="pd-container">
            <Link to="/discover" className="pd-back">
                <ArrowLeft size={16} /> Back to Discover
            </Link>

            {/* ─── Header ─────────────────────────────── */}
            <header className="pd-header">
                <div className="pd-header-left">
                    <h1 className="pd-title">{title}</h1>
                    {tags.length > 0 && (
                        <p className="pd-tagline">{tags.slice(0, 3).join(' · ')}</p>
                    )}
                    <div className="pd-meta">
                        <span className="pd-meta-item"><MapPin size={15} /> El Salvador</span>
                        <Link to={`/builder/${project.ownerId || project.owner?.id}`} className="pd-meta-item pd-meta-link">
                            <Users size={15} /> Built by {ownerName}
                        </Link>
                    </div>
                </div>
                <div className="pd-header-actions">
                    <button className="pd-btn pd-btn-outline" onClick={handleShare}>
                        <Share2 size={16} />
                        {shareTooltip ? 'Copied!' : 'Share'}
                    </button>
                    <button className="pd-btn pd-btn-primary">
                        <MessageSquare size={16} /> Contact Founder
                    </button>
                </div>
            </header>

            {/* ─── Main Layout ────────────────────────── */}
            <div className="pd-layout">
                {/* ─── Left Column ─────────────────── */}
                <main className="pd-main">
                    {/* Cover Image */}
                    {coverImage && (
                        <div className="pd-cover">
                            <img src={coverImage} alt={title} />
                        </div>
                    )}

                    {/* About */}
                    <section className="pd-card pd-about">
                        <h2>About the Project</h2>
                        <div className="pd-description">
                            {description.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                            ))}
                        </div>
                    </section>

                    {/* Custom Sections */}
                    {customSections.length > 0 && customSections.map((section, i) => (
                        <section key={i} className="pd-card pd-about">
                            <h2>{section.title}</h2>
                            <div className="pd-description">
                                {section.body.split('\n').map((line, j) => (
                                    <p key={j}>{line}</p>
                                ))}
                            </div>
                        </section>
                    ))}



                    {/* Tags */}
                    {tags.length > 0 && (
                        <section className="pd-card">
                            <h2>Tags</h2>
                            <div className="pd-tags">
                                {tags.map((tag, i) => (
                                    <span key={i} className="pd-tag">{tag}</span>
                                ))}
                            </div>
                        </section>
                    )}
                </main>

                {/* ─── Sidebar ─────────────────────── */}
                <aside className="pd-sidebar">
                    {/* Funding Status */}
                    <div className="pd-card pd-funding">
                        <h3>Funding Status</h3>
                        <div className="pd-funding-stage">
                            <span className="pd-label">Stage:</span>
                            <span className="pd-value">{stageLabel(stage)}</span>
                        </div>
                        {goal > 0 && (
                            <>
                                <div className="pd-progress-info">
                                    <span>{formatCurrency(raised)}</span>
                                    <span className="pd-muted">/ {formatCurrency(goal)}</span>
                                </div>
                                <div className="pd-progress-bar">
                                    <div className="pd-progress-fill" style={{ width: `${Math.min(progressPct, 100)}%` }} />
                                </div>
                                <p className="pd-progress-pct">{progressPct}% funded</p>
                            </>
                        )}
                        <div className="pd-funding-actions">
                            <DeckRequestButton projectId={id} />
                            <button
                                className={`pd-btn pd-btn-express ${isWatchlisted ? 'active' : ''}`}
                                onClick={toggleWatchlist}
                            >
                                <Heart size={16} fill={isWatchlisted ? 'currentColor' : 'none'} />
                                {isWatchlisted ? 'Following' : 'Express Interest'}
                            </button>
                        </div>
                    </div>

                    {/* Core Team */}
                    <div className="pd-card pd-team">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0 }}>Core Team</h3>
                            <ZapButton
                                recipients={[
                                    ...(project.owner?.nostrPubkey ? [{ pubkey: project.owner.nostrPubkey, name: ownerName, avatar: ownerAvatar }] : []),
                                    ...teamMembers.filter(tm => tm.user?.nostrPubkey).map(tm => ({
                                        pubkey: tm.user.nostrPubkey,
                                        name: tm.user?.profile?.name || 'Team Member',
                                        avatar: tm.user?.profile?.avatar || '',
                                    })),
                                ]}
                                label={teamMembers.filter(tm => tm.user?.nostrPubkey).length > 0 ? 'Zap Team' : 'Zap'}
                                size="sm"
                            />
                        </div>
                        <div className="pd-team-founder">
                            <div className="pd-avatar">
                                {ownerAvatar ? (
                                    <img src={ownerAvatar} alt={ownerName} />
                                ) : (
                                    <span>{ownerName[0]?.toUpperCase()}</span>
                                )}
                            </div>
                            <div>
                                <div className="pd-team-name">{ownerName}</div>
                                {ownerRole ? (
                                    <div className="pd-team-role">{ownerRole}</div>
                                ) : ownerCompany ? (
                                    <div className="pd-team-role">{ownerCompany}</div>
                                ) : null}
                            </div>
                        </div>

                        {teamMembers.length > 0 && (
                            <div className="pd-team-list">
                                {teamMembers.map((tm, i) => {
                                    const name = tm.user?.profile?.name || 'Team Member';
                                    const avatar = tm.user?.profile?.avatar || '';
                                    const role = tm.title || tm.role || 'Member';
                                    return (
                                        <div key={i} className="pd-team-member">
                                            <div className="pd-avatar sm">
                                                {avatar ? <img src={avatar} alt={name} /> : <span>{name[0]}</span>}
                                            </div>
                                            <div>
                                                <div className="pd-team-name sm">{name}</div>
                                                <div className="pd-team-role">{role}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Manually added team members */}
                        {teamInfo.length > 0 && (
                            <div className="pd-team-list">
                                {teamInfo.map((tm, i) => (
                                    <div key={`ti-${i}`} className="pd-team-member">
                                        <div className="pd-avatar sm">
                                            {tm.avatar ? <img src={tm.avatar} alt={tm.name} /> : <span>{(tm.name || '?')[0]?.toUpperCase()}</span>}
                                        </div>
                                        <div>
                                            <div className="pd-team-name sm">{tm.name}</div>
                                            {tm.position && <div className="pd-team-role">{tm.position}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Links */}
                        <div className="pd-team-links">
                            {website && (
                                <a href={website} target="_blank" rel="noopener noreferrer" className="pd-doc-link">
                                    <Globe size={16} /> Website
                                    <ExternalLink size={13} className="pd-link-ext" />
                                </a>
                            )}
                            {demoUrl && (
                                <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="pd-doc-link">
                                    <ExternalLink size={16} /> Demo
                                    <ExternalLink size={13} className="pd-link-ext" />
                                </a>
                            )}
                            {hasDeck && (
                                <div className="pd-doc-link pd-doc-available">
                                    <FileText size={16} /> Pitch Deck Available
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Info (Moved from main area) */}
                    <div className="pd-card pd-info-sidebar">
                        <h3>Project Info</h3>
                        <div className="pd-info-list">
                            <div className="pd-info-row">
                                <Target size={18} className="pd-info-icon-sm" />
                                <div>
                                    <h4>Stage</h4>
                                    <p>{stageLabel(stage)}</p>
                                </div>
                            </div>
                            <div className="pd-info-row">
                                <Layers size={18} className="pd-info-icon-sm" />
                                <div>
                                    <h4>Category</h4>
                                    <p>{categoryLabel(category)}</p>
                                </div>
                            </div>
                            {goal > 0 && (
                                <div className="pd-info-row">
                                    <TrendingUp size={18} className="pd-info-icon-sm" />
                                    <div>
                                        <h4>Fundraising</h4>
                                        <p>{formatCurrency(raised)} / {formatCurrency(goal)}</p>
                                    </div>
                                </div>
                            )}
                            <div className="pd-info-row">
                                <Briefcase size={18} className="pd-info-icon-sm" />
                                <div>
                                    <h4>Traction</h4>
                                    <p>{viewCount} views · {followerCount} followers</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* ─── Styles ─────────────────────────────── */}
            <style>{`
                .pd-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem 2rem 4rem;
                }

                /* Loading & Error */
                .pd-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rem 2rem; color: #6b7280; gap: 1rem; }
                .pd-spin { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .pd-error { text-align: center; padding: 6rem 2rem; color: #6b7280; }
                .pd-error svg { color: #d1d5db; margin-bottom: 1rem; }
                .pd-error-link { color: var(--color-primary); margin-top: 1rem; display: inline-block; }

                /* Back Link */
                .pd-back {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    color: #6b7280; font-weight: 500; font-size: 0.9rem;
                    margin-bottom: 1.5rem; transition: color 0.15s;
                    text-decoration: none;
                }
                .pd-back:hover { color: var(--color-primary); }

                /* Header */
                .pd-header {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    padding-bottom: 1.5rem; margin-bottom: 2rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                .pd-title {
                    font-size: 2.25rem; font-weight: 800; letter-spacing: -0.025em;
                    color: #111827; margin: 0 0 0.25rem;
                    line-height: 1.2;
                }
                .pd-tagline { color: #6b7280; font-size: 1rem; font-style: italic; margin: 0 0 0.75rem; }
                .pd-meta { display: flex; flex-wrap: wrap; gap: 1.25rem; color: #6b7280; font-size: 0.88rem; }
                .pd-meta-item { display: flex; align-items: center; gap: 5px; }
                .pd-meta-link { text-decoration: none; color: #6b7280; transition: color 0.15s; }
                .pd-meta-link:hover { color: var(--color-primary); }
                .pd-header-actions { display: flex; gap: 0.75rem; flex-shrink: 0; }

                /* Buttons */
                .pd-btn {
                    display: inline-flex; align-items: center; gap: 0.4rem;
                    padding: 0.6rem 1.2rem; border-radius: 99px;
                    font-size: 0.88rem; font-weight: 600;
                    cursor: pointer; border: 2px solid transparent;
                    transition: all 0.15s; white-space: nowrap;
                }
                .pd-btn-outline {
                    background: white; border-color: #d1d5db; color: #374151;
                }
                .pd-btn-outline:hover { border-color: #9ca3af; background: #f9fafb; }
                .pd-btn-primary {
                    background: var(--color-secondary, #F97316); color: white; border-color: var(--color-secondary, #F97316);
                }
                .pd-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249,115,22,0.3); }
                .pd-btn-express {
                    width: 100%; justify-content: center;
                    background: white; border: 2px solid #d1d5db; color: #374151;
                    border-radius: 8px; padding: 0.65rem;
                }
                .pd-btn-express:hover { border-color: var(--color-primary); color: var(--color-primary); }
                .pd-btn-express.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

                /* Layout */
                .pd-layout {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 2rem;
                    align-items: start;
                }

                /* Cover Image */
                .pd-cover {
                    border-radius: 12px; overflow: hidden;
                    margin-bottom: 2rem;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                }
                .pd-cover img {
                    width: 100%; height: 360px; object-fit: cover;
                    display: block;
                }

                /* Cards */
                .pd-card {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 1.75rem;
                    margin-bottom: 1.75rem;
                }
                .pd-card h2 {
                    font-size: 1.35rem; font-weight: 700; color: #111827;
                    margin: 0 0 1.25rem; letter-spacing: -0.01em;
                }
                .pd-card h3 {
                    font-size: 1.1rem; font-weight: 700; color: #111827;
                    margin: 0 0 1.25rem;
                }

                /* About */
                .pd-description p {
                    line-height: 1.75; color: #4b5563;
                    margin: 0 0 1rem; font-size: 0.95rem;
                }
                .pd-description p:last-child { margin-bottom: 0; }

                /* Sidebar Info Cards */
                .pd-info-sidebar { margin-top: 1.75rem; }
                .pd-info-list { display: flex; flex-direction: column; gap: 1.25rem; }
                .pd-info-row { display: flex; align-items: flex-start; gap: 1rem; }
                .pd-info-icon-sm { color: var(--color-primary); margin-top: 0.15rem; flex-shrink: 0; }
                .pd-info-row h4 { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin: 0 0 0.25rem; }
                .pd-info-row p { font-size: 0.95rem; font-weight: 600; color: #111827; margin: 0; }


                /* Tags */
                .pd-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .pd-tag {
                    padding: 4px 12px; border-radius: 99px;
                    font-size: 0.8rem; font-weight: 500;
                    background: #f3f4f6; color: #4b5563;
                    border: 1px solid #e5e7eb;
                }

                /* Sidebar Funding */
                .pd-funding { border-top: 4px solid var(--color-secondary, #F97316); }
                .pd-funding-stage { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
                .pd-label { font-size: 0.88rem; color: #6b7280; font-weight: 500; }
                .pd-value { font-size: 0.88rem; font-weight: 700; color: #111827; }
                .pd-muted { color: #9ca3af; font-weight: 400; }

                .pd-progress-info {
                    display: flex; justify-content: space-between; align-items: baseline;
                    font-size: 1rem; font-weight: 700; color: #111827;
                    margin-bottom: 0.5rem;
                }
                .pd-progress-bar {
                    height: 8px; background: #e5e7eb; border-radius: 99px;
                    overflow: hidden; margin-bottom: 0.4rem;
                }
                .pd-progress-fill {
                    height: 100%; border-radius: 99px;
                    background: linear-gradient(90deg, var(--color-primary) 0%, var(--color-success, #22c55e) 100%);
                    transition: width 0.6s ease;
                }
                .pd-progress-pct { font-size: 0.78rem; color: #6b7280; margin: 0; }

                .pd-funding-actions {
                    display: flex; flex-direction: column; gap: 0.6rem;
                    margin-top: 1.5rem;
                }

                /* Core Team */
                .pd-team-founder { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
                .pd-avatar {
                    width: 48px; height: 48px; border-radius: 50%;
                    background: linear-gradient(135deg, var(--color-primary), var(--color-secondary, #F97316));
                    display: flex; align-items: center; justify-content: center;
                    overflow: hidden; flex-shrink: 0;
                }
                .pd-avatar span { color: white; font-weight: 700; font-size: 1.1rem; }
                .pd-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .pd-avatar.sm { width: 36px; height: 36px; }
                .pd-avatar.sm span { font-size: 0.85rem; }
                .pd-team-name { font-weight: 700; color: #111827; font-size: 0.95rem; }
                .pd-team-name.sm { font-size: 0.88rem; }
                .pd-team-role { font-size: 0.82rem; color: #6b7280; }
                .pd-team-bio { font-size: 0.85rem; line-height: 1.6; color: #6b7280; margin: 0.5rem 0 0; }
                .pd-team-list {
                    display: flex; flex-direction: column; gap: 0.75rem;
                    padding-top: 0.75rem; margin-top: 0.75rem;
                    border-top: 1px solid #f3f4f6;
                }
                .pd-team-member { display: flex; align-items: center; gap: 0.6rem; }

                /* Document Links */
                .pd-team-links {
                    margin-top: 1.25rem; padding-top: 1.25rem;
                    border-top: 1px solid #f3f4f6;
                    display: flex; flex-direction: column; gap: 0.5rem;
                }
                .pd-doc-link {
                    display: flex; align-items: center; gap: 0.5rem;
                    padding: 0.5rem 0.75rem; border-radius: 8px;
                    font-size: 0.85rem; font-weight: 500; color: var(--color-primary);
                    background: #f7f9fc; border: 1px solid #e8ecf1;
                    text-decoration: none; cursor: pointer;
                    transition: all 0.15s;
                }
                .pd-doc-link:hover { background: #eef2ff; border-color: #c7d2fe; }
                .pd-link-ext { margin-left: auto; opacity: 0.5; }
                .pd-doc-available { color: #059669; background: #ecfdf5; border-color: #a7f3d0; cursor: default; }

                /* Responsive */
                @media (max-width: 900px) {
                    .pd-layout { grid-template-columns: 1fr; }
                    .pd-header { flex-direction: column; gap: 1rem; }
                    .pd-header-actions { width: 100%; }
                    .pd-cover img { height: 240px; }
                    .pd-title { font-size: 1.75rem; }
                }
            `}</style>
        </div>
    );
};

export default ProjectDetails;
