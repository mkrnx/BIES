import React, { useState, useEffect } from 'react';
import { User, Shield, Camera, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { profilesApi, uploadApi } from '../services/api';

const Profile = () => {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
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
        <div className="container py-8 max-w-3xl">
            <h1>User Profile</h1>
            <p className="text-gray-500 mb-8">Manage your personal information and preferences.</p>

            <form onSubmit={handleSave}>
                <div className="card-section">
                    <div className="profile-header">
                        <div className="avatar-upload-wrapper">
                            <div className="avatar-large">
                                {form.avatar ? (
                                    <img src={form.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                    (form.name || 'U').substring(0, 2).toUpperCase()
                                )}
                            </div>
                            <label className="avatar-upload-btn">
                                <Camera size={14} />
                                <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                            </label>
                        </div>
                        <div>
                            <h2>{form.name || 'Your Name'}</h2>
                            <span className="badge-role">{user?.role || 'Member'}</span>
                            {user?.nostrPubkey && (
                                <p className="text-sm text-gray-400" style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                                    {user.nostrPubkey.substring(0, 16)}...
                                </p>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: '#FEF2F2', color: '#EF4444', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {error}
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group">
                            <label>Display Name</label>
                            <input type="text" value={form.name} onChange={handleChange('name')} className="input-field" placeholder="Your name" />
                        </div>
                        <div className="form-group">
                            <label>Company</label>
                            <input type="text" value={form.company} onChange={handleChange('company')} className="input-field" placeholder="Your company" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Title / Role</label>
                            <input type="text" value={form.title} onChange={handleChange('title')} className="input-field" placeholder="e.g. CEO, Developer" />
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <input type="text" value={form.location} onChange={handleChange('location')} className="input-field" placeholder="City, Country" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Bio</label>
                        <textarea rows="4" value={form.bio} onChange={handleChange('bio')} className="input-field" placeholder="Tell us about yourself..." />
                    </div>

                    <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Social Links</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Website</label>
                            <input type="url" value={form.website} onChange={handleChange('website')} className="input-field" placeholder="https://" />
                        </div>
                        <div className="form-group">
                            <label>Twitter / X</label>
                            <input type="text" value={form.twitter} onChange={handleChange('twitter')} className="input-field" placeholder="@username" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>LinkedIn</label>
                            <input type="text" value={form.linkedin} onChange={handleChange('linkedin')} className="input-field" placeholder="LinkedIn URL" />
                        </div>
                        <div className="form-group">
                            <label>GitHub</label>
                            <input type="text" value={form.github} onChange={handleChange('github')} className="input-field" placeholder="GitHub username" />
                        </div>
                    </div>

                    <div className="mt-4 flex gap-4">
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                            {saved && <CheckCircle size={16} style={{ marginLeft: 6 }} />}
                        </button>
                    </div>
                </div>
            </form>

            <div className="card-section mt-8">
                <h3>Verification Status</h3>
                <div className="verification-box">
                    <Shield size={24} className="text-success" />
                    <div>
                        <p className="font-bold">
                            {user?.nostrPubkey ? 'Nostr Identity Linked' : 'Pending Verification'}
                        </p>
                        <p className="text-sm text-gray-500">
                            {user?.nostrPubkey
                                ? 'Your Nostr key is linked to your BIES account.'
                                : 'Connect a Nostr extension to verify your identity.'}
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .max-w-3xl { max-width: 48rem; }
                .card-section { background: white; padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--color-gray-200); }

                .profile-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
                .avatar-large { width: 80px; height: 80px; background: var(--color-primary); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700; overflow: hidden; }
                .avatar-upload-wrapper { position: relative; }
                .avatar-upload-btn { position: absolute; bottom: 0; right: 0; width: 28px; height: 28px; background: white; border: 2px solid var(--color-gray-200); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
                .avatar-upload-btn:hover { background: var(--color-gray-100); }

                .badge-role { background: var(--color-secondary); color: white; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; text-transform: uppercase; font-weight: 600; margin-top: 4px; display: inline-block; }

                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .form-group { margin-bottom: 1.5rem; }
                .form-group label { display: block; font-weight: 500; margin-bottom: 0.5rem; color: var(--color-gray-700); }
                .input-field { width: 100%; padding: 0.75rem; border: 1px solid var(--color-gray-300); border-radius: var(--radius-md); font-size: 1rem; outline: none; transition: border-color 0.2s; font-family: inherit; }
                .input-field:focus { border-color: var(--color-primary); }

                .verification-box { background: #F0FDF4; border: 1px solid #BBF7D0; padding: 1rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
                .text-success { color: var(--color-success); }
                .font-bold { font-weight: 700; }
                .gap-4 { gap: 1rem; }

                @media (max-width: 640px) {
                    .form-row { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Profile;
