import React, { useState, useEffect, useRef } from 'react';
import { User, Mail, Globe, MapPin, Shield, Twitter, Linkedin, Briefcase, Plus, Camera, Loader2, CheckCircle, ArrowLeft, MoreHorizontal, Share, Save, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi, projectsApi } from '../services/api';
import { Link } from 'react-router-dom';
import NostrFeed from '../components/NostrFeed';
import NostrIcon from '../components/NostrIcon';

const Profile = () => {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [nostrProfile, setNostrProfile] = useState(null);
    const [loadingNostr, setLoadingNostr] = useState(false);
    const [nostrForm, setNostrForm] = useState({ name: '', about: '', picture: '', website: '', nip05: '', lud16: '', banner: '' });
    const [savingNostr, setSavingNostr] = useState(false);
    const [nostrSaved, setNostrSaved] = useState(false);
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
    });

    // Project Search State
    const [projectSearch, setProjectSearch] = useState('');
    const [isSearchingProjects, setIsSearchingProjects] = useState(false);
    const [projectResults, setProjectResults] = useState([]);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);
    const [newProjectRole, setNewProjectRole] = useState('');
    const searchRef = useRef(null);

    // Click outside handler for project dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowProjectDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        if (user?.nostrPubkey) {
            fetchNostrProfile();
        }
    }, [user?.nostrPubkey]);

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

    const handleNostrFormChange = (field) => (e) => {
        setNostrForm(prev => ({ ...prev, [field]: e.target.value }));
        setNostrSaved(false);
    };

    const handleSaveToNostr = async () => {
        setSavingNostr(true);
        setError('');
        try {
            const data = {};
            if (nostrForm.name) data.name = nostrForm.name;
            if (nostrForm.about) data.about = nostrForm.about;
            if (nostrForm.picture) data.picture = nostrForm.picture;
            if (nostrForm.website) data.website = nostrForm.website;
            if (nostrForm.nip05) data.nip05 = nostrForm.nip05;
            if (nostrForm.lud16) data.lud16 = nostrForm.lud16;
            if (nostrForm.banner) data.banner = nostrForm.banner;

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
        setSaved(false);
    };

    const loadProfile = async () => {
        try {
            const profile = await profilesApi.me();
            setForm({
                id: profile.id, // Need ID for saving/displaying
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
            });
        } catch (err) {
            setError('Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
        setSaved(false);
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, avatar: result.url }));
        } catch (err) {
            setError('Failed to upload image.');
        }
    };

    const handleBannerUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const result = await uploadApi.media(file);
            setForm(prev => ({ ...prev, banner: result.url }));
        } catch (err) {
            setError('Failed to upload banner.');
        }
    };

    const handleSave = async (e) => {
        e?.preventDefault();
        setSaving(true);
        setError('');

        try {
            await profilesApi.update(form);
            await refreshUser();
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.message || 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    // --- Tags Logic ---
    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' && e.target.value.trim()) {
            e.preventDefault();
            const newTag = e.target.value.trim();
            if (!form.tags.includes(newTag)) {
                setForm(prev => ({ ...prev, tags: [...prev.tags, newTag] }));
            }
            e.target.value = '';
            setSaved(false);
        }
    };

    const removeTag = (tagToRemove) => {
        setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
        setSaved(false);
    };

    // --- Experience Logic ---
    const handleAddExperience = () => {
        setForm(prev => ({
            ...prev,
            experience: [
                ...prev.experience,
                { title: '', company: '', date: '', description: '' }
            ]
        }));
        setSaved(false);
    };

    const handleExperienceChange = (index, field) => (e) => {
        const newExp = [...form.experience];
        newExp[index][field] = e.target.value;
        setForm(prev => ({ ...prev, experience: newExp }));
        setSaved(false);
    };

    const handleRemoveExperience = (index) => {
        const newExp = [...form.experience];
        newExp.splice(index, 1);
        setForm(prev => ({ ...prev, experience: newExp }));
        setSaved(false);
    };

    // --- Project Search Logic ---
    useEffect(() => {
        const searchProjects = async () => {
            if (!projectSearch.trim()) {
                setProjectResults([]);
                return;
            }
            setIsSearchingProjects(true);
            try {
                // Mock search for active projects
                const res = await projectsApi.list({ search: projectSearch, limit: 5 });
                setProjectResults(res.data || res || []);
                setShowProjectDropdown(true);
            } catch (error) {
                console.error("Failed to search projects", error);
            } finally {
                setIsSearchingProjects(false);
            }
        };

        const debounce = setTimeout(searchProjects, 300);
        return () => clearTimeout(debounce);
    }, [projectSearch]);

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
            setSaved(false);
        }
        setProjectSearch('');
        setNewProjectRole('');
        setShowProjectDropdown(false);
    };

    const handleRemoveProject = (projectId) => {
        setForm(prev => ({
            ...prev,
            biesProjects: prev.biesProjects.filter(p => p.id !== projectId)
        }));
        setSaved(false);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
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

                {/* Facebook Style Header Card (Editable) */}
                <div className="profile-card mb-8" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Cover Banner Editable */}
                    <div className="relative group" style={{
                        height: '240px',
                        background: form.banner ? `url(${form.banner}) center/cover no-repeat` : 'linear-gradient(to right, #0052cc, #0a192f)'
                    }}>
                        {/* Top-Left Edit Banner Button Inside Banner */}
                        <div className="absolute z-10" style={{ top: '24px', left: '24px' }}>
                            <label className="shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer" style={{ backgroundColor: 'white', color: '#1f2937', borderRadius: 'var(--radius-md)', height: '42px', padding: '0 24px', whiteSpace: 'nowrap', fontWeight: '700', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.02em' }}>
                                <Camera size={18} />
                                Edit Banner
                                <input type="file" accept="image/*" onChange={handleBannerUpload} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {/* Top-Right Save Buttons Inside Banner */}
                        <div className="absolute flex gap-4 z-10" style={{ bottom: '24px', right: '24px' }}>
                            <button onClick={handleSave} className="btn btn-primary shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2" disabled={saving} style={{ borderRadius: 'var(--radius-md)', height: '42px', padding: '0 24px', whiteSpace: 'nowrap', fontWeight: '700', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.02em' }}>
                                {saving ? <Loader2 size={16} className="spin" /> : <Save size={18} />}
                                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                            </button>
                        </div>
                    </div>

                    {/* Profile Info Section (Editable) */}
                    <div className="pb-8 relative">
                        {/* Avatar Editable */}
                        <div className="relative" style={{ marginTop: '-80px', zIndex: 10, width: 'fit-content' }}>
                            <div className="relative" style={{ width: '168px', height: '168px', borderRadius: '50%', overflow: 'hidden', border: '5px solid white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                                <img src={form.avatar || `https://ui-avatars.com/api/?name=${form.name}&background=random`} alt={form.name} className="bg-white" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>

                            <label className="absolute cursor-pointer transition-colors z-20 flex items-center justify-center hover:bg-gray-50 shadow-md" style={{ width: '40px', height: '40px', bottom: '4px', right: '4px', backgroundColor: 'white', borderRadius: '50%', border: '1px solid #e5e7eb' }}>
                                <Camera size={18} className="text-gray-700" />
                                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                            </label>
                        </div>

                        {/* Labeled Form Inputs Section */}
                        <div className="w-full max-w-2xl">
                            {/* Profile Status Toggles */}
                            <div className="form-row mb-8 items-center">
                                <label className="form-label">Profile Status</label>
                                <div className="form-content flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Public</span>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={form.isPublic} onChange={handleChange('isPublic')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-600">Show on BIES</span>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={form.showOnProfile} onChange={handleChange('showOnProfile')} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Name</label>
                                <div className="form-content">
                                    <input type="text" value={form.name} onChange={handleChange('name')} className="editable-title" placeholder="Your Name" />
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
                                    <div className="input-with-icon text-gray-900 w-full">
                                        <MapPin size={18} className="icon pointer-events-none" />
                                        <input type="text" value={form.location} onChange={handleChange('location')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="City, Country" />
                                    </div>
                                </div>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Tags</label>
                                <div className="form-content">
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Add tag (press Enter)"
                                            onKeyDown={handleTagKeyDown}
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            {form.tags.map((tag, idx) => (
                                                <span key={idx} className="status-badge flex items-center gap-2 py-1.5 px-3">
                                                    {tag}
                                                    <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={12} /></button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Sections Stack */}
                <div className="flex flex-col gap-8 mb-16">

                    {/* About Section */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title mb-8 border-b pb-4">About</h3>
                            <div className="form-row mb-0">
                                <label className="form-label">Bio</label>
                                <div className="form-content">
                                    <textarea
                                        rows="5"
                                        className="text-lg text-gray-600 leading-relaxed input-field resize-y min-h-[160px]"
                                        value={form.bio}
                                        onChange={handleChange('bio')}
                                        placeholder="Tell us about yourself..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Experience Manager */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="h3-title flex items-center gap-4">
                                    <Briefcase size={20} style={{ color: 'var(--color-gray-400)' }} />
                                    Experience
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-600">Show on profile</span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={form.showExperience} onChange={handleChange('showExperience')} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {form.showExperience && (
                            <div className="w-full max-w-2xl">
                                <div className="space-y-12">
                                    {form.experience.map((exp, idx) => (
                                        <div key={idx} className="experience-item relative pl-6 border-l-2 border-gray-100 pb-2">
                                            <div className="experience-dot"></div>
                                            <div className="flex flex-col gap-6 relative">
                                                <button onClick={() => handleRemoveExperience(idx)} className="absolute -top-1 right-0 text-gray-400 hover:text-red-500 p-1"><X size={16} /></button>

                                                <div className="form-row mb-0" style={{ gridTemplateColumns: '136px 1fr' }}>
                                                    <label className="form-label" style={{ width: '136px' }}>Role</label>
                                                    <div className="form-content">
                                                        <input type="text" value={exp.title} onChange={handleExperienceChange(idx, 'title')} placeholder="Job Title" className="input-field" />
                                                    </div>
                                                </div>
                                                <div className="form-row mb-0" style={{ gridTemplateColumns: '136px 1fr' }}>
                                                    <label className="form-label" style={{ width: '136px' }}>Company</label>
                                                    <div className="form-content">
                                                        <input type="text" value={exp.company} onChange={handleExperienceChange(idx, 'company')} placeholder="Company Name" className="input-field" />
                                                    </div>
                                                </div>
                                                <div className="form-row mb-0" style={{ gridTemplateColumns: '136px 1fr' }}>
                                                    <label className="form-label" style={{ width: '136px' }}>Date</label>
                                                    <div className="form-content">
                                                        <input type="text" value={exp.date} onChange={handleExperienceChange(idx, 'date')} placeholder="e.g. 2020 - Present" className="input-field" />
                                                    </div>
                                                </div>
                                                <div className="form-row mb-0" style={{ gridTemplateColumns: '136px 1fr' }}>
                                                    <label className="form-label" style={{ width: '136px' }}>Details</label>
                                                    <div className="form-content">
                                                        <textarea rows="3" value={exp.description} onChange={handleExperienceChange(idx, 'description')} placeholder="Describe your experience..." className="input-field resize-y" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="form-row-offset">
                                        <button onClick={handleAddExperience} type="button" className="btn btn-outline border-dashed w-full text-gray-500 flex justify-center gap-2 hover:bg-gray-50">
                                            <Plus size={18} /> Add Experience Detail
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Links Section */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title mb-8 border-b pb-4">Links</h3>
                            <div className="w-full">
                                <div className="form-row">
                                    <label className="form-label">Website</label>
                                    <div className="form-content">
                                        <div className="input-with-icon w-full text-gray-900">
                                            <Globe size={18} className="icon pointer-events-none" />
                                            <input type="url" value={form.website} onChange={handleChange('website')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="https://" />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <label className="form-label">X (Twitter)</label>
                                    <div className="form-content">
                                        <div className="input-with-icon w-full text-gray-900">
                                            <div className="icon pointer-events-none flex items-center">
                                                <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                                            </div>
                                            <input type="text" value={form.twitter} onChange={handleChange('twitter')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="X (Twitter) handle" />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <label className="form-label">LinkedIn</label>
                                    <div className="form-content">
                                        <div className="input-with-icon w-full text-gray-900">
                                            <Linkedin size={18} className="icon pointer-events-none" />
                                            <input type="text" value={form.linkedin} onChange={handleChange('linkedin')} className="input-field w-full" style={{ paddingLeft: '40px' }} placeholder="LinkedIn Profile" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nostr Profile Card */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <h3 className="h3-title flex items-center gap-2 mb-6 border-b pb-4">
                                <NostrIcon size={20} className="text-purple-500" />
                                Nostr Profile
                            </h3>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">Edit your Nostr identity. Changes are published to relays.</p>

                            {user?.nostrPubkey && (
                                <div className="form-row">
                                    <label className="form-label">Public Key (npub)</label>
                                    <div className="form-content">
                                        <input
                                            type="text"
                                            readOnly
                                            value={nip19.npubEncode(user.nostrPubkey)}
                                            className="input-field font-mono text-sm w-full"
                                            style={{ cursor: 'default', background: '#f9fafb' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {loadingNostr ? (
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} />
                                    <p className="text-sm text-gray-400" style={{ marginTop: '0.5rem' }}>Fetching from relays...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="form-row">
                                        <label className="form-label">Nostr Name</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.name} onChange={handleNostrFormChange('name')} className="input-field w-full" placeholder="Name on Nostr" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">About</label>
                                        <div className="form-content">
                                            <textarea rows="3" className="input-field w-full" value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr"></textarea>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Picture URL</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} className="input-field w-full" placeholder="https://..." />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Website</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.website} onChange={handleNostrFormChange('website')} className="input-field w-full" placeholder="https://..." />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">NIP-05</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} className="input-field w-full" placeholder="you@domain.com" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">LUD-16</label>
                                        <div className="form-content">
                                            <input type="text" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} className="input-field w-full" placeholder="you@wallet.com" />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <label className="form-label">Banner URL</label>
                                        <div className="form-content">
                                            <input type="url" value={nostrForm.banner} onChange={handleNostrFormChange('banner')} className="input-field w-full mb-6" placeholder="https://..." />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex gap-4 mt-8">
                                <button type="button" onClick={handleSaveToNostr} disabled={savingNostr} className="btn btn-primary flex-1 flex items-center justify-center gap-2" style={{ background: '#7c3aed', padding: '0.625rem 1rem' }}>
                                    {savingNostr ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                                    {savingNostr ? 'Publishing...' : nostrSaved ? 'Published!' : 'Save to Nostr'}
                                    {nostrSaved && <CheckCircle size={16} />}
                                </button>
                                <button type="button" onClick={fetchNostrProfile} className="btn btn-outline flexitems-center justify-center gap-2 text-purple-600 border-purple-200 hover:border-purple-500 hover:bg-purple-50" style={{ flex: '0.5' }}>
                                    <RefreshCw size={16} /> Refresh
                                </button>
                                <button type="button" onClick={handleSyncFromNostr} className="btn btn-outline flex items-center justify-center gap-2" style={{ flex: '0.5', color: '#2563eb', borderColor: '#bfdbfe' }}>
                                    Sync to BIES
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Nostr Identity & Feed Toggle */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <div className="flex justify-between items-center mb-8 border-b pb-4">
                                <h3 className="h3-title flex items-center gap-2">
                                    <NostrIcon size={20} className="text-purple-500" />
                                    Nostr Identity & Feed
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-gray-600">Show feed</span>
                                    <label className="toggle-switch">
                                        <input type="checkbox" checked={form.showNostrFeed} onChange={handleChange('showNostrFeed')} />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>
                            <div className="form-row-offset mb-8">
                                <p className="text-sm text-gray-600 leading-relaxed">Connect your Nostr NPUB to display your notes directly on your profile.</p>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Nostr npub</label>
                                <div className="form-content">
                                    <input type="text" placeholder="1..." value={form.nostrNpub ? form.nostrNpub.replace(/^npub/, '') : ''} onChange={(e) => handleChange('nostrNpub')({ target: { value: 'npub' + e.target.value } })} className="input-field w-full font-mono text-sm bg-gray-50/50 hover:bg-gray-100/50 focus:bg-white" />
                                </div>
                            </div>

                            {form.showNostrFeed && form.nostrNpub && (
                                <div className="mt-8 border-t pt-8 opacity-60 pointer-events-none w-full">
                                    <div className="form-row-offset">
                                        <p className="text-sm text-gray-500 font-medium mb-4">Feed Preview:</p>
                                        <NostrFeed npub={form.nostrNpub} notes={[]} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Working On / Projects Section */}
                    <div className="profile-card">
                        <div className="w-full max-w-2xl">
                            <div className="flex justify-between items-center mb-8 border-b pb-4">
                                <h3 className="h3-title">{projectsTitle}</h3>
                            </div>

                            <div className="form-row">
                                <label className="form-label">Add Project</label>
                                <div className="form-content space-y-5">
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            placeholder="Your Role / Contribution"
                                            className="input-field"
                                            value={newProjectRole}
                                            onChange={(e) => setNewProjectRole(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="flex items-center border border-gray-200 bg-white rounded-lg focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all overflow-hidden">
                                            <div className="pl-4 text-gray-400">
                                                <Search size={18} />
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full py-2.5 px-3 border-none outline-none text-sm font-medium"
                                                placeholder="Search projects to add..."
                                                value={projectSearch}
                                                onChange={(e) => {
                                                    setProjectSearch(e.target.value);
                                                    setShowProjectDropdown(true);
                                                }}
                                                onFocus={() => setShowProjectDropdown(true)}
                                            />
                                            {projectSearch && (
                                                <button onClick={() => setProjectSearch('')} className="pr-4 text-gray-400 hover:text-gray-600">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {showProjectDropdown && projectSearch.length > 0 && (
                                            <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-2">
                                                {PROJECTS_DATABASE.filter(p =>
                                                    p.name.toLowerCase().includes(projectSearch.toLowerCase()) &&
                                                    !form.biesProjects.some(bp => bp.id === p.id)
                                                ).map(project => (
                                                    <button
                                                        key={project.id}
                                                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                                                        onClick={() => handleAddProject(project)}
                                                    >
                                                        <img src={project.image} alt="" className="w-8 h-8 rounded shadow-sm object-cover" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{project.name}</p>
                                                            <p className="text-xs text-gray-500">{project.status}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                                {PROJECTS_DATABASE.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                                                    <div className="px-4 py-6 text-center text-gray-500 text-sm italic">
                                                        No projects found matching "{projectSearch}"
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List of current projects - keep this as a grid below the standardized row */}
                        <div className="form-row-offset mt-8 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {form.biesProjects.map(project => (
                                    <div key={project.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 transition-all hover:shadow-md group">
                                        <div className="flex items-center gap-3">
                                            <img src={project.image} alt="" className="w-12 h-12 rounded-lg shadow-sm object-cover" />
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{project.name}</p>
                                                <p className="text-xs font-semibold text-primary/80">{project.role}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveProject(project.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <style jsx>{`
        .profile-page {
             background-color: #f8fafc;
             min-height: 100vh;
        }

        .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

        /* Profile Grid Layout */
        .profile-grid {
             display: grid;
             grid-template-columns: 1fr;
             gap: 2.5rem;
        }

        @media(min-width: 768px) {
             .profile-grid {
                  grid-template-columns: 2fr 1fr;
                  gap: 3rem;
             }
        }

        .profile-card {
             background: white;
             padding: 2rem;
             border-radius: var(--radius-xl);
             box-shadow: var(--shadow-sm);
             border: 1px solid var(--color-gray-200);
        }

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

        .form-content {
            min-width: 0;
        }

        .form-help-text {
            margin-left: 0;
            padding-top: 0.5rem;
            font-size: 0.875rem;
            color: var(--color-gray-600);
        }
        
        /* Adjusted specifically for rows without labels to maintain alignment */
        .form-row-offset {
            margin-left: calc(160px + 2rem);
        }

        /* Editable Title */
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
        .editable-title:hover, .editable-title:focus {
             background: white;
             border-color: var(--color-gray-300);
             outline: none;
        }
        .editable-title:focus {
             border-color: var(--color-primary);
             box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1);
        }

        .form-input-inline {
             border: 1px solid var(--color-gray-200);
             background: var(--color-gray-50);
             padding-left: 12px;
             padding-right: 12px;
             border-radius: var(--radius-md);
             transition: all 0.2s;
        }
        .form-input-inline:hover {
             background: rgba(0,0,0,0.02);
        }
        .form-input-inline:focus {
             background: white;
             border-color: var(--color-primary);
             padding-left: 12px;
             outline: none;
             box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1);
        }

        /* Text Utilities */
        .h1-title { font-size: 2rem; line-height: 2.25rem; font-weight: 700; font-family: var(--font-display); }
        .h3-title { font-size: 1.25rem; font-weight: 700; font-family: var(--font-display); }

        /* Inputs */
        .input-field { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-300); background: white; border-radius: var(--radius-md); outline: none; transition: all 0.2s; }
        .input-field:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1); }

        .input-with-icon { position: relative; }
        .input-with-icon .icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--color-gray-400); }

        /* Utilities */
        .status-badge { background: #dcfce7; color: #15803d; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; }
        .experience-item { padding-left: 1.5rem; border-left: 2px solid var(--color-gray-200); position: relative; padding-bottom: 0.5rem; }
        /* Toggle Switch */
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
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
        .toggle-switch input:checked + .toggle-slider {
            background-color: var(--color-primary);
        }
        .toggle-switch input:focus + .toggle-slider {
            box-shadow: 0 0 1px var(--color-primary);
        }
        .toggle-switch input:checked + .toggle-slider:before {
            transform: translateX(20px);
        }
    `}</style>
        </div>
    );
};

export default Profile;
