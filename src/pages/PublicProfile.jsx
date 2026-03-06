import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Briefcase, Globe, Twitter, Linkedin, MoreHorizontal, Share, Loader2, ArrowLeft } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { profilesApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { nostrService } from '../services/nostrService';
import NostrFeed from '../components/NostrFeed';
import NostrIcon from '../components/NostrIcon';
import ZapButton from '../components/ZapButton';

const PublicProfile = ({ type }) => {
    const { id } = useParams();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [nostrProfile, setNostrProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const data = await profilesApi.get(id);
                setProfile(data);
            } catch {
                setError('Profile not found');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id]);

    // The URL :id can be a profileId or userId — the follow API needs the userId
    const targetUserId = profile?.user?.id || profile?.userId;

    // Check if current user is following this profile
    useEffect(() => {
        if (!currentUser?.id || !targetUserId || currentUser.id === targetUserId) return;
        profilesApi.getFollowing(currentUser.id, { limit: 100 })
            .then(res => {
                const list = res?.data || res || [];
                setIsFollowing(list.some(u => u.id === targetUserId));
            })
            .catch(() => { });
    }, [currentUser?.id, targetUserId]);

    useEffect(() => {
        if (!profile) return;
        const npub = profile.user?.nostrPubkey
            ? nip19.npubEncode(profile.user.nostrPubkey)
            : profile.nostrNpub;
        if (npub) {
            try {
                const decoded = nip19.decode(npub);
                if (decoded.type === 'npub') {
                    nostrService.getProfile(decoded.data).then(setNostrProfile).catch(() => { });
                }
            } catch {
                // Invalid npub — skip
            }
        }
    }, [profile]);

    if (loading) {
        return (
            <div className="profile-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    if (error || !profile) {
        return <div className="p-10 text-center text-gray-500">{error || 'Profile not found'}</div>;
    }

    const role = profile.user?.role || (type === 'investor' ? 'INVESTOR' : 'BUILDER');
    const projectsTitle = role === 'INVESTOR' ? 'Invested In' : 'Working On';
    const npub = profile.user?.nostrPubkey
        ? nip19.npubEncode(profile.user.nostrPubkey)
        : profile.nostrNpub;

    return (
        <div className="profile-page">
            <div className="container py-8">
                {/* Header Card */}
                <div className="profile-card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Cover Banner */}
                    <div style={{
                        position: 'relative',
                        height: '240px',
                        background: (profile.banner || nostrProfile?.banner)
                            ? `url(${profile.banner || nostrProfile?.banner}) center/cover no-repeat`
                            : 'linear-gradient(to right, #0052cc, #0a192f)'
                    }}>
                        <Link to={type === 'builder' ? '/builders' : '/investors'} style={{
                            position: 'absolute', top: '24px', left: '24px',
                            borderRadius: '50%', background: 'white', border: '1px solid var(--color-gray-200)',
                            width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            textDecoration: 'none', color: 'var(--color-gray-700)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        }}>
                            <ArrowLeft size={20} />
                        </Link>

                        {/* Action Buttons */}
                        <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 20, display: 'flex', gap: '1rem' }}>
                            {currentUser && targetUserId && currentUser.id !== targetUserId && (
                                <button
                                    onClick={async () => {
                                        setFollowLoading(true);
                                        try {
                                            if (isFollowing) {
                                                await profilesApi.unfollow(targetUserId);
                                                setIsFollowing(false);
                                            } else {
                                                await profilesApi.follow(targetUserId);
                                                setIsFollowing(true);
                                            }
                                        } catch (err) {
                                            // 409 = already following
                                            if (err?.status === 409) setIsFollowing(true);
                                            else alert(err?.message || 'Failed to update follow');
                                        } finally {
                                            setFollowLoading(false);
                                        }
                                    }}
                                    disabled={followLoading}
                                    style={{
                                        borderRadius: 'var(--radius-md)',
                                        background: isFollowing ? 'var(--color-primary)' : 'white',
                                        color: isFollowing ? 'white' : 'var(--color-neutral-dark)',
                                        border: isFollowing ? 'none' : '1px solid var(--color-gray-200)',
                                        height: '42px', padding: '0 24px', whiteSpace: 'nowrap', fontWeight: 600,
                                        cursor: followLoading ? 'wait' : 'pointer',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        opacity: followLoading ? 0.7 : 1,
                                    }}>
                                    {followLoading ? 'Loading...' : isFollowing ? 'Following ✓' : 'Follow'}
                                </button>
                            )}
                            <Link to="/messages" style={{
                                borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', color: 'white',
                                height: '42px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                textDecoration: 'none', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}>
                                Connect
                            </Link>
                            {profile.user?.nostrPubkey && (
                                <ZapButton
                                    recipients={[{ pubkey: profile.user.nostrPubkey, name: profile.name, avatar: profile.avatar }]}
                                    size="md"
                                    variant="bitcoin"
                                />
                            )}

                            <div style={{ position: 'relative' }}>
                                <button onClick={() => setShowMenu(!showMenu)} style={{
                                    borderRadius: 'var(--radius-md)', background: 'white', color: 'var(--color-neutral-dark)',
                                    border: '1px solid var(--color-gray-200)', height: '42px', width: '48px', padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                }}>
                                    <MoreHorizontal size={20} />
                                </button>
                                {showMenu && (
                                    <div style={{
                                        position: 'absolute', right: 0, marginTop: '0.5rem', width: '12rem',
                                        background: 'white', borderRadius: 'var(--radius-xl)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                        border: '1px solid var(--color-gray-100)', padding: '0.25rem 0', zIndex: 50,
                                    }}>
                                        <button onClick={() => setShowMenu(false)} style={{
                                            width: '100%', textAlign: 'left', padding: '0.625rem 1rem',
                                            display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem',
                                            fontWeight: 500, color: 'var(--color-gray-700)', background: 'none', border: 'none', cursor: 'pointer',
                                        }}>
                                            <Share size={16} /> Share Profile
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Profile Info Section */}
                    <div className="pb-8" style={{ paddingLeft: '24px', paddingRight: '24px', position: 'relative', zIndex: 5 }}>
                        {/* Avatar */}
                        <div style={{ marginTop: '-80px', position: 'relative', zIndex: 5 }}>
                            {(profile.avatar || nostrProfile?.picture) ? (
                                <img src={profile.avatar || nostrProfile?.picture} alt={profile.name} style={{
                                    width: '168px', height: '168px', borderRadius: '50%', objectFit: 'cover',
                                    border: '5px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', background: 'white',
                                }} />
                            ) : (
                                <div style={{
                                    width: '168px', height: '168px', borderRadius: '50%', border: '5px solid white',
                                    background: 'var(--color-gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '3rem', fontWeight: 700, color: 'var(--color-gray-400)',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                }}>
                                    {(profile.name || '?').charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>

                        {/* Name & Title */}
                        <div style={{ marginTop: '16px' }}>
                            <h1 style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                                {profile.name}
                            </h1>
                            {(profile.title || profile.company) && (
                                <p style={{ fontSize: '1.25rem', color: 'var(--color-gray-700)', marginBottom: '0.75rem' }}>
                                    {profile.title}{profile.title && profile.company ? ' at ' : ''}
                                    {profile.company && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{profile.company}</span>}
                                </p>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'var(--color-gray-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                                {profile.location && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <MapPin size={16} /> {profile.location}
                                    </span>
                                )}
                                {(profile.tags || []).length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        {profile.tags.map((tag, index) => (
                                            <span key={index} style={{
                                                padding: '2px 12px', backgroundColor: 'var(--color-gray-100)',
                                                color: 'var(--color-gray-700)', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 500,
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* About/Bio */}
                        {profile.bio && (
                            <div style={{ paddingTop: '2rem', paddingBottom: '1.5rem', borderTop: '1px solid var(--color-gray-100)' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>About</h3>
                                <p style={{ color: 'var(--color-gray-600)', lineHeight: 1.625, fontSize: '1.125rem', maxWidth: '64rem' }}>
                                    {profile.bio}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="profile-grid">
                    {/* Left Column - Main Content */}
                    <div className="profile-main">

                        {/* Experience */}
                        {profile.showExperience !== false && (profile.experience || []).length > 0 && (
                            <div className="profile-card" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <Briefcase size={20} style={{ color: 'var(--color-gray-400)' }} />
                                    Experience
                                </h3>
                                <div style={{ marginLeft: '10px' }}>
                                    {profile.experience.map((exp, idx) => (
                                        <div key={idx} className="experience-item" style={{ paddingLeft: '1.5rem', borderLeft: '2px solid var(--color-gray-200)', position: 'relative', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                                            <div className="experience-dot"></div>
                                            <h4 style={{ fontWeight: 600, fontSize: '1.125rem', color: 'var(--color-gray-900)', fontFamily: 'var(--font-display)' }}>{exp.title}</h4>
                                            {exp.company && <p style={{ color: 'var(--color-primary)', fontWeight: 500, marginBottom: '0.25rem' }}>{exp.company}</p>}
                                            {exp.date && <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-400)', marginBottom: '0.5rem' }}>{exp.date}</p>}
                                            {exp.description && <p style={{ color: 'var(--color-gray-600)', fontSize: '0.875rem', lineHeight: 1.625 }}>{exp.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Nostr Feed */}
                        {profile.showNostrFeed !== false && npub && (
                            <div className="profile-card">
                                <NostrFeed npub={npub} notes={[]} />
                            </div>
                        )}
                    </div>

                    {/* Right Column - Side Panels */}
                    <div className="profile-sidebar">

                        {/* Projects Panel */}
                        <div className="profile-card" style={{ marginBottom: '1.5rem', background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>{projectsTitle}</h3>

                            {(profile.biesProjects || []).length > 0 ? (
                                <div>
                                    {profile.biesProjects.map((proj, idx) => (
                                        <Link
                                            to={`/project/${proj.id}`}
                                            key={idx}
                                            className="project-link"
                                            style={{ marginBottom: idx !== profile.biesProjects.length - 1 ? '1.5rem' : '0' }}
                                        >
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '0.25rem', paddingBottom: '0.25rem' }}>
                                                <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', fontSize: '1.125rem', fontFamily: 'var(--font-display)' }}>{proj.name}</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                                    {proj.role && <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{proj.role}</span>}
                                                    {proj.role && proj.status && <span style={{ color: 'var(--color-gray-300)' }}>•</span>}
                                                    {proj.status && <span className="status-badge">{proj.status}</span>}
                                                </div>
                                            </div>
                                            <div style={{
                                                width: '120px', height: '68px', minWidth: '120px', minHeight: '68px',
                                                background: 'var(--color-gray-100)', borderRadius: '0.5rem', flexShrink: 0,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                                border: '1px solid var(--color-gray-200)',
                                            }}>
                                                {proj.image ? (
                                                    <img src={proj.image} alt={proj.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ color: 'var(--color-gray-400)', fontWeight: 700, fontSize: '1.25rem' }}>{proj.name.charAt(0)}</span>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                // Show user's actual projects from the API if available
                                (profile.user?.projects || []).length > 0 ? (
                                    <div>
                                        {profile.user.projects.map((proj, idx) => (
                                            <Link
                                                to={`/project/${proj.id}`}
                                                key={idx}
                                                className="project-link"
                                                style={{ marginBottom: idx !== profile.user.projects.length - 1 ? '1.5rem' : '0' }}
                                            >
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <h4 style={{ fontWeight: 600, color: 'var(--color-gray-900)', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>{proj.title}</h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                                                        {proj.category && <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>{proj.category}</span>}
                                                        {proj.stage && <span className="status-badge">{proj.stage}</span>}
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)' }}>No projects listed.</p>
                                )
                            )}
                        </div>

                        {/* Links/Socials Panel */}
                        {(profile.website || profile.twitter || profile.linkedin) && (
                            <div className="profile-card" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Links</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {profile.website && (
                                        <a href={profile.website} target="_blank" rel="noopener noreferrer" className="social-link">
                                            <Globe size={18} /> {profile.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    )}
                                    {profile.twitter && (
                                        <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                            <Twitter size={18} /> {profile.twitter}
                                        </a>
                                    )}
                                    {profile.linkedin && (
                                        <a href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noopener noreferrer" className="social-link">
                                            <Linkedin size={18} /> LinkedIn
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Nostr Identity Card */}
                        {(npub || nostrProfile) && (
                            <div className="profile-card">
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <NostrIcon size={20} className="text-purple-500" />
                                    Nostr Identity
                                </h3>
                                {nostrProfile ? (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                            {nostrProfile.picture && (
                                                <img src={nostrProfile.picture} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                            )}
                                            <span style={{ fontWeight: 500, color: 'var(--color-gray-900)' }}>{nostrProfile.name || 'Unnamed'}</span>
                                        </div>
                                        {nostrProfile.about && (
                                            <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', lineHeight: 1.625, marginBottom: '0.75rem' }}>
                                                {nostrProfile.about.length > 140 ? nostrProfile.about.substring(0, 140) + '...' : nostrProfile.about}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-400)' }}>Loading Nostr profile...</p>
                                )}
                                {npub && (
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)', fontFamily: 'monospace', marginTop: '0.5rem' }}>
                                        {npub.substring(0, 24)}...
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
                .pb-8 { padding-bottom: 2rem; }

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

                .experience-dot {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    background: var(--color-primary);
                    border-radius: 50%;
                    left: -7px;
                    top: 6px;
                }

                .project-link {
                    text-decoration: none;
                    color: inherit;
                    display: flex;
                    align-items: stretch;
                    justify-content: space-between;
                    gap: 1rem;
                    padding: 1rem;
                    background: white;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-xl);
                    transition: border-color 0.2s, box-shadow 0.2s;
                }
                .project-link:hover {
                    border-color: var(--color-primary);
                    box-shadow: var(--shadow-sm);
                }

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

                @keyframes spin { to { transform: rotate(360deg); } }

                @media (max-width: 768px) {
                    .profile-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default PublicProfile;
