import { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Linkedin, Briefcase, Plus, Hash, Camera, Loader2, CheckCircle, Save, Search, X, RefreshCw, Send, AtSign, Zap, HelpCircle, ChevronDown, ChevronUp, User, Link as LinkIcon } from 'lucide-react';
import NostrIcon from '../components/NostrIcon';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi, projectsApi } from '../services/api';
import { nostrService } from '../services/nostrService';
import { Link, useNavigate } from 'react-router-dom';
import NostrFeed from '../components/NostrFeed';
import ImageCropModal from '../components/ImageCropModal';

// Defined outside component to prevent re-mount on every render (which causes input focus loss)
const SectionHeader = ({ icon, title, children }) => (
    <div className="pe-section-header">
        <div className="pe-section-title">
            {icon}
            <h3>{title}</h3>
        </div>
        {children}
    </div>
);

const CollapsibleSub = ({ title, icon, open, onToggle, children }) => (
    <div className="pe-collapsible">
        <button type="button" className="pe-collapsible-trigger" onClick={onToggle}>
            <div className="pe-collapsible-label">
                {icon}
                <span>{title}</span>
            </div>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {open && <div className="pe-collapsible-body">{children}</div>}
    </div>
);

const ProfileEdit = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const searchRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [avatarImageLoading, setAvatarImageLoading] = useState(false);
    const [bannerImageLoading, setBannerImageLoading] = useState(false);
    const [cropImage, setCropImage] = useState(null); // { src, type: 'avatar'|'banner' }
    const [error, setError] = useState('');
    const [hasExistingProfile, setHasExistingProfile] = useState(false);

    // BIES profile form
    const [form, setForm] = useState({
        name: '',
        bio: '',
        location: '',
        website: '',
        twitter: '',
        linkedin: '',
        company: '',
        title: '',
        avatar: '',
        banner: '',
        tags: [],
        showExperience: true,
        showNostrFeed: true,
        nostrFeedSource: 'private',
        experience: [],
        biesProjects: [],
        nostrNpub: '',
        nip05Name: '',
        lightningAddress: '',
    });

    // NIP-05 availability check
    const [nip05Available, setNip05Available] = useState(null);
    const [nip05Checking, setNip05Checking] = useState(false);

    // Nostr profile form
    const [nostrProfile, setNostrProfile] = useState(null);
    const [loadingNostr, setLoadingNostr] = useState(false);
    const [savingNostr, setSavingNostr] = useState(false);
    const [nostrSaved, setNostrSaved] = useState(false);
    const [nostrForm, setNostrForm] = useState({
        display_name: '', name: '', about: '', picture: '', website: '', nip05: '', lud16: '', banner: ''
    });
    const [publishMode, setPublishMode] = useState('bies'); // 'bies' or 'all'
    const [showPublishHelp, setShowPublishHelp] = useState(false);
    const [showFeedHelp, setShowFeedHelp] = useState(false);

    // Collapsible section state
    const [nostrIdentityOpen, setNostrIdentityOpen] = useState(true);
    const [nostrProfileOpen, setNostrProfileOpen] = useState(false);
    const [nostrPublishOpen, setNostrPublishOpen] = useState(false);

    // Project search
    const [projectSearch, setProjectSearch] = useState('');
    const [projectResults, setProjectResults] = useState([]);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [newProjectRole, setNewProjectRole] = useState('');
    const [autoProjects, setAutoProjects] = useState([]); // projects the builder owns or is team member of

    // ─── Data Loading ───

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (user?.nostrPubkey) {
            fetchNostrProfile();
        }
    }, [user?.nostrPubkey]);

    // Auto-apply Nostr profile fields to BIES form when BIES profile is missing them
    useEffect(() => {
        if (!nostrProfile) return;
        setForm(prev => {
            const updates = {};
            if (!prev.banner && nostrProfile.banner) updates.banner = nostrProfile.banner;
            if (!prev.avatar && nostrProfile.picture) updates.avatar = nostrProfile.picture;
            if (!prev.name && (nostrProfile.display_name || nostrProfile.name)) {
                updates.name = nostrProfile.display_name || nostrProfile.name;
            }
            if (!prev.bio && nostrProfile.about) updates.bio = nostrProfile.about;
            if (!prev.website && nostrProfile.website) updates.website = nostrProfile.website;
            if (Object.keys(updates).length === 0) return prev;
            return { ...prev, ...updates };
        });
    }, [nostrProfile]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!projectSearch.trim()) {
            setProjectResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            try {
                const res = await projectsApi.list({ search: projectSearch, limit: 5 });
                const rawList = res?.data || res || [];
                setProjectResults(rawList.map(p => ({ ...p, name: p.title || p.name, image: p.thumbnail || p.coverImage || p.image })));
                setShowProjectDropdown(true);
            } catch (err) {
                console.error('Failed to search projects', err);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [projectSearch]);

    // Debounced NIP-05 availability check
    useEffect(() => {
        const name = form.nip05Name.trim().toLowerCase();
        if (!name || name.length < 3) {
            setNip05Available(null);
            return;
        }
        setNip05Checking(true);
        const timer = setTimeout(async () => {
            try {
                const res = await profilesApi.checkNip05(name);
                setNip05Available(res.available);
            } catch {
                setNip05Available(null);
            } finally {
                setNip05Checking(false);
            }
        }, 500);
        return () => { clearTimeout(timer); setNip05Checking(false); };
    }, [form.nip05Name]);

    // Auto-fetch projects the user owns or is a team member of
    useEffect(() => {
        if (!user?.id) return;
        const fetchMyProjects = async () => {
            try {
                const res = await projectsApi.list({ ownerId: user.id, limit: 50 });
                const list = (res?.data || res || []).map(p => ({
                    id: p.id,
                    name: p.title || p.name,
                    role: 'Founder',
                    status: p.stage || 'Active',
                    image: p.thumbnail || p.coverImage || '',
                }));
                setAutoProjects(list);
            } catch {
                // ignore
            }
        };
        fetchMyProjects();
    }, [user?.id]);

    const loadProfile = async () => {
        try {
            const profile = await profilesApi.me();
            if (profile) {
                setHasExistingProfile(true);
                setForm(prev => ({
                    ...prev,
                    name: profile.name || '',
                    bio: profile.bio || '',
                    location: profile.location || '',
                    website: profile.website || '',
                    twitter: profile.twitter || '',
                    linkedin: profile.linkedin || '',
                    company: profile.company || '',
                    title: profile.title || profile.role || '',
                    avatar: profile.avatar || profile.image || '',
                    banner: profile.banner || '',
                    tags: profile.tags || [],
                    showExperience: profile.showExperience ?? true,
                    showNostrFeed: profile.showNostrFeed ?? true,
                    nostrFeedSource: profile.nostrFeedSource || 'private',
                    experience: (profile.experience || []).map(exp => {
                        // Parse fromYear/toYear from existing date string like "2020 - Present"
                        let fromYear = exp.fromYear || '';
                        let toYear = exp.toYear || '';
                        if (!fromYear && exp.date) {
                            const parts = exp.date.split(/\s*[-–]\s*/);
                            if (parts[0] && /^\d{4}$/.test(parts[0].trim())) fromYear = parts[0].trim();
                            if (parts[1] && /^\d{4}$/.test(parts[1].trim())) toYear = parts[1].trim();
                        }
                        return { ...exp, fromYear, toYear };
                    }),
                    biesProjects: profile.biesProjects || [],
                    nostrNpub: profile.nostrNpub || (user?.nostrPubkey ? nip19.npubEncode(user.nostrPubkey) : ''),
                    nip05Name: profile.nip05Name || '',
                    lightningAddress: profile.lightningAddress || '',
                }));
            }
        } catch {
            // New user — form stays with defaults
        } finally {
            setLoading(false);
        }
    };

    const fetchNostrProfile = async () => {
        setLoadingNostr(true);
        try {
            const profile = await nostrService.getProfile(user.nostrPubkey);
            setNostrProfile(profile);
            if (profile) {
                setNostrForm({
                    display_name: profile.display_name || '',
                    name: profile.name || '',
                    about: profile.about || '',
                    picture: profile.picture || '',
                    website: profile.website || '',
                    nip05: profile.nip05 || '',
                    lud16: profile.lud16 || '',
                    banner: profile.banner || '',
                });
            }
        } catch (err) {
            console.error('Failed to fetch Nostr profile:', err);
        } finally {
            setLoadingNostr(false);
        }
    };

    // ─── Handlers ───

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setError('');
        try {
            // Only send fields the backend accepts
            const payload = {
                name: form.name || undefined,
                bio: form.bio,
                location: form.location,
                website: form.website || undefined,
                twitter: form.twitter,
                linkedin: form.linkedin,
                company: form.company,
                title: form.title,
                avatar: form.avatar || undefined,
                banner: form.banner || undefined,
                tags: form.tags,
                experience: form.experience,
                biesProjects: form.biesProjects,
                showExperience: form.showExperience,
                showNostrFeed: form.showNostrFeed,
                nostrFeedSource: form.nostrFeedSource,
                nostrNpub: form.nostrNpub,
                nip05Name: form.nip05Name || undefined,
                lightningAddress: form.lightningAddress,
            };
            // Remove undefined values so Zod doesn't see them
            Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
            await profilesApi.update(payload);
            await refreshUser();
            navigate('/profile');
        } catch (err) {
            console.error('Save profile error:', err);
            setError(err.data?.details?.map(d => `${d.field}: ${d.message}`).join(', ') || err.message || 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    // Avatar & Banner uploads — open crop modal first
    const handleAvatarSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        setCropImage({ src, type: 'avatar' });
        e.target.value = ''; // reset so same file can be re-selected
    };

    const handleBannerSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const src = URL.createObjectURL(file);
        setCropImage({ src, type: 'banner' });
        e.target.value = '';
    };

    const handleCropConfirm = async (croppedFile) => {
        const type = cropImage.type;
        URL.revokeObjectURL(cropImage.src);
        setCropImage(null);

        if (type === 'avatar') {
            setUploadingAvatar(true);
        } else {
            setUploadingBanner(true);
        }
        setError('');

        try {
            const result = await uploadApi.media(croppedFile);
            // Preload the image before showing it, so it doesn't flash white
            if (type === 'avatar') {
                setAvatarImageLoading(true);
                setUploadingAvatar(false);
            } else {
                setBannerImageLoading(true);
                setUploadingBanner(false);
            }
            const img = new Image();
            img.onload = () => {
                setForm(prev => ({ ...prev, [type]: result.url }));
                if (type === 'avatar') setAvatarImageLoading(false);
                else setBannerImageLoading(false);
            };
            img.onerror = () => {
                // Still set the URL even if preload fails
                setForm(prev => ({ ...prev, [type]: result.url }));
                if (type === 'avatar') setAvatarImageLoading(false);
                else setBannerImageLoading(false);
            };
            img.src = result.url;
        } catch (err) {
            console.error(`${type} upload error:`, err);
            setError(`Failed to upload ${type}. Make sure the backend server is running.`);
            if (type === 'avatar') setUploadingAvatar(false);
            else setUploadingBanner(false);
        }
    };

    const handleCropCancel = () => {
        if (cropImage) URL.revokeObjectURL(cropImage.src);
        setCropImage(null);
    };

    // Tags
    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            e.preventDefault();
            const newTag = e.target.value.trim();
            if (!form.tags.includes(newTag)) {
                setForm(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
            }
            e.target.value = '';
        }
    };

    const removeTag = (tag) => {
        setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    // Year options for experience date dropdowns
    const currentYear = new Date().getFullYear();
    const yearOptions = [];
    for (let y = currentYear; y >= 1970; y--) yearOptions.push(y);

    // Experience
    const handleAddExperience = () => {
        setForm(prev => ({
            ...prev,
            experience: [...prev.experience, { title: '', company: '', fromYear: '', toYear: '', date: '', description: '' }]
        }));
    };

    const handleExperienceChange = (index, field) => (e) => {
        const updated = [...form.experience];
        updated[index] = { ...updated[index], [field]: e.target.value };
        setForm(prev => ({ ...prev, experience: updated }));
    };

    const handleRemoveExperience = (index) => {
        setForm(prev => ({ ...prev, experience: prev.experience.filter((_, i) => i !== index) }));
    };

    // Projects
    const handleAddProject = (project) => {
        if (!form.biesProjects.find(p => p.id === project.id)) {
            setForm(prev => ({
                ...prev,
                biesProjects: [...prev.biesProjects, {
                    id: project.id,
                    name: project.name,
                    role: newProjectRole || 'Contributor',
                    status: project.status || 'Active',
                    image: project.image || project.coverImage
                }]
            }));
        }
        setProjectSearch('');
        setNewProjectRole('');
        setShowProjectDropdown(false);
    };

    const handleRemoveProject = (projectId) => {
        setForm(prev => ({ ...prev, biesProjects: prev.biesProjects.filter(p => p.id !== projectId) }));
    };

    // Nostr
    const handleNostrFormChange = (field) => (e) => {
        setNostrForm(prev => ({ ...prev, [field]: e.target.value }));
        setNostrSaved(false);
    };

    const handleSaveToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
            Object.entries(nostrForm).forEach(([k, v]) => { if (v) data[k] = v; });
            if (publishMode === 'bies') {
                await nostrService.updateProfileToBiesRelay(data);
            } else {
                await nostrService.updateProfile(data);
            }
            setNostrSaved(true);
            setTimeout(() => setNostrSaved(false), 3000);
            await fetchNostrProfile();
        } catch (err) {
            setError(err.message || 'Failed to publish to Nostr.');
        } finally {
            setSavingNostr(false);
        }
    };

    const handleSyncFromNostr = () => {
        if (!nostrProfile) return;
        setForm(prev => ({
            ...prev,
            name: nostrProfile.display_name || nostrProfile.name || prev.name,
            bio: nostrProfile.about || prev.bio,
            avatar: nostrProfile.picture || prev.avatar,
            banner: nostrProfile.banner || prev.banner,
            website: nostrProfile.website || prev.website,
        }));
    };

    const handlePushBiesToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
            if (form.name) data.display_name = form.name;
            if (form.name) data.name = form.name;
            if (form.bio) data.about = form.bio;
            if (form.avatar) data.picture = form.avatar;
            if (form.website) data.website = form.website;
            if (form.banner) data.banner = form.banner;
            await nostrService.updateProfile(data);
            setNostrSaved(true);
            setTimeout(() => setNostrSaved(false), 3000);
            await fetchNostrProfile();
        } catch (err) {
            setError(err.message || 'Failed to push BIES profile to Nostr.');
        } finally {
            setSavingNostr(false);
        }
    };

    // ─── Render ───

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    const projectsTitle = user?.role === 'INVESTOR' ? 'Invested In' : 'Working On';

    return (
        <div className="pe-page">
            <div className="pe-container">

                {/* Top bar */}
                <div className="pe-topbar">
                    <h1 className="pe-page-title">Edit Profile</h1>
                    <button onClick={handleSave} type="button" disabled={saving} className="pe-save-btn">
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {error && (
                    <div className="pe-error">{error}</div>
                )}

                {/* Banner + Avatar card */}
                <div className="pe-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="pe-banner" style={{
                        background: (form.banner || nostrProfile?.banner)
                            ? `url(${form.banner || nostrProfile?.banner}) center/cover no-repeat`
                            : 'linear-gradient(135deg, #0052cc, #0a192f)'
                    }}>
                        {(uploadingBanner || bannerImageLoading) && (
                            <div className="pe-banner-overlay">
                                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'white' }} />
                                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.8rem' }}>
                                    {uploadingBanner ? 'Uploading...' : 'Loading...'}
                                </span>
                            </div>
                        )}
                        <label className="pe-banner-edit">
                            {uploadingBanner ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={14} />}
                            <span className="pe-banner-edit-text">Edit</span>
                            <input type="file" accept="image/*" onChange={handleBannerSelect} style={{ display: 'none' }} />
                        </label>
                    </div>

                    <div className="pe-avatar-row">
                        <div className="pe-avatar-wrapper">
                            <div className="pe-avatar">
                                {(form.avatar || nostrProfile?.picture) ? (
                                    <img src={form.avatar || nostrProfile?.picture} alt={form.name} />
                                ) : (
                                    <div className="pe-avatar-placeholder">
                                        {(form.name || user?.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {(uploadingAvatar || avatarImageLoading) && (
                                <div className="pe-avatar-loading">
                                    <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
                                </div>
                            )}
                            <label className="pe-avatar-edit">
                                <Camera size={14} style={{ color: '#374151' }} />
                                <input type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Basic Info */}
                <div className="pe-card">
                    <SectionHeader icon={<User size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Basic Info" />
                    <div className="pe-field-grid">
                        <div className="pe-field">
                            <label className="pe-label">Name</label>
                            <input type="text" value={form.name} onChange={handleChange('name')} className="pe-input" placeholder="Your Name" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Current Role</label>
                            <input type="text" value={form.title} onChange={handleChange('title')} className="pe-input" placeholder="Role/Title" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Company</label>
                            <input type="text" value={form.company} onChange={handleChange('company')} className="pe-input" placeholder="Company" />
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">Location</label>
                            <div className="pe-input-icon">
                                <MapPin size={16} className="pe-icon" />
                                <input type="text" value={form.location} onChange={handleChange('location')} className="pe-input pe-input-with-icon" placeholder="City, Country" />
                            </div>
                        </div>
                    </div>
                    <div className="pe-field" style={{ marginTop: '0.25rem' }}>
                        <label className="pe-label">Bio</label>
                        <textarea
                            rows="3"
                            className="pe-input"
                            style={{ resize: 'vertical', minHeight: '80px' }}
                            value={form.bio}
                            onChange={handleChange('bio')}
                            placeholder="Tell us about yourself..."
                        />
                    </div>
                    <div className="pe-field" style={{ marginTop: '0.75rem' }}>
                        <label className="pe-label">Tags</label>
                        <input type="text" className="pe-input" placeholder="Add tag (press Enter)" onKeyDown={handleTagKeyDown} />
                        {form.tags.length > 0 && (
                            <div className="pe-tags">
                                {form.tags.map((tag, idx) => (
                                    <span key={idx} className="pe-tag">
                                        {tag}
                                        <button onClick={() => removeTag(tag)} type="button"><X size={11} /></button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Links & Social */}
                <div className="pe-card">
                    <SectionHeader icon={<LinkIcon size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Links & Social" />
                    <div className="pe-field-grid">
                        <div className="pe-field">
                            <label className="pe-label">Website</label>
                            <div className="pe-input-icon">
                                <Globe size={16} className="pe-icon" />
                                <input type="url" value={form.website} onChange={handleChange('website')} className="pe-input pe-input-with-icon" placeholder="https://" />
                            </div>
                        </div>
                        <div className="pe-field">
                            <label className="pe-label">X (Twitter)</label>
                            <div className="pe-input-icon">
                                <div className="pe-icon" style={{ display: 'flex', alignItems: 'center' }}>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                </div>
                                <input type="text" value={form.twitter} onChange={handleChange('twitter')} className="pe-input pe-input-with-icon" placeholder="@handle" />
                            </div>
                        </div>
                        <div className="pe-field pe-field-full">
                            <label className="pe-label">LinkedIn</label>
                            <div className="pe-input-icon">
                                <Linkedin size={16} className="pe-icon" />
                                <input type="text" value={form.linkedin} onChange={handleChange('linkedin')} className="pe-input pe-input-with-icon" placeholder="LinkedIn URL" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Experience */}
                <div className="pe-card">
                    <SectionHeader icon={<Briefcase size={18} style={{ color: 'var(--color-gray-400)' }} />} title="Experience">
                        <div className="pe-toggle-row">
                            <span className="pe-toggle-label">Show</span>
                            <label className="toggle-switch">
                                <input type="checkbox" checked={form.showExperience} onChange={handleChange('showExperience')} />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </SectionHeader>

                    {form.showExperience && (
                        <div className="pe-experience-list">
                            {form.experience.map((exp, idx) => (
                                <div key={idx} className="pe-exp-item">
                                    <div className="pe-exp-dot" />
                                    <div className="pe-exp-content">
                                        <button onClick={() => handleRemoveExperience(idx)} type="button" className="pe-exp-remove">
                                            <X size={14} />
                                        </button>
                                        <div className="pe-field-grid pe-field-grid-tight">
                                            <div className="pe-field">
                                                <label className="pe-label-sm">Role</label>
                                                <input type="text" value={exp.title} onChange={handleExperienceChange(idx, 'title')} placeholder="Job Title" className="pe-input pe-input-sm" />
                                            </div>
                                            <div className="pe-field">
                                                <label className="pe-label-sm">Company</label>
                                                <input type="text" value={exp.company} onChange={handleExperienceChange(idx, 'company')} placeholder="Company Name" className="pe-input pe-input-sm" />
                                            </div>
                                        </div>
                                        <div className="pe-date-row">
                                            <select
                                                value={exp.fromYear || ''}
                                                onChange={(e) => {
                                                    const updated = [...form.experience];
                                                    updated[idx] = { ...updated[idx], fromYear: e.target.value, date: `${e.target.value} - ${updated[idx].toYear || 'Present'}` };
                                                    setForm(prev => ({ ...prev, experience: updated }));
                                                }}
                                                className="pe-input pe-input-sm"
                                            >
                                                <option value="">From</option>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                            <span className="pe-date-sep">-</span>
                                            <select
                                                value={exp.toYear || ''}
                                                onChange={(e) => {
                                                    const updated = [...form.experience];
                                                    updated[idx] = { ...updated[idx], toYear: e.target.value, date: `${updated[idx].fromYear || ''} - ${e.target.value || 'Present'}` };
                                                    setForm(prev => ({ ...prev, experience: updated }));
                                                }}
                                                className="pe-input pe-input-sm"
                                            >
                                                <option value="">Present</option>
                                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                            </select>
                                        </div>
                                        <textarea rows="2" value={exp.description} onChange={handleExperienceChange(idx, 'description')} placeholder="Details..." className="pe-input pe-input-sm" style={{ resize: 'vertical' }} />
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleAddExperience} type="button" className="pe-add-btn">
                                <Plus size={16} /> Add Experience
                            </button>
                        </div>
                    )}
                </div>

                {/* Nostr */}
                <div className="pe-card pe-nostr-card">
                    <SectionHeader
                        icon={<NostrIcon size={18} color="#8b5cf6" />}
                        title="Nostr"
                    />
                    <p className="pe-section-desc">Manage your Nostr identity, profile, and relay publishing.</p>

                    {/* Identity & Lightning */}
                    <CollapsibleSub
                        title="Identity & Lightning"
                        icon={<Zap size={15} style={{ color: '#f59e0b' }} />}
                        open={nostrIdentityOpen}
                        onToggle={() => setNostrIdentityOpen(v => !v)}
                    >
                        {user?.nostrPubkey && (
                            <div className="pe-field">
                                <label className="pe-label">Public Key (npub)</label>
                                <input
                                    type="text" readOnly
                                    value={nip19.npubEncode(user.nostrPubkey)}
                                    className="pe-input pe-input-readonly"
                                />
                            </div>
                        )}
                        <div className="pe-field-grid">
                            <div className="pe-field">
                                <label className="pe-label">BIES Identity (NIP-05)</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <div className="pe-input-icon" style={{ flex: 1 }}>
                                        <AtSign size={15} className="pe-icon" />
                                        <input
                                            type="text"
                                            value={form.nip05Name}
                                            onChange={handleChange('nip05Name')}
                                            className="pe-input pe-input-with-icon"
                                            placeholder="alice"
                                        />
                                    </div>
                                    {nip05Checking && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-gray-400)' }} />}
                                    {!nip05Checking && nip05Available === true && <CheckCircle size={16} style={{ color: '#16a34a' }} />}
                                    {!nip05Checking && nip05Available === false && <X size={16} style={{ color: '#ef4444' }} />}
                                </div>
                                {form.nip05Name && (
                                    <p className="pe-hint" style={{ color: nip05Available === false ? '#ef4444' : undefined }}>
                                        {nip05Available === false ? 'This name is already taken' : `${form.nip05Name.toLowerCase()}@bies.sovit.xyz`}
                                    </p>
                                )}
                            </div>
                            <div className="pe-field">
                                <label className="pe-label">Lightning Address</label>
                                <div className="pe-input-icon">
                                    <Zap size={15} className="pe-icon" />
                                    <input
                                        type="text"
                                        value={form.lightningAddress}
                                        onChange={handleChange('lightningAddress')}
                                        className="pe-input pe-input-with-icon"
                                        placeholder="you@getalby.com"
                                    />
                                </div>
                                <p className="pe-hint">For receiving zaps. Works with Alby, WoS, Strike, etc.</p>
                            </div>
                        </div>
                    </CollapsibleSub>

                    {/* Nostr Profile Editor */}
                    <CollapsibleSub
                        title="Profile Editor"
                        icon={<User size={15} style={{ color: '#8b5cf6' }} />}
                        open={nostrProfileOpen}
                        onToggle={() => setNostrProfileOpen(v => !v)}
                    >
                        {loadingNostr ? (
                            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} />
                                <p className="pe-hint" style={{ marginTop: '0.5rem' }}>Fetching from relays...</p>
                            </div>
                        ) : (
                            <>
                                <div className="pe-field-grid">
                                    <div className="pe-field">
                                        <label className="pe-label">Display Name</label>
                                        <input type="text" value={nostrForm.display_name} onChange={handleNostrFormChange('display_name')} className="pe-input" placeholder="Display name" />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">@Name</label>
                                        <div className="pe-input-icon">
                                            <AtSign size={14} className="pe-icon" />
                                            <input type="text" value={nostrForm.name} onChange={handleNostrFormChange('name')} className="pe-input pe-input-with-icon" placeholder="username" />
                                        </div>
                                    </div>
                                </div>
                                <div className="pe-field">
                                    <label className="pe-label">About</label>
                                    <textarea rows="2" className="pe-input" style={{ resize: 'vertical' }} value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr" />
                                </div>
                                <div className="pe-field-grid">
                                    <div className="pe-field">
                                        <label className="pe-label">Picture URL</label>
                                        <input type="url" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">Banner URL</label>
                                        <input type="url" value={nostrForm.banner} onChange={handleNostrFormChange('banner')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">Website</label>
                                        <input type="url" value={nostrForm.website} onChange={handleNostrFormChange('website')} className="pe-input" placeholder="https://..." />
                                    </div>
                                    <div className="pe-field">
                                        <label className="pe-label">NIP-05</label>
                                        <input type="text" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} className="pe-input" placeholder="you@domain.com" />
                                    </div>
                                    <div className="pe-field pe-field-full">
                                        <label className="pe-label">LUD-16 (Lightning)</label>
                                        <input type="text" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} className="pe-input" placeholder="you@wallet.com" />
                                    </div>
                                </div>
                            </>
                        )}
                    </CollapsibleSub>

                    {/* Publishing & Feed */}
                    <CollapsibleSub
                        title="Publishing & Feed"
                        icon={<Send size={15} style={{ color: '#16a34a' }} />}
                        open={nostrPublishOpen}
                        onToggle={() => setNostrPublishOpen(v => !v)}
                    >
                        <div className="pe-publish-section">
                            <div className="pe-segmented">
                                <button type="button" onClick={() => setPublishMode('bies')} className={publishMode === 'bies' ? 'active' : ''}>
                                    BIES relay only
                                </button>
                                <button type="button" onClick={() => setPublishMode('all')} className={publishMode === 'all' ? 'active' : ''}>
                                    BIES + public relays
                                </button>
                                <button type="button" onClick={() => setShowPublishHelp(prev => !prev)} className="pe-help-btn-inline">
                                    <HelpCircle size={15} />
                                </button>
                            </div>

                            {showPublishHelp && (
                                <div className="pe-help-box">
                                    <p><strong>BIES relay only</strong> — Saves to the private BIES relay. Only visible within BIES.</p>
                                    <p><strong>BIES + public relays</strong> — Broadcasts to BIES relay + public relays (Damus, Primal, etc).</p>
                                    <p style={{ marginTop: '0.5rem' }}><strong>Fetch</strong> — Pull latest Nostr profile from relays. <strong>Apply</strong> — Copy Nostr data to BIES form. <strong>Push</strong> — Publish BIES data to all relays.</p>
                                </div>
                            )}

                            <button type="button" onClick={handleSaveToNostr} disabled={savingNostr} className="pe-publish-btn">
                                {savingNostr ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={15} />}
                                {savingNostr ? 'Publishing...' : nostrSaved ? 'Published!' : publishMode === 'bies' ? 'Publish to BIES relay' : 'Publish to all relays'}
                                {nostrSaved && <CheckCircle size={15} />}
                            </button>

                            <div className="pe-action-row">
                                <button type="button" onClick={fetchNostrProfile} className="pe-action-btn pe-action-purple">
                                    <RefreshCw size={14} /> Fetch
                                </button>
                                <button type="button" onClick={handleSyncFromNostr} className="pe-action-btn pe-action-blue">
                                    Apply to BIES
                                </button>
                                <button type="button" onClick={handlePushBiesToNostr} disabled={savingNostr} className="pe-action-btn pe-action-green">
                                    <Send size={14} /> Push to relays
                                </button>
                            </div>

                            <div className="pe-feed-toggle">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <span className="pe-label" style={{ padding: 0 }}>Show Nostr feed on profile</span>
                                    <button type="button" onClick={() => setShowFeedHelp(prev => !prev)} className="pe-help-btn-inline">
                                        <HelpCircle size={14} />
                                    </button>
                                </div>
                                <label className="toggle-switch">
                                    <input type="checkbox" checked={form.showNostrFeed} onChange={handleChange('showNostrFeed')} />
                                    <span className="toggle-slider"></span>
                                </label>
                            </div>

                            {showFeedHelp && (
                                <div className="pe-help-box">
                                    <p>When enabled, your recent Nostr notes are shown on your BIES profile.</p>
                                    <p><strong>Private only</strong> — BIES relay notes. <strong>Private + public</strong> — All Nostr activity.</p>
                                </div>
                            )}

                            {form.showNostrFeed && (
                                <div className="pe-segmented" style={{ marginTop: '0.5rem' }}>
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, nostrFeedSource: 'private' }))} className={form.nostrFeedSource === 'private' ? 'active' : ''}>
                                        Private relay only
                                    </button>
                                    <button type="button" onClick={() => setForm(prev => ({ ...prev, nostrFeedSource: 'all' }))} className={form.nostrFeedSource === 'all' ? 'active' : ''}>
                                        Private + public
                                    </button>
                                </div>
                            )}
                        </div>
                    </CollapsibleSub>
                </div>

                {/* Projects */}
                <div className="pe-card">
                    <SectionHeader icon={<Hash size={18} style={{ color: 'var(--color-gray-400)' }} />} title={projectsTitle} />

                    {autoProjects.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <p className="pe-hint" style={{ marginBottom: '0.75rem' }}>Your projects (auto-detected):</p>
                            <div className="pe-project-grid">
                                {autoProjects.map(project => {
                                    const alreadyAdded = form.biesProjects.some(bp => bp.id === project.id);
                                    return (
                                        <div key={project.id} className={`pe-project-item ${alreadyAdded ? 'pe-project-added' : ''}`}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                                {project.image ? (
                                                    <img src={project.image} alt="" className="pe-project-img" />
                                                ) : (
                                                    <div className="pe-project-img pe-project-img-placeholder">{project.name.charAt(0)}</div>
                                                )}
                                                <div style={{ minWidth: 0 }}>
                                                    <p className="pe-project-name">{project.name}</p>
                                                    <p className="pe-project-role">{project.role}</p>
                                                </div>
                                            </div>
                                            {!alreadyAdded ? (
                                                <button onClick={() => handleAddProject({ ...project, coverImage: project.image })} className="pe-project-add-btn">+ Add</button>
                                            ) : (
                                                <span className="pe-project-added-label">Added</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="pe-field">
                        <label className="pe-label">Add Other Projects</label>
                        <input type="text" placeholder="Your Role / Contribution" className="pe-input pe-input-sm" value={newProjectRole} onChange={(e) => setNewProjectRole(e.target.value)} />
                        <div ref={searchRef} style={{ position: 'relative', marginTop: '0.5rem' }}>
                            <div className="pe-input-icon">
                                <Search size={16} className="pe-icon" />
                                <input
                                    type="text"
                                    className="pe-input pe-input-with-icon"
                                    placeholder="Search projects..."
                                    value={projectSearch}
                                    onChange={(e) => { setProjectSearch(e.target.value); setShowProjectDropdown(true); }}
                                    onFocus={() => setShowProjectDropdown(true)}
                                />
                                {projectSearch && (
                                    <button onClick={() => setProjectSearch('')} type="button" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {showProjectDropdown && projectSearch.length > 0 && (
                                <div className="pe-dropdown">
                                    {projectResults.filter(p =>
                                        (p.name || p.title || '').toLowerCase().includes(projectSearch.toLowerCase()) &&
                                        !form.biesProjects.some(bp => bp.id === p.id)
                                    ).map(project => (
                                        <button
                                            key={project.id}
                                            className="pe-dropdown-item"
                                            onClick={() => handleAddProject({ ...project, name: project.name || project.title })}
                                        >
                                            {(project.image || project.thumbnail) && <img src={project.image || project.thumbnail} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-gray-900)' }}>{project.name || project.title}</p>
                                                <p style={{ fontSize: '0.7rem', color: 'var(--color-gray-500)' }}>{project.status || project.stage}</p>
                                            </div>
                                        </button>
                                    ))}
                                    {projectResults.filter(p => (p.name || p.title || '').toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                                        <div className="pe-dropdown-empty">No projects found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {form.biesProjects.length > 0 && (
                        <div className="pe-project-grid" style={{ marginTop: '1rem' }}>
                            {form.biesProjects.map(project => (
                                <div key={project.id} className="pe-project-item">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                                        {project.image && <img src={project.image} alt="" className="pe-project-img" />}
                                        <div style={{ minWidth: 0 }}>
                                            <p className="pe-project-name">{project.name}</p>
                                            <p className="pe-project-role">{project.role}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveProject(project.id)} type="button" style={{ padding: '0.25rem', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Bottom save */}
                <div className="pe-bottom-save">
                    <button onClick={handleSave} type="button" disabled={saving} className="pe-save-btn pe-save-btn-full">
                        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>

            </div>

            {cropImage && (
                <ImageCropModal
                    imageSrc={cropImage.src}
                    aspect={cropImage.type === 'avatar' ? 1 : 16 / 5}
                    shape={cropImage.type === 'avatar' ? 'round' : 'rect'}
                    onCrop={handleCropConfirm}
                    onCancel={handleCropCancel}
                />
            )}

            <style jsx>{`
                /* ── Page Layout ── */
                .pe-page { background: var(--color-surface-overlay, #f8fafc); min-height: 100vh; }
                .pe-container {
                    max-width: 680px;
                    margin: 0 auto;
                    padding: 1rem 1rem 3rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .pe-topbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.25rem 0;
                }
                .pe-page-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    font-family: var(--font-display);
                    color: var(--color-gray-900);
                }
                .pe-error {
                    background: var(--color-red-tint, #FEF2F2);
                    color: #EF4444;
                    padding: 0.6rem 0.875rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                }

                /* ── Cards ── */
                .pe-card {
                    background: var(--color-surface, white);
                    padding: 1.25rem;
                    border-radius: var(--radius-xl, 12px);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                }
                .pe-nostr-card {
                    border-left: 3px solid #8b5cf6;
                }

                /* ── Section Headers ── */
                .pe-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--color-gray-200, #e5e7eb);
                }
                .pe-section-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pe-section-title h3 {
                    font-size: 1.05rem;
                    font-weight: 700;
                    font-family: var(--font-display);
                    margin: 0;
                }
                .pe-section-desc {
                    font-size: 0.8rem;
                    color: var(--color-gray-500, #6b7280);
                    margin: -0.5rem 0 0.75rem;
                    line-height: 1.4;
                }

                /* ── Form Fields ── */
                .pe-field { display: flex; flex-direction: column; gap: 0.3rem; }
                .pe-field-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }
                .pe-field-grid-tight { gap: 0.5rem; }
                .pe-field-full { grid-column: 1 / -1; }
                .pe-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-gray-600, #4b5563);
                }
                .pe-label-sm {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-gray-500, #6b7280);
                }
                .pe-input {
                    width: 100%;
                    padding: 0.55rem 0.75rem;
                    border: 1px solid var(--color-gray-300, #d1d5db);
                    background: var(--color-surface, white);
                    border-radius: var(--radius-md, 6px);
                    outline: none;
                    font-size: 0.875rem;
                    transition: border-color 0.15s, box-shadow 0.15s;
                }
                .pe-input:focus {
                    border-color: var(--color-primary, #0052cc);
                    box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.1);
                }
                .pe-input-sm { padding: 0.45rem 0.65rem; font-size: 0.825rem; }
                .pe-input-readonly {
                    background: var(--color-gray-100, #f9fafb);
                    cursor: default;
                    font-family: monospace;
                    font-size: 0.8rem;
                }
                .pe-input-icon { position: relative; display: flex; align-items: center; }
                .pe-icon {
                    position: absolute;
                    left: 0.65rem;
                    color: var(--color-gray-400, #9ca3af);
                    pointer-events: none;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                }
                .pe-input-with-icon { padding-left: 2.1rem; flex: 1; min-width: 0; }
                .pe-hint {
                    font-size: 0.72rem;
                    color: var(--color-gray-500, #6b7280);
                    line-height: 1.3;
                    margin-top: 0.15rem;
                }

                /* ── Tags ── */
                .pe-tags { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.375rem; }
                .pe-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.25rem 0.6rem;
                    background: #dcfce7;
                    color: #15803d;
                    border-radius: 9999px;
                    font-size: 0.72rem;
                    font-weight: 500;
                }
                .pe-tag button {
                    color: inherit;
                    opacity: 0.6;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                }

                /* ── Banner / Avatar ── */
                .pe-banner {
                    height: 160px;
                    position: relative;
                }
                .pe-banner-overlay {
                    position: absolute;
                    inset: 0;
                    z-index: 5;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.45);
                    gap: 0.375rem;
                }
                .pe-banner-edit {
                    position: absolute;
                    top: 0.75rem;
                    left: 0.75rem;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    background: var(--color-surface, white);
                    color: var(--color-gray-900, #1f2937);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.4rem 0.75rem;
                    font-weight: 600;
                    font-size: 0.78rem;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    border: none;
                }
                .pe-avatar-row {
                    padding: 0 1.25rem 1rem;
                    position: relative;
                    z-index: 5;
                }
                .pe-avatar-wrapper {
                    margin-top: -48px;
                    position: relative;
                    width: fit-content;
                }
                .pe-avatar {
                    width: 96px;
                    height: 96px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid var(--color-surface, white);
                    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                }
                .pe-avatar img { width: 100%; height: 100%; object-fit: cover; }
                .pe-avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    background: var(--color-gray-100, #f3f4f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: 700;
                    color: var(--color-gray-400, #9ca3af);
                }
                .pe-avatar-loading {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.7);
                    border-radius: 50%;
                }
                .pe-avatar-edit {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 30px;
                    height: 30px;
                    background: var(--color-surface, white);
                    border-radius: 50%;
                    border: 1px solid #e5e7eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                /* ── Save Button ── */
                .pe-save-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: var(--color-primary, #0052cc);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md, 6px);
                    height: 36px;
                    padding: 0 1.25rem;
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    white-space: nowrap;
                }
                .pe-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .pe-save-btn-full { width: 100%; justify-content: center; height: 40px; }
                .pe-bottom-save { padding-top: 0.25rem; }

                /* ── Toggle ── */
                .pe-toggle-row { display: flex; align-items: center; gap: 0.5rem; }
                .pe-toggle-label { font-size: 0.78rem; font-weight: 500; color: var(--color-gray-500, #6b7280); }
                .toggle-switch { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider {
                    position: absolute; cursor: pointer; inset: 0;
                    background: var(--color-surface-raised, #cbd5e1); border: 1px solid var(--color-gray-200, #e5e7eb); transition: .3s; border-radius: 22px;
                }
                .toggle-slider:before {
                    content: ""; position: absolute;
                    height: 16px; width: 16px; left: 3px; bottom: 3px;
                    background: var(--color-surface, white); transition: .3s; border-radius: 50%;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .toggle-switch input:checked + .toggle-slider { background: var(--color-primary, #0052cc); }
                .toggle-switch input:checked + .toggle-slider:before { transform: translateX(18px); }

                /* ── Experience ── */
                .pe-experience-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .pe-exp-item {
                    padding-left: 1.25rem;
                    border-left: 2px solid var(--color-gray-200, #e5e7eb);
                    position: relative;
                }
                .pe-exp-dot {
                    position: absolute;
                    width: 10px; height: 10px;
                    background: var(--color-primary, #0052cc);
                    border-radius: 50%;
                    left: -6px; top: 4px;
                }
                .pe-exp-content {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                }
                .pe-exp-remove {
                    position: absolute;
                    top: -2px; right: 0;
                    color: var(--color-gray-400);
                    background: none; border: none; cursor: pointer;
                    padding: 2px;
                }
                .pe-date-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pe-date-row select { flex: 1; appearance: auto; cursor: pointer; }
                .pe-date-sep { color: var(--color-gray-400); font-weight: 500; font-size: 0.85rem; }
                .pe-add-btn {
                    width: 100%;
                    padding: 0.6rem;
                    border: 2px dashed var(--color-gray-300, #d1d5db);
                    border-radius: var(--radius-md, 6px);
                    background: none;
                    color: var(--color-gray-500, #6b7280);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                /* ── Collapsible Sections ── */
                .pe-collapsible {
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    margin-bottom: 0.5rem;
                    overflow: hidden;
                }
                .pe-collapsible-trigger {
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.65rem 0.875rem;
                    background: var(--color-surface-raised, #fafbfc);
                    border: none;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-gray-700, #374151);
                }
                .pe-collapsible-trigger:hover { background: var(--color-gray-100, #f5f6f8); }
                .pe-collapsible-label { display: flex; align-items: center; gap: 0.5rem; }
                .pe-collapsible-body { padding: 0.875rem; display: flex; flex-direction: column; gap: 0.65rem; }

                /* ── Nostr Publishing ── */
                .pe-publish-section { display: flex; flex-direction: column; gap: 0.6rem; }
                .pe-segmented {
                    display: flex;
                    border-radius: var(--radius-md, 6px);
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                }
                .pe-segmented button {
                    flex: 1;
                    padding: 0.4rem 0.5rem;
                    border: none;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.78rem;
                    background: transparent;
                    color: #6b7280;
                    transition: all 0.15s;
                    white-space: nowrap;
                }
                .pe-segmented button + button { border-left: 1px solid #e5e7eb; }
                .pe-segmented button.active { background: #7c3aed; color: white; }
                .pe-help-btn-inline {
                    flex: 0 0 auto;
                    padding: 0.25rem 0.5rem;
                    background: none;
                    border: none;
                    border-left: 1px solid #e5e7eb;
                    color: #9ca3af;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                .pe-help-box {
                    background: var(--color-gray-100, #f9fafb);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    padding: 0.6rem 0.75rem;
                    font-size: 0.75rem;
                    color: #4b5563;
                    line-height: 1.45;
                }
                .pe-help-box p { margin: 0 0 0.2rem; }
                .pe-publish-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.6rem 0.75rem;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    border-radius: var(--radius-md, 6px);
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                }
                .pe-publish-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                .pe-action-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
                .pe-action-btn {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.3rem;
                    padding: 0.45rem 0.5rem;
                    border-radius: var(--radius-md, 6px);
                    background: none;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 0.78rem;
                    white-space: nowrap;
                }
                .pe-action-purple { border: 1px solid #e9d5ff; color: #7c3aed; }
                .pe-action-blue { border: 1px solid #bfdbfe; color: #2563eb; }
                .pe-action-green { border: 1px solid #bbf7d0; color: #16a34a; }
                .pe-feed-toggle {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 0.6rem;
                    border-top: 1px solid var(--color-gray-200, #e5e7eb);
                    margin-top: 0.25rem;
                }

                /* ── Projects ── */
                .pe-project-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.5rem;
                }
                .pe-project-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.65rem 0.75rem;
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    background: var(--color-surface, white);
                }
                .pe-project-added { background: var(--color-blue-tint, #f0f7ff); border-color: #bfdbfe; opacity: 0.7; }
                .pe-project-img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
                .pe-project-img-placeholder {
                    background: var(--color-gray-100, #f3f4f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    color: var(--color-gray-400, #9ca3af);
                    font-size: 0.85rem;
                }
                .pe-project-name { font-size: 0.8rem; font-weight: 700; color: var(--color-gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pe-project-role { font-size: 0.7rem; font-weight: 600; color: var(--color-primary, #0052cc); }
                .pe-project-add-btn {
                    padding: 0.3rem 0.6rem;
                    color: var(--color-primary, #0052cc);
                    background: none;
                    border: 1px solid var(--color-primary, #0052cc);
                    cursor: pointer;
                    border-radius: var(--radius-md, 6px);
                    font-size: 0.72rem;
                    font-weight: 600;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .pe-project-added-label { font-size: 0.7rem; color: var(--color-primary, #0052cc); font-weight: 600; flex-shrink: 0; }

                /* ── Dropdown ── */
                .pe-dropdown {
                    position: absolute;
                    z-index: 20;
                    margin-top: 0.35rem;
                    width: 100%;
                    background: var(--color-surface, white);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: var(--radius-md, 6px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
                    max-height: 200px;
                    overflow-y: auto;
                    padding: 0.25rem 0;
                }
                .pe-dropdown-item {
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                }
                .pe-dropdown-item:hover { background: var(--color-gray-100, #f9fafb); }
                .pe-dropdown-empty {
                    padding: 1rem 0.75rem;
                    text-align: center;
                    color: var(--color-gray-500, #6b7280);
                    font-size: 0.8rem;
                    font-style: italic;
                }

                /* ── Responsive ── */
                @media (max-width: 600px) {
                    .pe-container { padding: 0.75rem 0.75rem 2.5rem; gap: 0.75rem; }
                    .pe-card { padding: 1rem; }
                    .pe-field-grid { grid-template-columns: 1fr; gap: 0.6rem; }
                    .pe-banner { height: 120px; }
                    .pe-avatar { width: 72px; height: 72px; }
                    .pe-avatar-wrapper { margin-top: -36px; }
                    .pe-avatar-placeholder { font-size: 1.5rem; }
                    .pe-avatar-edit { width: 26px; height: 26px; }
                    .pe-banner-edit-text { display: none; }
                    .pe-action-row { flex-direction: column; }
                    .pe-action-btn { min-width: 100%; }
                    .pe-page-title { font-size: 1.25rem; }
                    .pe-segmented button { font-size: 0.72rem; padding: 0.35rem 0.25rem; }
                }

                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes progress-indeterminate {
                    0% { width: 0%; margin-left: 0%; }
                    50% { width: 60%; margin-left: 20%; }
                    100% { width: 0%; margin-left: 100%; }
                }
            `}</style>
        </div>
    );
};

export default ProfileEdit;
