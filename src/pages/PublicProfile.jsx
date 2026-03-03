import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Briefcase, Tag, ArrowLeft, Globe, Twitter, Linkedin, MessageSquare, ExternalLink, UserCheck, MoreHorizontal, Share } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { builders, investors } from '../data/mockProfiles';
import { nostrService } from '../services/nostrService';
import NostrFeed from '../components/NostrFeed';
import NostrIcon from '../components/NostrIcon';

const PublicProfile = ({ type }) => {
    const { id } = useParams();
    const data = type === 'builder' ? builders : investors;
    const profile = data.find(p => p.id === parseInt(id));
    const [showMenu, setShowMenu] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [nostrProfile, setNostrProfile] = useState(null);

    useEffect(() => {
        if (profile?.nostrNpub) {
            try {
                const decoded = nip19.decode(profile.nostrNpub);
                if (decoded.type === 'npub') {
                    nostrService.getProfile(decoded.data).then(setNostrProfile);
                }
            } catch {
                // Invalid npub (e.g. mock data placeholder) — skip
            }
        }
    }, [profile?.nostrNpub]);

    if (!profile) {
        return <div className="p-10 text-center text-gray-500">Profile not found</div>;
    }

    const projectsTitle = type === 'builder' ? 'Working On' : 'Invested In';

    return (
        <div className="profile-page">


            <div className="container py-8">
                {/* Facebook Style Header Card */}
                <div className="profile-card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Cover Banner */}
                    <div className="relative" style={{ height: '240px', background: 'linear-gradient(to right, #0052cc, #0a192f)' }}>
                        <Link to={type === 'builder' ? '/builders' : '/investors'} className="absolute shadow-sm flex items-center justify-center transition-colors text-slate-800 hover:bg-gray-50" style={{ top: '24px', left: '24px', borderRadius: '50%', background: 'white', border: '1px solid var(--color-gray-200)', width: '42px', height: '42px', textDecoration: 'none' }}>
                            <ArrowLeft size={20} />
                        </Link>

                        {/* Top-Right Action Buttons Inside Banner */}
                        <div className="absolute flex gap-4 z-10" style={{ bottom: '24px', right: '24px' }}>
                            <button
                                onClick={() => setIsFollowing(!isFollowing)}
                                className={`btn shadow-sm transition-colors ${isFollowing ? 'btn-primary hover:opacity-90' : 'hover:bg-gray-50'}`}
                                style={{
                                    borderRadius: 'var(--radius-md)',
                                    background: isFollowing ? '' : 'white',
                                    color: isFollowing ? '' : 'var(--color-neutral-dark)',
                                    border: isFollowing ? 'none' : '1px solid var(--color-gray-200)',
                                    height: '42px', padding: '0 24px', whiteSpace: 'nowrap', fontWeight: '600'
                                }}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </button>
                            <Link to="/messages" className="btn btn-primary shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center" style={{ borderRadius: 'var(--radius-md)', height: '42px', padding: '0 24px', whiteSpace: 'nowrap', fontWeight: '600', textDecoration: 'none' }}>
                                Connect
                            </Link>

                            <div className="relative">
                                <button onClick={() => setShowMenu(!showMenu)} className="btn flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors" style={{ borderRadius: 'var(--radius-md)', background: 'white', color: 'var(--color-neutral-dark)', border: '1px solid var(--color-gray-200)', height: '42px', width: '48px', padding: '0' }}>
                                    <MoreHorizontal size={20} />
                                </button>

                                {showMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                                        <button className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm font-medium text-gray-700 transition-colors" onClick={() => setShowMenu(false)}>
                                            <Share size={16} /> Share Profile
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Profile Info Section */}
                    <div className="pb-8 relative" style={{ paddingLeft: '24px', paddingRight: '24px' }}>
                        {/* Avatar (Overlapping banner) */}
                        <div className="relative" style={{ marginTop: '-80px', zIndex: 10 }}>
                            <img src={profile.image} alt={profile.name} className="shadow-md bg-white flex-shrink-0" style={{ width: '168px', height: '168px', borderRadius: '50%', objectFit: 'cover', border: '5px solid white' }} />
                        </div>

                        {/* Name & Title */}
                        <div style={{ marginTop: '16px' }}>
                            <h1 className="h1-title mb-1" style={{ fontSize: '2rem' }}>{profile.name}</h1>
                            <p className="role-text mb-3 text-xl text-gray-600">{profile.role} at <span className="text-primary font-semibold">{profile.company}</span></p>

                            <div className="flex items-center flex-wrap gap-4 text-gray-500 text-sm mb-6">
                                <span className="flex items-center gap-2"><MapPin size={16} /> {profile.location}</span>
                                <div className="flex flex-wrap gap-2">
                                    {profile.tags.map((tag, index) => (
                                        <span key={index} style={{ padding: '2px 12px', backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-700)', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 500 }}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* About/Bio */}
                        <div className="pt-8 pb-6 border-t border-gray-100">
                            <h3 className="h3-title mb-2">About</h3>
                            <p className="text-gray-600 leading-relaxed max-w-4xl" style={{ fontSize: '1.125rem' }}>
                                {profile.bio}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="profile-grid">

                    {/* Left Column - Main Content */}
                    <div className="profile-main space-y-6">

                        {/* Experience / Resume Card */}
                        {profile.experience && profile.experience.length > 0 && (
                            <div className="profile-card">
                                <h3 className="h3-title mb-6 flex items-center gap-4">
                                    <Briefcase size={20} style={{ color: 'var(--color-gray-400)' }} />
                                    Experience
                                </h3>
                                <div className="space-y-6" style={{ marginLeft: '10px' }}>
                                    {profile.experience.map((exp, idx) => (
                                        <div key={idx} className="experience-item relative pl-6 border-l-2 border-gray-100 pb-2">
                                            <div className="experience-dot"></div>
                                            <h4 className="font-semibold" style={{ fontSize: '1.125rem', color: 'var(--color-gray-900)' }}>{exp.title}</h4>
                                            <p className="text-primary font-medium mb-1">{exp.company}</p>
                                            <p className="text-sm text-gray-400 mb-2">{exp.date}</p>
                                            <p className="text-gray-600 text-sm leading-relaxed">{exp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nostr Notes Feed Card */}
                        <div className="profile-card">
                            <NostrFeed npub={profile.nostrNpub} notes={profile.notes} />
                        </div>

                    </div>

                    {/* Right Column - Side Panels */}
                    <div className="profile-sidebar space-y-6">

                        {/* Projects Panel */}
                        <div className="profile-card bg-gray-50 border border-gray-200">
                            <h3 className="h3-title mb-4">{projectsTitle}</h3>

                            {profile.biesProjects && profile.biesProjects.length > 0 ? (
                                <div>
                                    {profile.biesProjects.map((proj, idx) => (
                                        <Link
                                            to={`/project/${proj.id}`}
                                            key={idx}
                                            className="project-link flex items-stretch justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl transition-all hover:border-primary"
                                            style={{ marginBottom: idx !== profile.biesProjects.length - 1 ? '24px' : '0' }}
                                        >
                                            {/* Content (Left) */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-900 text-lg truncate">{proj.name}</h4>
                                                </div>
                                                <div className="flex items-center gap-3 text-sm mt-2">
                                                    <span className="text-primary font-medium truncate">{proj.role}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span className="status-badge flex-shrink-0">{proj.status}</span>
                                                </div>
                                            </div>

                                            {/* Thumbnail (Right) - YouTube Style 16:9 (Larger) */}
                                            <div className="bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200" style={{ width: '120px', height: '68px', minWidth: '120px', minHeight: '68px' }}>
                                                {proj.image ? (
                                                    <img src={proj.image} alt={proj.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span className="text-gray-400 font-bold text-xl">{proj.name.charAt(0)}</span>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">No active network projects listed.</p>
                            )}
                        </div>

                        {/* Links/Socials Panel */}
                        <div className="profile-card">
                            <h3 className="h3-title mb-4">Links</h3>
                            <div className="flex flex-col gap-3">
                                <a href="#" className="social-link">
                                    <Globe size={18} /> Personal Website
                                </a>
                                <a href="#" className="social-link">
                                    <Twitter size={18} /> Twitter Profile
                                </a>
                                <a href="#" className="social-link">
                                    <Linkedin size={18} /> LinkedIn Profile
                                </a>
                            </div>
                        </div>

                        {/* Nostr Identity Card */}
                        {(profile.nostrNpub || nostrProfile) && (
                            <div className="profile-card">
                                <h3 className="h3-title mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <NostrIcon size={20} style={{ color: '#8b5cf6' }} />
                                    Nostr Identity
                                </h3>
                                {nostrProfile ? (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            {nostrProfile.picture && (
                                                <img src={nostrProfile.picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                            )}
                                            <span className="font-medium text-gray-900">{nostrProfile.name || 'Unnamed'}</span>
                                        </div>
                                        {nostrProfile.about && (
                                            <p className="text-sm text-gray-600 leading-relaxed" style={{ marginBottom: '0.75rem' }}>
                                                {nostrProfile.about.length > 140
                                                    ? nostrProfile.about.substring(0, 140) + '...'
                                                    : nostrProfile.about}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400">Loading Nostr profile...</p>
                                )}
                                {profile.nostrNpub && (
                                    <p className="text-xs text-gray-400" style={{ fontFamily: 'monospace', marginTop: '0.5rem' }}>
                                        {profile.nostrNpub.substring(0, 24)}...
                                    </p>
                                )}
                            </div>
                        )}

                    </div>

                </div>
            </div>

            <style jsx>{`
                .profile-page {
                    min-height: 100vh;
                    background: var(--color-gray-50);
                    padding-bottom: 4rem;
                }

                .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
                .mb-8 { margin-bottom: 2rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .pb-6 { padding-bottom: 1.5rem; }
                .p-3 { padding: 0.75rem; }

                /* CSS Grid Layout for Profile */
                .profile-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 2rem;
                }

                @media (min-width: 768px) {
                    .profile-grid {
                        grid-template-columns: 2fr 1fr;
                    }
                }

                .profile-card {
                    background: white;
                    padding: 2rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                }

                .bg-gray-50 { background-color: var(--color-gray-50); }



                /* Text Utilities */
                .h1-title { font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; font-family: var(--font-display); margin-bottom: 0.25rem; }
                .h3-title { font-size: 1.25rem; font-weight: 700; font-family: var(--font-display); }
                .role-text { font-size: 1.25rem; color: var(--color-gray-700); }
                .text-gray-400 { color: var(--color-gray-400); }
                .text-gray-500 { color: var(--color-gray-500); }
                .text-gray-600 { color: var(--color-gray-600); }
                .text-gray-700 { color: var(--color-gray-700); }
                .text-gray-900 { color: var(--color-gray-900); }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .font-semibold { font-weight: 600; font-family: var(--font-display); }
                .font-medium { font-weight: 500; }
                .font-bold { font-weight: 700; font-family: var(--font-display); }
                .leading-relaxed { line-height: 1.625; }



                /* Space Utilities */
                .space-y-6 > * + * { margin-top: 1.5rem; }
                .space-y-3 > * + * { margin-top: 0.75rem; }
                .flex-wrap { flex-wrap: wrap; }
                .gap-4 { gap: 1rem; }

                /* Back Link Styles */
                .back-link {
                    display: inline-flex;
                    padding: 0.5rem 1rem;
                    border-radius: 9999px;
                    border: 1px solid var(--color-gray-200);
                    box-shadow: var(--shadow-sm);
                    background: white;
                    color: var(--color-gray-500);
                    text-decoration: none;
                }
                .back-link:hover { color: var(--color-primary); }

                /* Experience Resume Timeline */
                .experience-item {
                    padding-left: 1.5rem;
                    border-left: 2px solid var(--color-gray-200);
                    position: relative;
                    padding-bottom: 0.5rem;
                }
                .experience-dot {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    background: var(--color-primary);
                    border-radius: 50%;
                    left: -7px;
                    top: 6px;
                }

                /* Right Column widgets */
                .project-link { text-decoration: none; color: inherit; display: block; }
                .project-link:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
                
                .status-badge {
                    background: #dcfce7;
                    color: #15803d;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                }

                .social-link {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: var(--color-gray-600);
                    text-decoration: none;
                    padding: 0.5rem;
                    border-radius: 0.375rem;
                    transition: background 0.2s, color 0.2s;
                }
                .social-link:hover {
                    color: var(--color-primary);
                    background: var(--color-gray-100);
                }

                .border-b { border-bottom: 1px solid var(--color-gray-200); }

                @media (max-width: 768px) {
                    .flex.justify-between { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .avatar-wrapper { margin-top: -20px; }
                }
            `}</style>
        </div>
    );
};

export default PublicProfile;
