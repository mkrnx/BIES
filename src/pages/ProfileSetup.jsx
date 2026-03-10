import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { nostrService } from '../services/nostrService';
import { nip19 } from 'nostr-tools';
import { profilesApi } from '../services/api';
import { ArrowRight, Loader2, AlertCircle, ChevronDown, ChevronUp, Send } from 'lucide-react';
import NostrIcon from '../components/NostrIcon';

const ProfileSetup = () => {
    const { user, updateRole, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [nostrProfile, setNostrProfile] = useState(null);
    const [loadingNostr, setLoadingNostr] = useState(true);
    const [biesName, setBiesName] = useState('');
    const [role, setRole] = useState('BUILDER');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showNostrEdit, setShowNostrEdit] = useState(false);
    const [nostrForm, setNostrForm] = useState({ name: '', about: '', picture: '', website: '', nip05: '', lud16: '' });

    useEffect(() => {
        // Redirect if user doesn't need setup (returning user)
        if (user?.profile?.name && !user.profile.name.startsWith('nostr:')) {
            navigate('/feed', { replace: true });
            return;
        }

        // Fetch Nostr kind:0 profile from public relays
        if (user?.nostrPubkey) {
            nostrService.getProfile(user.nostrPubkey).then((profile) => {
                setNostrProfile(profile);
                if (profile?.name) {
                    setBiesName(profile.name);
                }
                if (profile) {
                    setNostrForm({
                        name: profile.name || '',
                        about: profile.about || '',
                        picture: profile.picture || '',
                        website: profile.website || '',
                        nip05: profile.nip05 || '',
                        lud16: profile.lud16 || '',
                    });
                }
            }).finally(() => setLoadingNostr(false));
        } else {
            setLoadingNostr(false);
        }
    }, [user, navigate]);

    const handleNostrFormChange = (field) => (e) => {
        setNostrForm(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!biesName.trim() || submitting) return;

        setSubmitting(true);
        setError('');

        try {
            // Save BIES profile
            const updateData = { name: biesName.trim() };
            if (user?.nostrPubkey) updateData.nostrNpub = nip19.npubEncode(user.nostrPubkey);
            if (nostrForm.picture || nostrProfile?.picture) updateData.avatar = nostrForm.picture || nostrProfile?.picture;
            if (nostrProfile?.banner) updateData.banner = nostrProfile.banner;
            if (nostrForm.about || nostrProfile?.about) updateData.bio = nostrForm.about || nostrProfile?.about;
            if (nostrForm.website || nostrProfile?.website) updateData.website = nostrForm.website || nostrProfile?.website;

            await profilesApi.update(updateData);
            await updateRole(role);

            // Publish Nostr profile if user edited it
            if (showNostrEdit && nostrForm.name) {
                try {
                    const data = {};
                    if (nostrForm.name) data.name = nostrForm.name;
                    if (nostrForm.about) data.about = nostrForm.about;
                    if (nostrForm.picture) data.picture = nostrForm.picture;
                    if (nostrForm.website) data.website = nostrForm.website;
                    if (nostrForm.nip05) data.nip05 = nostrForm.nip05;
                    if (nostrForm.lud16) data.lud16 = nostrForm.lud16;
                    await nostrService.updateProfile(data);
                } catch (nostrErr) {
                    console.error('Nostr publish failed (non-blocking):', nostrErr);
                }
            }

            // Announce new user on the BIES private relay feed
            try {
                await nostrService.publishToBiesRelay({
                    kind: 1,
                    created_at: Math.floor(Date.now() / 1000),
                    tags: [['t', 'bies'], ['t', 'new-user']],
                    content: `${biesName.trim()} just joined BIES! Welcome to the Bitcoin Investment Ecosystem of El Salvador.`,
                });
            } catch (announceErr) {
                console.error('New user announcement failed (non-blocking):', announceErr);
            }

            await refreshUser();
            navigate('/feed');
        } catch (err) {
            setError(err.message || 'Failed to save profile.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="setup-container">
            <div className="setup-card">
                <div className="text-center mb-6">
                    <NostrIcon size={32} className="mx-auto mb-3" color="#8b5cf6" />
                    <h2 className="text-2xl font-bold mb-2">Welcome to BIES</h2>
                    <p className="text-gray-500 text-sm">
                        Set up your BIES profile to get started.
                    </p>
                </div>

                {/* Nostr Profile Preview */}
                {loadingNostr ? (
                    <div className="nostr-preview loading">
                        <Loader2 size={20} className="spin" />
                        <span className="text-sm text-gray-400">Fetching your Nostr profile...</span>
                    </div>
                ) : nostrProfile ? (
                    <div className="nostr-preview">
                        <div className="nostr-header">
                            {nostrProfile.picture && (
                                <img src={nostrProfile.picture} alt="" className="nostr-avatar" />
                            )}
                            <div>
                                <p className="font-bold text-gray-900">{nostrProfile.name || 'Unnamed'}</p>
                                {nostrProfile.nip05 && (
                                    <p className="text-xs text-gray-400">{nostrProfile.nip05}</p>
                                )}
                            </div>
                        </div>
                        {nostrProfile.about && (
                            <p className="text-sm text-gray-600 mt-3 nostr-about">
                                {nostrProfile.about.length > 150
                                    ? nostrProfile.about.substring(0, 150) + '...'
                                    : nostrProfile.about}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">Nostr profile from public relays</p>
                    </div>
                ) : (
                    <div className="nostr-preview empty">
                        <p className="text-sm text-gray-400">No Nostr profile found on public relays.</p>
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="w-full">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            BIES Display Name
                        </label>
                        <input
                            type="text"
                            required
                            className="w-full p-3 border rounded-lg input-field"
                            placeholder="Your name on BIES"
                            value={biesName}
                            onChange={e => setBiesName(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            This name is shown on BIES only and won't change your Nostr profile.
                        </p>
                    </div>

                    {/* Nostr Profile Editing (collapsible) */}
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={() => setShowNostrEdit(!showNostrEdit)}
                            className="nostr-edit-toggle"
                        >
                            <NostrIcon size={16} style={{ color: '#8b5cf6' }} />
                            <span>{showNostrEdit ? 'Hide' : 'Edit'} Nostr Profile</span>
                            {showNostrEdit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showNostrEdit && (
                            <div className="nostr-edit-section">
                                <p className="text-xs text-gray-400 mb-3">These changes will be published to Nostr relays when you submit.</p>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nostr Name</label>
                                    <input type="text" className="input-field text-sm" value={nostrForm.name} onChange={handleNostrFormChange('name')} placeholder="Name on Nostr" />
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">About</label>
                                    <textarea rows="2" className="input-field text-sm" value={nostrForm.about} onChange={handleNostrFormChange('about')} placeholder="Bio on Nostr"></textarea>
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Picture URL</label>
                                    <input type="url" className="input-field text-sm" value={nostrForm.picture} onChange={handleNostrFormChange('picture')} placeholder="https://..." />
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                                    <input type="url" className="input-field text-sm" value={nostrForm.website} onChange={handleNostrFormChange('website')} placeholder="https://..." />
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">NIP-05</label>
                                    <input type="text" className="input-field text-sm" value={nostrForm.nip05} onChange={handleNostrFormChange('nip05')} placeholder="you@domain.com" />
                                </div>
                                <div className="mb-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Lightning Address</label>
                                    <input type="text" className="input-field text-sm" value={nostrForm.lud16} onChange={handleNostrFormChange('lud16')} placeholder="you@wallet.com" />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
                        <div className="role-grid">
                            <div
                                className={`role-card ${role === 'BUILDER' ? 'active' : ''}`}
                                onClick={() => setRole('BUILDER')}
                            >
                                <div className="font-bold">Builder</div>
                                <div className="text-xs text-gray-500">Building in El Salvador</div>
                            </div>
                            <div
                                className={`role-card ${role === 'INVESTOR' ? 'active' : ''}`}
                                onClick={() => setRole('INVESTOR')}
                            >
                                <div className="font-bold">Investor</div>
                                <div className="text-xs text-gray-500">Looking for opportunities</div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !biesName.trim()}
                        className="btn-primary w-full py-3 rounded-full flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <Loader2 size={18} className="spin" />
                        ) : (
                            <>Enter BIES <ArrowRight size={18} /></>
                        )}
                    </button>
                </form>
            </div>

            <style jsx>{`
                .setup-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                }
                .setup-card {
                    background: white;
                    padding: 3rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    width: 100%;
                    max-width: 500px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .mx-auto { margin-left: auto; margin-right: auto; display: block; }
                .text-center { text-align: center; }
                .text-yellow-400 { color: #facc15; }
                .fill-yellow-400 { fill: #facc15; }
                .text-gray-400 { color: #9ca3af; }
                .text-gray-500 { color: #6b7280; }
                .text-gray-600 { color: #4b5563; }
                .text-gray-700 { color: #374151; }
                .text-gray-900 { color: #111827; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .text-2xl { font-size: 1.5rem; line-height: 2rem; }
                .font-bold { font-weight: 700; font-family: var(--font-display); }
                .font-medium { font-weight: 500; }
                .mb-1 { margin-bottom: 0.25rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mb-4 { margin-bottom: 1rem; }
                .mb-6 { margin-bottom: 1.5rem; }
                .mt-1 { margin-top: 0.25rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-3 { margin-top: 0.75rem; }
                .w-full { width: 100%; }
                .block { display: block; }

                .nostr-preview {
                    width: 100%;
                    padding: 1.25rem;
                    border-radius: var(--radius-lg);
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    margin-bottom: 1.5rem;
                }
                .nostr-preview.loading {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    justify-content: center;
                    padding: 1.5rem;
                }
                .nostr-preview.empty {
                    text-align: center;
                    padding: 1.5rem;
                }
                .nostr-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .nostr-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    object-fit: cover;
                    border: 2px solid white;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .nostr-about {
                    line-height: 1.5;
                }

                .nostr-edit-toggle {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1rem;
                    border: 1px solid #e9d5ff;
                    border-radius: var(--radius-md);
                    background: #faf5ff;
                    color: #7c3aed;
                    font-size: 0.875rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .nostr-edit-toggle:hover {
                    border-color: #8b5cf6;
                    background: #f3e8ff;
                }
                .nostr-edit-toggle span { flex: 1; text-align: left; }
                .nostr-edit-section {
                    margin-top: 0.75rem;
                    padding: 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: var(--radius-md);
                    background: #f8fafc;
                }

                .error-banner {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #FEF2F2;
                    color: #EF4444;
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    width: 100%;
                    margin-bottom: 1rem;
                    border: 1px solid #FECACA;
                }

                .input-field {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    background: var(--color-gray-50);
                    border-radius: var(--radius-md);
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-field:focus {
                    border-color: var(--color-primary);
                    background: white;
                    box-shadow: 0 0 0 3px rgba(0, 85, 255, 0.1);
                }

                .role-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }
                .role-card {
                    border: 2px solid #e2e8f0;
                    border-radius: var(--radius-lg);
                    padding: 1rem;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                }
                .role-card:hover {
                    border-color: #cbd5e1;
                }
                .role-card.active {
                    border-color: var(--color-primary);
                    background: #eff6ff;
                }

                .btn-primary {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .btn-primary:hover { opacity: 0.9; }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default ProfileSetup;
