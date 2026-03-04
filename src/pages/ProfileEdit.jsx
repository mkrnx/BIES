import { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Linkedin, Briefcase, Plus, Hash, Camera, Loader2, CheckCircle, Save, Search, X, RefreshCw, Send, AtSign, Zap } from 'lucide-react';
import NostrIcon from '../components/NostrIcon';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi, projectsApi } from '../services/api';
import { nostrService } from '../services/nostrService';
import { Link, useNavigate } from 'react-router-dom';
import NostrFeed from '../components/NostrFeed';
import ImageCropModal from '../components/ImageCropModal';

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
        name: '', about: '', picture: '', website: '', nip05: '', lud16: '', banner: ''
    });

    // Project search
    const [projectSearch, setProjectSearch] = useState('');
    const [projectResults, setProjectResults] = useState([]);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [newProjectRole, setNewProjectRole] = useState('');

    // ─── Data Loading ───

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (user?.nostrPubkey) {
            fetchNostrProfile();
        }
    }, [user?.nostrPubkey]);

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
                setProjectResults(res.data || res || []);
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
                    experience: profile.experience || [],
                    biesProjects: profile.biesProjects || [],
                    nostrNpub: profile.nostrNpub || '',
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

    // Experience
    const handleAddExperience = () => {
        setForm(prev => ({
            ...prev,
            experience: [...prev.experience, { title: '', company: '', date: '', description: '' }]
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
            await nostrService.updateProfile(data);
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
            bio: nostrProfile.about || prev.bio,
            avatar: nostrProfile.picture || prev.avatar,
            website: nostrProfile.website || prev.website,
        }));
    };

    const handlePushBiesToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
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
        <div className="profile-page">
            <div className="container py-8 max-w-6xl">

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="h1-title mb-1">Edit Profile</h1>
                        <p className="text-gray-500">Manage your profile appearance and information.</p>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                {/* Header Card */}
                <div className="profile-card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Banner */}
                    <div className="relative" style={{
                        height: '240px',
                        background: (form.banner || nostrProfile?.banner) ? `url(${form.banner || nostrProfile?.banner}) center/cover no-repeat` : 'linear-gradient(to right, #0052cc, #0a192f)'
                    }}>
                        {(uploadingBanner || bannerImageLoading) && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', gap: '0.75rem' }}>
                                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'white' }} />
                                <span style={{ color: 'white', fontWeight: 600, fontSize: '0.875rem' }}>
                                    {uploadingBanner ? 'Uploading banner...' : 'Loading image...'}
                                </span>
                                <div style={{ width: '160px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: '2px', background: 'white', animation: 'progress-indeterminate 1.5s ease-in-out infinite' }} />
                                </div>
                            </div>
                        )}
                        <div className="absolute z-10 flex gap-3" style={{ top: '24px', left: '24px' }}>
                            <label className="banner-btn" style={{ cursor: 'pointer' }}>
                                {uploadingBanner ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={18} />}
                                {uploadingBanner ? 'Uploading...' : 'Edit Banner'}
                                <input type="file" accept="image/*" onChange={handleBannerSelect} style={{ display: 'none' }} />
                            </label>
                        </div>

                        <div style={{ position: 'absolute', bottom: '24px', right: '24px', zIndex: 20 }}>
                            <button onClick={handleSave} type="button" disabled={saving} style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'var(--color-primary, #0052cc)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 'var(--radius-md, 8px)',
                                height: '44px',
                                padding: '0 24px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-display)',
                                fontSize: '1rem',
                                letterSpacing: '0.02em',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.7 : 1,
                            }}>
                                {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    {/* Profile Info */}
                    <div className="pb-8" style={{ paddingLeft: '24px', paddingRight: '24px', position: 'relative', zIndex: 5 }}>
                        {/* Avatar */}
                        <div style={{ marginTop: '-80px', position: 'relative', zIndex: 5, width: 'fit-content' }}>
                            <div style={{ width: '168px', height: '168px', borderRadius: '50%', overflow: 'hidden', border: '5px solid white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                {(form.avatar || nostrProfile?.picture) ? (
                                    <img src={form.avatar || nostrProfile?.picture} alt={form.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', background: 'var(--color-gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', fontWeight: 700, color: 'var(--color-gray-400)' }}>
                                        {(form.name || user?.email || '?').charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            {(uploadingAvatar || avatarImageLoading) && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', borderRadius: '50%', gap: '0.25rem' }}>
                                    <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
                                    <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                                        {uploadingAvatar ? 'Uploading...' : 'Loading...'}
                                    </span>
                                </div>
                            )}
                            <label style={{ position: 'absolute', bottom: '4px', right: '4px', width: '40px', height: '40px', backgroundColor: 'white', borderRadius: '50%', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <Camera size={18} style={{ color: '#374151' }} />
                                <input type="file" accept="image/*" onChange={handleAvatarSelect} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {/* Form Fields */}
                        <div className="w-full max-w-2xl" style={{ marginTop: '1rem' }}>
                            <div className="form-row">
                                <label className="form-label">Name</label>
                                <div className="form-content">
                                    <input type="text" value={form.name} onChange={handleChange('name')} className="input-field" placeholder="Your Name" />
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Current Role</label>
                                <div className="form-content">
                                    <input type="text" value={form.title} onChange={handleChange('title')} className="input-field" placeholder="Role/Title" />
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Company</label>
                                <div className="form-content">
                                    <input type="text" value={form.company} onChange={handleChange('company')} className="input-field" placeholder="Company" />
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Location</label>
                                <div className="form-content">
                                    <div className="input-with-icon w-full">
                                        <MapPin size={18} className="icon" />
                                        <input type="text" value={form.location} onChange={handleChange('location')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="City, Country" />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Tags</label>
                                <div className="form-content">
                                    <input type="text" className="input-field" placeholder="Add tag (press Enter)" onKeyDown={handleTagKeyDown} />
                                    {form.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2" style={{ marginTop: '0.75rem' }}>
                                            {form.tags.map((tag, idx) => (
                                                <span key={idx} className="status-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem' }}>
                                                    {tag}
                                                    <button onClick={() => removeTag(tag)} style={{ color: 'inherit', opacity: 0.6 }}><X size={12} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sections below the header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '4rem' }}>

                    {/* About Section */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>About</h3>
                            <div className="form-row" style={{ marginBottom: 0 }}>
                                <label className="form-label">Bio</label>
                                <div className="form-content">
                                    <textarea
                                        rows="5"
                                        className="input-field"
                                        style={{ resize: 'vertical', minHeight: '120px' }}
                                        value={form.bio}
                                        onChange={handleChange('bio')}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Experience */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>
                                <h3 className="h3-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Briefcase size={20} style={{ color: 'var(--color-gray-400)' }} />
                                    Experience
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-600)' }}>Show on profile</span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={form.showExperience} onChange={handleChange('showExperience')} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            {form.showExperience && (
                                <div>
                                    {form.experience.map((exp, idx) => (
                                        <div key={idx} className="experience-item" style={{ marginBottom: '2rem' }}>
                                            <div className="experience-dot"></div>
                                            <div style={{ position: 'relative' }}>
                                                <button onClick={() => handleRemoveExperience(idx)} style={{ position: 'absolute', top: '-4px', right: 0, color: 'var(--color-gray-400)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <X size={16} />
                                                </button>
                                                <div className="form-row" style={{ gridTemplateColumns: '100px 1fr', marginBottom: '1rem' }}>
                                                    <label className="form-label" style={{ width: 'auto' }}>Role</label>
                                                    <input type="text" value={exp.title} onChange={handleExperienceChange(idx, 'title')} placeholder="Job Title" className="input-field" />
                                                </div>
                                                <div className="form-row" style={{ gridTemplateColumns: '100px 1fr', marginBottom: '1rem' }}>
                                                    <label className="form-label" style={{ width: 'auto' }}>Company</label>
                                                    <input type="text" value={exp.company} onChange={handleExperienceChange(idx, 'company')} placeholder="Company Name" className="input-field" />
                                                </div>
                                                <div className="form-row" style={{ gridTemplateColumns: '100px 1fr', marginBottom: '1rem' }}>
                                                    <label className="form-label" style={{ width: 'auto' }}>Date</label>
                                                    <input type="text" value={exp.date} onChange={handleExperienceChange(idx, 'date')} placeholder="e.g. 2020 - Present" className="input-field" />
                                                </div>
                                                <div className="form-row" style={{ gridTemplateColumns: '100px 1fr', marginBottom: 0 }}>
                                                    <label className="form-label" style={{ width: 'auto' }}>Details</label>
                                                    <textarea rows="3" value={exp.description} onChange={handleExperienceChange(idx, 'description')} placeholder="Describe your experience..." className="input-field" style={{ resize: 'vertical' }} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ marginLeft: 'calc(100px + 2rem)' }}>
                                        <button onClick={handleAddExperience} type="button" style={{ width: '100%', padding: '0.75rem', border: '2px dashed var(--color-gray-300)', borderRadius: 'var(--radius-md)', background: 'none', color: 'var(--color-gray-500)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                            <Plus size={18} /> Add Experience
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Links */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>Links</h3>

                            <div className="form-row">
                                <label className="form-label">Website</label>
                                <div className="form-content">
                                    <div className="input-with-icon w-full">
                                        <Globe size={18} className="icon" />
                                        <input type="url" value={form.website} onChange={handleChange('website')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="https://" />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">X (Twitter)</label>
                                <div className="form-content">
                                    <div className="input-with-icon w-full">
                                        <div className="icon" style={{ display: 'flex', alignItems: 'center' }}>
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                        </div>
                                        <input type="text" value={form.twitter} onChange={handleChange('twitter')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="@handle" />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">LinkedIn</label>
                                <div className="form-content">
                                    <div className="input-with-icon w-full">
                                        <Linkedin size={18} className="icon" />
                                        <input type="text" value={form.linkedin} onChange={handleChange('linkedin')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="LinkedIn URL" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BIES Identity & Lightning */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>
                                <AtSign size={20} style={{ color: '#f59e0b' }} />
                                BIES Identity & Lightning
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                Get a verified NIP-05 identity and set your Lightning address for receiving zaps.
                            </p>

                            <div className="form-row">
                                <label className="form-label">BIES Identity</label>
                                <div className="form-content">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div className="input-with-icon" style={{ flex: 1 }}>
                                            <AtSign size={18} className="icon" />
                                            <input
                                                type="text"
                                                value={form.nip05Name}
                                                onChange={handleChange('nip05Name')}
                                                className="input-field"
                                                style={{ paddingLeft: '40px' }}
                                                placeholder="alice"
                                            />
                                        </div>
                                        {nip05Checking && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-gray-400)' }} />}
                                        {!nip05Checking && nip05Available === true && <CheckCircle size={18} style={{ color: '#16a34a' }} />}
                                        {!nip05Checking && nip05Available === false && <X size={18} style={{ color: '#ef4444' }} />}
                                    </div>
                                    {form.nip05Name && (
                                        <p style={{ fontSize: '0.75rem', color: nip05Available === false ? '#ef4444' : 'var(--color-gray-500)', marginTop: '0.5rem' }}>
                                            {nip05Available === false ? 'This name is already taken' : `Your NIP-05: ${form.nip05Name.toLowerCase()}@bies.sovit.xyz`}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Lightning Address</label>
                                <div className="form-content">
                                    <div className="input-with-icon w-full">
                                        <Zap size={18} className="icon" />
                                        <input
                                            type="text"
                                            value={form.lightningAddress}
                                            onChange={handleChange('lightningAddress')}
                                            className="input-field w-full"
                                            style={{ paddingLeft: '40px' }}
                                            placeholder="you@getalby.com"
                                        />
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)', marginTop: '0.5rem' }}>
                                        Your Lightning address (lud16) for receiving zaps. Works with Alby, WoS, Strike, etc.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nostr Profile */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>
                                <NostrIcon size={20} color="#8b5cf6" />
                                Nostr Profile
                            </h3>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Edit your Nostr identity. Changes are published to relays.</p>

                            {user?.nostrPubkey && (
                                <div className="form-row">
                                    <label className="form-label">Public Key (npub)</label>
                                    <div className="form-content">
                                        <input
                                            type="text"
                                            readOnly
                                            value={nip19.npubEncode(user.nostrPubkey)}
                                            className="input-field"
                                            style={{ cursor: 'default', background: '#f9fafb', fontFamily: 'monospace', fontSize: '0.875rem' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {loadingNostr ? (
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} />
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-400)', marginTop: '0.5rem' }}>Fetching from relays...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="form-row">
                                        <label className="form-label">Nostr Name</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.name} onChange={handleNostrFormChange('name')} className="input-field" placeholder="Name on Nostr" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">About</label>
                                        <div className="form-content">
                                            <textarea rows="3" className="input-field" style={{ resize: 'vertical' }} value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Picture URL</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} className="input-field" placeholder="https://..." />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Website</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.website} onChange={handleNostrFormChange('website')} className="input-field" placeholder="https://..." />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">NIP-05</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} className="input-field" placeholder="you@domain.com" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">LUD-16</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} className="input-field" placeholder="you@wallet.com" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Banner URL</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.banner} onChange={handleNostrFormChange('banner')} className="input-field" placeholder="https://..." />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" onClick={handleSaveToNostr} disabled={savingNostr} className="btn btn-primary" style={{ flex: 1, minWidth: '160px', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem' }}>
                                    {savingNostr ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
                                    {savingNostr ? 'Publishing...' : nostrSaved ? 'Published!' : 'Save to Nostr'}
                                    {nostrSaved && <CheckCircle size={16} />}
                                </button>
                                <button type="button" onClick={fetchNostrProfile} style={{ flex: 0.5, minWidth: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem', border: '1px solid #e9d5ff', borderRadius: 'var(--radius-md)', background: 'none', color: '#7c3aed', cursor: 'pointer', fontWeight: 500 }}>
                                    <RefreshCw size={16} /> Refresh
                                </button>
                                <button type="button" onClick={handleSyncFromNostr} style={{ flex: 0.5, minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', background: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 500 }}>
                                    Sync to BIES
                                </button>
                                <button type="button" onClick={handlePushBiesToNostr} disabled={savingNostr} style={{ flex: 0.5, minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.625rem 1rem', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', background: 'none', color: '#16a34a', cursor: 'pointer', fontWeight: 500 }}>
                                    <Send size={16} /> Push BIES to Nostr
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Nostr Identity & Feed Toggle */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>
                                <h3 className="h3-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Hash size={20} style={{ color: '#8b5cf6' }} />
                                    Nostr Identity & Feed
                                </h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-600)' }}>Show feed</span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={form.showNostrFeed} onChange={handleChange('showNostrFeed')} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-600)', marginBottom: '1.5rem', lineHeight: 1.6 }}>Connect your Nostr NPUB to display your notes directly on your profile.</p>

                            <div className="form-row">
                                <label className="form-label">Nostr npub</label>
                                <div className="form-content">
                                    <input
                                        type="text"
                                        placeholder="npub1..."
                                        value={form.nostrNpub}
                                        onChange={handleChange('nostrNpub')}
                                        className="input-field"
                                        style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
                                    />
                                </div>
                            </div>

                            {form.showNostrFeed && form.nostrNpub && (
                                <div style={{ marginTop: '2rem', borderTop: '1px solid var(--color-gray-200)', paddingTop: '2rem', opacity: 0.6, pointerEvents: 'none' }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--color-gray-500)', fontWeight: 500, marginBottom: '1rem' }}>Feed Preview:</p>
                                    <NostrFeed npub={form.nostrNpub} notes={[]} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Projects */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title" style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-gray-200)' }}>{projectsTitle}</h3>

                            <div className="form-row">
                                <label className="form-label">Add Project</label>
                                <div className="form-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <input
                                        type="text"
                                        placeholder="Your Role / Contribution"
                                        className="input-field"
                                        value={newProjectRole}
                                        onChange={(e) => setNewProjectRole(e.target.value)}
                                    />
                                    <div ref={searchRef} style={{ position: 'relative' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'white' }}>
                                            <div style={{ paddingLeft: '1rem', color: 'var(--color-gray-400)' }}>
                                                <Search size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                style={{ width: '100%', padding: '0.625rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.875rem' }}
                                                placeholder="Search projects to add..."
                                                value={projectSearch}
                                                onChange={(e) => { setProjectSearch(e.target.value); setShowProjectDropdown(true); }}
                                                onFocus={() => setShowProjectDropdown(true)}
                                            />
                                            {projectSearch && (
                                                <button onClick={() => setProjectSearch('')} style={{ paddingRight: '1rem', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {showProjectDropdown && projectSearch.length > 0 && (
                                            <div style={{ position: 'absolute', zIndex: 20, marginTop: '0.5rem', width: '100%', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-xl)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxHeight: '240px', overflowY: 'auto', padding: '0.5rem 0' }}>
                                                {projectResults.filter(p =>
                                                    p.name.toLowerCase().includes(projectSearch.toLowerCase()) &&
                                                    !form.biesProjects.some(bp => bp.id === p.id)
                                                ).map(project => (
                                                    <button
                                                        key={project.id}
                                                        style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.75rem', border: 'none', background: 'none', cursor: 'pointer' }}
                                                        onClick={() => handleAddProject(project)}
                                                    >
                                                        {project.image && <img src={project.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
                                                        <div>
                                                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-gray-900)' }}>{project.name}</p>
                                                            <p style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>{project.status}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {projectResults.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                                                    <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                                                        No projects found matching &ldquo;{projectSearch}&rdquo;
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {form.biesProjects.length > 0 && (
                                <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {form.biesProjects.map(project => (
                                        <div key={project.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 'var(--radius-xl)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                {project.image && <img src={project.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                                                <div>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>{project.name}</p>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)' }}>{project.role}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveProject(project.id)} style={{ padding: '0.5rem', color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '50%' }}>
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

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
                .profile-page {
                    background-color: #f8fafc;
                    min-height: 100vh;
                }
                .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

                .profile-card {
                    background: white;
                    padding: 2rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                }

                .banner-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    background-color: white;
                    color: #1f2937;
                    border-radius: var(--radius-md);
                    height: 42px;
                    padding: 0 24px;
                    white-space: nowrap;
                    font-weight: 700;
                    font-family: var(--font-display);
                    font-size: 1rem;
                    letter-spacing: 0.02em;
                    border: none;
                    cursor: pointer;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .banner-btn:hover { opacity: 0.9; }

                .form-row {
                    display: grid;
                    grid-template-columns: 160px 1fr;
                    gap: 2rem;
                    align-items: start;
                    margin-bottom: 2rem;
                }
                .form-label {
                    text-align: right;
                    color: var(--color-gray-700);
                    font-weight: 600;
                    font-size: 0.875rem;
                    padding-top: 0.5rem;
                }
                .form-content { min-width: 0; }

                .h1-title { font-size: 2rem; line-height: 2.25rem; font-weight: 700; font-family: var(--font-display); }
                .h3-title { font-size: 1.25rem; font-weight: 700; font-family: var(--font-display); }

                .editable-title {
                    font-size: 2rem;
                    line-height: 2.25rem;
                    font-weight: 700;
                    font-family: var(--font-display);
                    width: 100%;
                    border: 1px solid var(--color-gray-200);
                    background: white;
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    transition: all 0.2s;
                    color: var(--color-gray-900);
                }
                .editable-title:focus {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1);
                    outline: none;
                }

                .input-field {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    background: white;
                    border-radius: var(--radius-md);
                    outline: none;
                    transition: all 0.2s;
                }
                .input-field:focus {
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1);
                }

                .input-with-icon { position: relative; }
                .input-with-icon .icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--color-gray-400);
                    pointer-events: none;
                }

                .status-badge {
                    background: #dcfce7;
                    color: #15803d;
                    padding: 0.25rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                }

                .experience-item {
                    padding-left: 1.5rem;
                    border-left: 2px solid var(--color-gray-200);
                    position: relative;
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

                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 44px;
                    height: 24px;
                }
                .toggle-switch input { opacity: 0; width: 0; height: 0; }
                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: #cbd5e1;
                    transition: .3s;
                    border-radius: 24px;
                }
                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .3s;
                    border-radius: 50%;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .toggle-switch input:checked + .toggle-slider { background-color: var(--color-primary); }
                .toggle-switch input:checked + .toggle-slider:before { transform: translateX(20px); }

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
