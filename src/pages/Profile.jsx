import React, { useState, useEffect } from 'react';
import { User, Mail, Globe, MapPin, Shield, Twitter, Linkedin, Briefcase, Plus, Hash, Camera, Loader2, CheckCircle, RefreshCw, Zap, Send } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi } from '../services/api';
import { nostrService } from '../services/nostrService';

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
        github: '',
        company: '',
        title: '',
        avatar: '',
    });

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
            // Refresh to show updated data
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
                name: profile.name || '',
                bio: profile.bio || '',
                location: profile.location || '',
                website: profile.website || '',
                twitter: profile.twitter || '',
                linkedin: profile.linkedin || '',
                github: profile.github || '',
                company: profile.company || '',
                title: profile.title || '',
                avatar: profile.avatar || '',
            });
        } catch (err) {
            setError('Failed to load profile.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field) => (e) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
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

    const handleSave = async (e) => {
        e.preventDefault();
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

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <div className="profile-page">

            <form onSubmit={handleSave} className="container py-8 max-w-6xl">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="h1-title mb-1">Edit Profile</h1>
                        <p className="text-gray-500">Manage your builder profile visibility and information.</p>
                    </div>
                    <div className="flex gap-4">
                        <button type="button" className="btn btn-outline bg-white shadow-sm hover:border-primary">Cancel</button>
                        <button type="submit" className="btn btn-primary shadow-sm" disabled={saving}>
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                            {saved && <CheckCircle size={16} style={{ marginLeft: 6 }} />}
                        </button>
                    </div>
                </div>

                {error && (
                    <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div className="profile-grid">

                    {/* Left Column - Main Content Edit Forms */}
                    <div className="profile-main space-y-6">

                        {/* Basic Info Card */}
                        <div className="profile-card relative">
                            <h3 className="h3-title mb-6 border-b pb-4">Basic Information</h3>

                            <div className="flex items-center gap-6 mb-8">
                                <div className="avatar-wrapper relative overflow-visible">
                                    <div className="avatar-large" style={{ overflow: 'hidden' }}>
                                        {form.avatar ? (
                                            <img src={form.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            (form.name || 'U').substring(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    <label className="avatar-edit-btn absolute bottom-0 right-0 bg-white border border-gray-200 rounded-full p-2 shadow-sm hover:text-primary transition-colors cursor-pointer">
                                        <Camera size={16} />
                                        <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                                    </label>
                                </div>
                                <div>
                                    <span className="badge-role mb-2">{user?.role || 'Builder'}</span>
                                    <p className="text-sm text-gray-500">JPG, GIF or PNG. 1MB max.</p>
                                    {user?.nostrPubkey && (
                                        <p className="text-sm text-gray-400 mt-1 font-mono text-xs">
                                            {user.nostrPubkey.substring(0, 16)}...
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid-2-cols gap-4 mb-4">
                                <div className="form-group">
                                    <label>BIES Display Name</label>
                                    <input type="text" value={form.name} onChange={handleChange('name')} className="input-field" placeholder="Your name on BIES" />
                                </div>
                                <div className="form-group">
                                    <label>Company</label>
                                    <input type="text" value={form.company} onChange={handleChange('company')} className="input-field" placeholder="Your company" />
                                </div>
                            </div>

                            <div className="form-group mb-4">
                                <label>Current Role / Title</label>
                                <input type="text" value={form.title} onChange={handleChange('title')} className="input-field" placeholder="e.g. CEO, Developer" />
                            </div>

                            <div className="form-group mb-4">
                                <label>Location</label>
                                <div className="input-with-icon">
                                    <MapPin size={18} className="icon" />
                                    <input type="text" value={form.location} onChange={handleChange('location')} className="input-field pl-10" placeholder="City, Country" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Bio / About</label>
                                <textarea rows="4" className="input-field" value={form.bio} onChange={handleChange('bio')} placeholder="Tell us about yourself..."></textarea>
                            </div>
                        </div>

                        {/* Experience Manager */}
                        <div className="profile-card">
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="h3-title flex items-center gap-2">
                                    <Briefcase size={20} className="text-gray-400" />
                                    Experience
                                </h3>
                                <button type="button" className="text-primary text-sm font-semibold flex items-center gap-1 hover:underline">
                                    <Plus size={16} /> Add Experience
                                </button>
                            </div>

                            <div className="space-y-6">
                                {/* Mock Editable Experience Item */}
                                <div className="experience-item p-4 border border-gray-100 rounded-lg bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer">
                                    <h4 className="font-semibold text-lg text-gray-900">Lead Engineer</h4>
                                    <p className="text-primary font-medium mb-1">Volcano Energy</p>
                                    <p className="text-sm text-gray-500">2023 - Present</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column - Side Panels */}
                    <div className="profile-sidebar space-y-6">

                        {/* Verification Status */}
                        <div className="profile-card">
                            <h3 className="h3-title mb-4">Verification</h3>
                            <div className="verification-box">
                                <Shield size={24} className="text-success" />
                                <div>
                                    <p className="font-bold text-gray-900">
                                        {user?.nostrPubkey ? 'Identity Verified' : 'Pending Verification'}
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">
                                        {user?.nostrPubkey
                                            ? 'Your account is fully verified for network actions.'
                                            : 'Connect a Nostr extension to verify your identity.'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Nostr Profile Card */}
                        <div className="profile-card">
                            <h3 className="h3-title flex items-center gap-2 mb-4">
                                <Zap size={20} className="text-purple-500" />
                                Nostr Profile
                            </h3>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">Edit your Nostr identity. Changes are published to relays.</p>

                            {user?.nostrPubkey && (
                                <div className="form-group mb-3">
                                    <label>Public Key (npub)</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={nip19.npubEncode(user.nostrPubkey)}
                                        className="input-field font-mono text-sm"
                                        style={{ cursor: 'default', background: '#f9fafb' }}
                                    />
                                </div>
                            )}

                            {loadingNostr ? (
                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                    <Loader2 size={20} className="spin" style={{ animation: 'spin 1s linear infinite', margin: '0 auto', display: 'block' }} />
                                    <p className="text-sm text-gray-400" style={{ marginTop: '0.5rem' }}>Fetching from relays...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="form-group mb-3">
                                        <label>Nostr Display Name</label>
                                        <input type="text" value={nostrForm.name} onChange={handleNostrFormChange('name')} className="input-field" placeholder="Name on Nostr" />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>About</label>
                                        <textarea rows="3" className="input-field" value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr"></textarea>
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>Picture URL</label>
                                        <input type="url" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} className="input-field text-sm" placeholder="https://..." />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>Website</label>
                                        <input type="url" value={nostrForm.website} onChange={handleNostrFormChange('website')} className="input-field text-sm" placeholder="https://..." />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>NIP-05</label>
                                        <input type="text" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} className="input-field text-sm" placeholder="you@domain.com" />
                                    </div>
                                    <div className="form-group mb-3">
                                        <label>Lightning Address (LUD-16)</label>
                                        <input type="text" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} className="input-field text-sm" placeholder="you@wallet.com" />
                                    </div>
                                    <div className="form-group mb-4">
                                        <label>Banner URL</label>
                                        <input type="url" value={nostrForm.banner} onChange={handleNostrFormChange('banner')} className="input-field text-sm" placeholder="https://..." />
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                                <button
                                    type="button"
                                    onClick={handleSaveToNostr}
                                    disabled={savingNostr}
                                    className="btn btn-primary"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', background: '#7c3aed', borderRadius: 'var(--radius-md)', padding: '0.625rem 1rem' }}
                                >
                                    {savingNostr ? <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                                    {savingNostr ? 'Publishing...' : nostrSaved ? 'Published!' : 'Save to Nostr'}
                                    {nostrSaved && <CheckCircle size={14} />}
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button"
                                        onClick={fetchNostrProfile}
                                        className="btn btn-outline text-purple-600 border-purple-200 hover:border-purple-500 hover:bg-purple-50"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}
                                    >
                                        <RefreshCw size={14} /> Refresh
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSyncFromNostr}
                                        className="btn btn-outline"
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', color: '#2563eb', borderColor: '#bfdbfe' }}
                                    >
                                        Sync to BIES
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Links/Socials Form */}
                        <div className="profile-card">
                            <h3 className="h3-title mb-4">Social Links</h3>

                            <div className="form-group mb-3">
                                <div className="input-with-icon">
                                    <Globe size={18} className="icon" />
                                    <input type="url" value={form.website} onChange={handleChange('website')} placeholder="Personal Website" className="input-field pl-10" />
                                </div>
                            </div>
                            <div className="form-group mb-3">
                                <div className="input-with-icon">
                                    <Twitter size={18} className="icon" />
                                    <input type="text" value={form.twitter} onChange={handleChange('twitter')} placeholder="Twitter Profile" className="input-field pl-10" />
                                </div>
                            </div>
                            <div className="form-group mb-3">
                                <div className="input-with-icon">
                                    <Linkedin size={18} className="icon" />
                                    <input type="url" value={form.linkedin} onChange={handleChange('linkedin')} placeholder="LinkedIn Profile" className="input-field pl-10" />
                                </div>
                            </div>
                            <div className="form-group">
                                <div className="input-with-icon">
                                    <Globe size={18} className="icon" />
                                    <input type="text" value={form.github} onChange={handleChange('github')} placeholder="GitHub Username" className="input-field pl-10" />
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </form>

            <style jsx>{`
                .profile-page {
                    min-height: 100vh;
                    background: var(--color-gray-50);
                    padding-bottom: 4rem;
                }
                
                .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
                
                /* Profile Grid Layout */
                .profile-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 2rem;
                }
                
                @media(min-width: 768px) {
                    .profile-grid {
                        grid-template-columns: 2fr 1fr;
                    }
                    .grid-2-cols {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                    }
                }

                .profile-card {
                    background: white;
                    padding: 2rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-sm);
                    border: 1px solid var(--color-gray-200);
                }

                .avatar-large { 
                    width: 100px; 
                    height: 100px; 
                    background: var(--color-primary); 
                    color: white; 
                    border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 2.25rem; font-weight: 700; font-family: var(--font-display); 
                    border: 4px solid white;
                    box-shadow: var(--shadow-sm);
                }
                .badge-role { background: var(--color-gray-100); color: var(--color-gray-800); padding: 4px 12px; border-radius: 99px; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; display: inline-block; border: 1px solid var(--color-gray-200); }

                /* Text Utilities */
                .h1-title { font-size: 2rem; line-height: 2.25rem; font-weight: 700; font-family: var(--font-display); }
                .h3-title { font-size: 1.25rem; font-weight: 700; font-family: var(--font-display); }
                .text-gray-400 { color: var(--color-gray-400); }
                .text-gray-500 { color: var(--color-gray-500); }
                .text-gray-600 { color: var(--color-gray-600); }
                .text-gray-900 { color: var(--color-gray-900); }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .font-semibold { font-weight: 600; font-family: var(--font-display); }
                .font-medium { font-weight: 500; }
                .font-bold { font-weight: 700; font-family: var(--font-display); }
                .leading-relaxed { line-height: 1.625; }

                /* Forms */
                .form-group label { display: block; font-weight: 500; font-size: 0.875rem; margin-bottom: 0.5rem; color: var(--color-gray-700); }
                .input-field { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--color-gray-300); background: var(--color-gray-50); border-radius: var(--radius-md); font-size: 0.95rem; outline: none; transition: all 0.2s; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); }
                .input-field:focus { border-color: var(--color-primary); background: white; box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1); }
                
                .input-with-icon { position: relative; }
                .input-with-icon .icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--color-gray-400); }
                .pl-10 { padding-left: 2.75rem !important; }
                .font-mono { font-family: monospace; }
                
                /* Verification Box */
                .verification-box { background: #F0FDF4; border: 1px solid #BBF7D0; padding: 1.25rem; border-radius: var(--radius-md); display: flex; align-items: flex-start; gap: 1rem; }
                .text-success { color: #15803d; }
                .text-green-700 { color: #15803d; }

                /* Spacing */
                .space-y-6 > * + * { margin-top: 1.5rem; }
                .space-y-3 > * + * { margin-top: 0.75rem; }
                .mb-8 { margin-bottom: 2rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mb-4 { margin-bottom: 1rem; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .border-b { border-bottom: 1px solid var(--color-gray-200); }
                .pb-4 { padding-bottom: 1rem; }
                .p-4 { padding: 1rem; }
                .p-2 { padding: 0.5rem; }
                
                .w-full { width: 100%; }

                /* Colors */
                .text-purple-500 { color: #8b5cf6; }
                .text-purple-600 { color: #7c3aed; }
                .border-purple-200 { border-color: #e9d5ff; }
                .hover\\:border-purple-500:hover { border-color: #8b5cf6; }
                .hover\\:bg-purple-50:hover { background-color: #faf5ff; }
            `}</style>
        </div>
    );
};

export default Profile;
