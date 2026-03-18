import React, { useState } from 'react';
import { getPublicKey, nip19 } from 'nostr-tools';
import { generateSeedWords, privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Copy, Download, CheckCircle, ShieldAlert, ArrowRight, AlertCircle, Fingerprint, Loader2, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { passkeyService } from '../services/passkeyService';
import { PASSKEY_ENABLED } from '../config/featureFlags';
import { keyfileService } from '../services/keyfileService';

const Signup = () => {
    const { loginWithNsec, updateRole } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Steps: 0 = Intro, 1 = Key Gen, 2 = Backup, 3 = Profile
    const [step, setStep] = useState(0);
    const [keys, setKeys] = useState(null); // { nsec, npub, sk, pk, mnemonic }
    const [profile, setProfile] = useState({ name: '', role: 'investor' });
    const [copiedItem, setCopiedItem] = useState(null);
    const [savingPasskey, setSavingPasskey] = useState(false);
    const [passkeySaved, setPasskeySaved] = useState(false);
    const [keyPassword, setKeyPassword] = useState('');
    const [keyPasswordConfirm, setKeyPasswordConfirm] = useState('');
    const [showKeyPassword, setShowKeyPassword] = useState(false);
    const [encrypting, setEncrypting] = useState(false);
    const [showSeedPhrase, setShowSeedPhrase] = useState(false);
    const [keyfileDownloaded, setKeyfileDownloaded] = useState(false);

    const truncateKey = (key) => key ? `${key.slice(0, 10)}...${key.slice(-10)}` : '';

    const isKeyPasswordValid = (p) => p.length >= 16 && /[a-zA-Z]/.test(p) && /[0-9]/.test(p);

    const generateKeys = () => {
        const mnemonic = generateSeedWords();
        const sk = privateKeyFromSeedWords(mnemonic);
        const pk = getPublicKey(sk);

        const nsec = nip19.nsecEncode(sk);
        const npub = nip19.npubEncode(pk);

        setKeys({ sk, pk, nsec, npub, mnemonic });
        setStep(1);
    };

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        setCopiedItem(type);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    const downloadKeys = async () => {
        if (!keys) return;
        if (!isKeyPasswordValid(keyPassword)) { setError('Password must be at least 16 characters and include both letters and numbers.'); return; }
        if (keyPassword !== keyPasswordConfirm) { setError('Passwords do not match.'); return; }
        setError('');
        setEncrypting(true);
        try {
            await new Promise(r => setTimeout(r, 50));
            const { json, filename } = keyfileService.buildKeyfile(keys.sk, keyPassword);
            keyfileService.triggerDownload(json, filename);
            setKeyPassword('');
            setKeyPasswordConfirm('');
            setKeyfileDownloaded(true);
        } catch (err) {
            setError(err.message || 'Encryption failed.');
        } finally {
            setEncrypting(false);
        }
    };

    const handleBackupConfirm = () => {
        setStep(2);
    };

    const handleSavePasskey = async () => {
        if (!keys) return;
        setSavingPasskey(true);
        setError('');
        // Temporarily change URL so password managers associate the passkey with /login
        const originalPath = window.location.pathname;
        const loginPath = originalPath.replace(/\/signup\/?$/, '/login');
        if (loginPath !== originalPath) {
            window.history.replaceState(null, '', loginPath);
        }
        try {
            await passkeyService.saveWithPasskey(keys.nsec, keys.pk);
            setPasskeySaved(true);
        } catch (err) {
            if (!err.cancelled) {
                setError(err.message || 'Failed to save passkey.');
            }
        } finally {
            // Restore the original URL
            if (loginPath !== originalPath) {
                window.history.replaceState(null, '', originalPath);
            }
            setSavingPasskey(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        if (!profile.name || submitting) return;

        setError('');
        setSubmitting(true);

        try {
            // Log in with the nsec we generated — no extension needed.
            const result = await loginWithNsec(keys.nsec);

            if (result.success) {
                // Update role to match their selection
                const role = profile.role.toUpperCase();
                await updateRole(role);

                // Update profile name via API
                const { authService } = await import('../services/authService.js');
                await authService.completeNostrProfile({ name: profile.name });

                navigate('/dashboard');
            } else {
                setError(result.error || 'Failed to register. Please try again.');
            }
        } catch (err) {
            console.error('Signup error:', err);
            setError(err?.message || String(err) || 'Registration failed.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="signup-container">
            <div className="signup-card">
                <div className="progress-bar mb-8">
                    <div className={`step ${step >= 0 ? 'active' : ''}`}>1</div>
                    <div className="line"></div>
                    <div className={`step ${step >= 1 ? 'active' : ''}`}>2</div>
                    <div className="line"></div>
                    <div className={`step ${step >= 2 ? 'active' : ''}`}>3</div>
                </div>

                {step === 0 && (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Create Your Identity</h2>
                        <p className="text-gray-500 mb-8">
                            BIES uses Nostr-native authentication. No passwords. No emails. Just cryptographic keys you truly own.
                        </p>
                        <button onClick={generateKeys} className="btn-primary w-full py-3 rounded-full">
                            Generate My Keys
                        </button>
                        <div className="mt-4 text-sm text-gray-400">
                            Already have keys? <Link to="/login" className="text-blue-500">Log in</Link>
                        </div>
                    </div>
                )}

                {step === 1 && keys && (
                    <div className="key-display">
                        <h2 className="text-xl font-bold mb-2 text-center text-red-500 flex items-center justify-center gap-2">
                            <ShieldAlert size={24} />
                            Save Your Secret Key!
                        </h2>
                        <p className="text-sm text-gray-500 mb-6 text-center">
                            We cannot recover this for you. If you lose it, your account is gone forever.
                        </p>

                        <div className="flex flex-col gap-5 mb-4">
                            <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: 'var(--color-gray-100)', color: 'var(--color-text, inherit)' }}>
                                <span className="text-xs font-black shrink-0 tracking-wide" style={{ color: 'var(--color-gray-400)' }}>PUBLIC ID</span>
                                <span className="text-sm tracking-widest font-mono truncate" style={{ opacity: 0.8, flex: 1, textAlign: 'center', margin: '0 0.5rem' }}>
                                    {truncateKey(keys.npub)}
                                </span>
                                <button onClick={() => copyToClipboard(keys.npub, 'npub')} className="text-xs font-semibold flex items-center gap-2 px-2 py-1 shrink-0" style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none' }}>
                                    <Copy size={14} /> {copiedItem === 'npub' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-2xl border" style={{ background: 'var(--color-red-tint)', borderColor: 'var(--badge-error-bg)', color: 'var(--color-error)' }}>
                                <span className="text-xs font-black shrink-0 tracking-wide" style={{ color: 'var(--color-error)' }}>SECRET KEY</span>
                                <span className="text-sm tracking-widest font-mono truncate" style={{ opacity: 0.8, flex: 1, textAlign: 'center', margin: '0 0.5rem' }}>
                                    {truncateKey(keys.nsec)}
                                </span>
                                <button onClick={() => copyToClipboard(keys.nsec, 'nsec')} className="text-xs font-semibold flex items-center gap-2 px-2 py-1 shrink-0" style={{ background: 'transparent', color: 'inherit', border: 'none' }}>
                                    <Copy size={14} /> {copiedItem === 'nsec' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                        </div>

                        <div 
                            className="key-box mb-6 transition-all"
                            style={{ 
                                background: showSeedPhrase ? 'var(--color-gray-50)' : 'var(--color-surface)',
                                border: '1px solid var(--color-gray-200)', 
                                borderRadius: '1.5rem',
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <button
                                onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                                className="w-full flex items-center justify-between"
                                style={{ padding: '0.625rem 1rem', color: 'var(--color-gray-800)', borderBottom: showSeedPhrase ? '1px solid var(--color-gray-200)' : 'none' }}
                            >
                                <span className="text-sm font-bold flex items-center gap-2">
                                    <ShieldAlert size={18} style={{ color: 'var(--color-error)' }} /> Seed Phrase Backup
                                </span>
                                <div style={{ background: 'var(--color-gray-100)', borderRadius: '50%', padding: '4px', display: 'flex', color: 'var(--color-gray-500)' }}>
                                    {showSeedPhrase ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </button>

                            {showSeedPhrase && (
                                <div className="p-5" style={{ background: 'transparent' }}>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-black tracking-wide" style={{ color: 'var(--color-error)' }}>12 WORDS (Keep Safe!)</span>
                                        <button onClick={() => copyToClipboard(keys.mnemonic, 'seed')} className="text-xs font-semibold flex items-center gap-2 px-2 py-1" style={{ background: 'transparent', color: 'var(--color-primary)', border: 'none' }}>
                                            <Copy size={14} /> {copiedItem === 'seed' ? 'Copied!' : 'Copy Phrase'}
                                        </button>
                                    </div>
                                    <div className="shadow-sm" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: 'var(--color-red-tint)', padding: '1rem', borderRadius: '1.25rem', border: '1px solid var(--badge-error-bg)', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-error)' }}>
                                        {keys.mnemonic.split(' ').map((word, i) => (
                                            <span key={i} style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                                <span style={{ color: '#fca5a5', fontSize: '0.75rem', minWidth: '1.25rem' }}>{i + 1}.</span>
                                                <span style={{ fontWeight: '500' }}>{word}</span>
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs mt-4 text-center" style={{ color: 'var(--color-gray-500)', maxWidth: '280px', margin: '1rem auto 0' }}>
                                        You can log in with this 12-word seed phrase instead of your secret key.
                                    </p>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-red-tint)', color: 'var(--color-error)', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem', width: '100%', marginBottom: '0.75rem', border: '1px solid var(--badge-error-bg)' }}>
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="backup-buttons">
                            {/* ── Backup section ── */}
                            <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                                <p className="text-sm font-bold" style={{ marginBottom: 4, color: 'var(--color-gray-600)' }}>Backup Your Keys</p>
                                <p className="text-xs" style={{ marginBottom: '0.75rem', color: 'var(--color-gray-400)' }}>
                                    Choose one or more ways to back up. Copy the nsec or seed phrase above, or download an encrypted key file:
                                </p>
                            </div>
                            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-surface)' }}>
                                <p className="text-xs font-bold" style={{ marginBottom: 2, color: 'var(--color-gray-500)' }}>Encrypted Key File (.nostrkey)</p>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type={showKeyPassword ? 'text' : 'password'}
                                        value={keyPassword}
                                        onChange={(e) => setKeyPassword(e.target.value)}
                                        placeholder="Password (min 16 chars, letters & numbers)"
                                        style={{ width: '100%', padding: '0.5rem 2.25rem 0.5rem 0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: '0.5rem', fontSize: '0.8rem', background: 'var(--color-surface)', color: 'var(--color-text, inherit)' }}
                                        autoComplete="new-password"
                                    />
                                    <button type="button" onClick={() => setShowKeyPassword(!showKeyPassword)} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', padding: 2 }}>
                                        {showKeyPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <input
                                    type={showKeyPassword ? 'text' : 'password'}
                                    value={keyPasswordConfirm}
                                    onChange={(e) => setKeyPasswordConfirm(e.target.value)}
                                    placeholder="Confirm password"
                                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: '0.5rem', fontSize: '0.8rem', background: 'var(--color-surface)', color: 'var(--color-text, inherit)' }}
                                    autoComplete="new-password"
                                />
                                <button
                                    onClick={downloadKeys}
                                    disabled={encrypting || !isKeyPasswordValid(keyPassword) || keyPassword !== keyPasswordConfirm}
                                    className="w-full btn-outline py-2 rounded-full flex items-center justify-center gap-2"
                                    style={{ opacity: (encrypting || !isKeyPasswordValid(keyPassword) || keyPassword !== keyPasswordConfirm) ? 0.5 : 1 }}
                                >
                                    {encrypting ? <><Loader2 size={14} className="spin" /> Encrypting...</> : keyfileDownloaded ? <><CheckCircle size={14} style={{ color: 'var(--color-success)' }} /> Downloaded — Download Again</> : <><Download size={14} /> Download .nostrkey File</>}
                                </button>
                                <p className="text-xs" style={{ lineHeight: 1.3, color: 'var(--color-gray-400)' }}>
                                    Password must be <strong>at least 16 characters</strong> and include both <strong>letters and numbers</strong>. All other characters are welcome too. Store the file somewhere safe — you'll need this password to unlock it.
                                </p>
                            </div>

                            {/* ── Quick Login section (separate from backup) ── */}
                            {PASSKEY_ENABLED && passkeyService.isSupported() && (
                                <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <p className="text-sm font-bold" style={{ marginBottom: 2, color: 'var(--color-gray-600)' }}>Quick Login (Optional)</p>
                                    <button
                                        onClick={handleSavePasskey}
                                        disabled={savingPasskey || passkeySaved}
                                        className="w-full btn-outline py-3 rounded-full flex items-center justify-center gap-2"
                                    >
                                        {passkeySaved ? (
                                            <><CheckCircle size={16} style={{ color: 'var(--color-success)' }} /> Passkey Saved</>
                                        ) : savingPasskey ? (
                                            <><Loader2 size={16} className="spin" /> Saving...</>
                                        ) : (
                                            <><Fingerprint size={16} /> Save to Passkey</>
                                        )}
                                    </button>
                                    <p className="text-xs" style={{ color: 'var(--color-warning)', lineHeight: 1.3 }}>
                                        Passkey does NOT save your nsec. It encrypts your key on this device using your fingerprint or PIN for quick login only. If you lose this device, the passkey is gone. Always keep a separate backup above.
                                    </p>
                                </div>
                            )}

                            {!keyfileDownloaded && (
                                <p className="text-xs text-center" style={{ color: 'var(--color-warning)', marginTop: '0.25rem' }}>
                                    You must download your encrypted key file before continuing.
                                </p>
                            )}
                            <button
                                onClick={handleBackupConfirm}
                                disabled={!keyfileDownloaded}
                                className="w-full btn-primary py-3 rounded-full"
                                style={{ marginTop: '0.25rem', opacity: keyfileDownloaded ? 1 : 0.4, pointerEvents: keyfileDownloaded ? 'auto' : 'none' }}
                            >
                                {keyfileDownloaded ? 'Continue — I\'ve Saved My Keys' : 'Download Key File to Continue'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleProfileSubmit} className="w-full">
                        <h2 className="text-2xl font-bold mb-6 text-center">Complete Profile</h2>

                        <p className="text-sm text-gray-500 mb-4 text-center">
                            Set up your display name and role to get started.
                        </p>

                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-red-tint)', color: 'var(--color-error)', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.875rem', width: '100%', marginBottom: '1rem', border: '1px solid var(--badge-error-bg)' }}>
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-gray-700)' }}>Display Name</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border input-box"
                                placeholder="e.g. Satoshi Nakamoto"
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                            />
                        </div>

                        <div className="mb-6" style={{ marginBottom: '3rem' }}>
                            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-gray-700)' }}>I am a...</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={`role-card ${profile.role === 'investor' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'investor' })}
                                >
                                    <div className="font-bold">Investor</div>
                                    <div className="text-xs" style={{ color: 'var(--color-gray-500)' }}> looking for opportunities</div>
                                </div>
                                <div
                                    className={`role-card ${profile.role === 'builder' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'builder' })}
                                >
                                    <div className="font-bold">Builder</div>
                                    <div className="text-xs" style={{ color: 'var(--color-gray-500)' }}> building a project</div>
                                </div>
                                <div
                                    className={`role-card ${profile.role === 'educator' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'educator' })}
                                >
                                    <div className="font-bold">Educator</div>
                                    <div className="text-xs" style={{ color: 'var(--color-gray-500)' }}> teaching & community</div>
                                </div>
                                <div
                                    className={`role-card ${profile.role === 'member' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'member' })}
                                >
                                    <div className="font-bold">Member</div>
                                    <div className="text-xs" style={{ color: 'var(--color-gray-500)' }}> supporting the ecosystem</div>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary w-full py-3 rounded-full flex items-center justify-center gap-2">
                            Enter Dashboard <ArrowRight size={18} />
                        </button>
                    </form>
                )}
            </div>

            <style jsx>{`
                .signup-container {
                    min-height: calc(100vh - 150px);
                    min-height: calc(100dvh - 150px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                    padding: clamp(1rem, 3vh, 2rem) clamp(0.5rem, 2vh, 1rem);
                }
                .signup-card {
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                    padding: clamp(1rem, 2vh, 2.5rem);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    width: 100%;
                    max-width: 500px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    border: 1px solid var(--color-gray-200);
                }
                .progress-bar {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    max-width: 200px;
                }
                .step {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background: var(--color-gray-200);
                    color: var(--color-gray-500);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    font-weight: bold;
                }
                .step.active {
                    background: var(--color-primary);
                    color: white;
                }
                .line {
                    flex: 1;
                    height: 2px;
                    background: var(--color-gray-200);
                    margin: 0 5px;
                }

                .btn-primary {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    border: none;
                    border-radius: 9999px;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                }
                .btn-primary:hover { opacity: 0.9; }

                .btn-outline {
                    border: 1px solid var(--color-gray-300);
                    color: var(--color-gray-600);
                    border-radius: 1rem;
                    background: transparent;
                    transition: all 0.2s;
                }
                .btn-outline:hover { background: var(--color-gray-100); color: var(--color-gray-900); }
                .btn-outline:disabled { opacity: 0.5; pointer-events: none; }

                .input-box {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: 1rem;
                    color: var(--color-text, inherit);
                    transition: border-color 0.2s;
                    outline: none;
                }
                .input-box:focus {
                    border-color: var(--color-primary);
                }

                .backup-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    width: 100%;
                }

                .role-card {
                    border: 1px solid var(--color-gray-200);
                    background: var(--color-surface);
                    border-radius: 1rem;
                    padding: 1rem;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                }
                .role-card:hover {
                    background: var(--color-gray-50);
                }
                .role-card.active {
                    border-color: var(--color-primary);
                    background: var(--color-blue-tint);
                }
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

export default Signup;
