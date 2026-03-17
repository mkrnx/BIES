import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, Key, Globe, FileText, Upload, Fingerprint, CheckCircle, Lock, Eye, EyeOff, ArrowLeft, Download, ShieldCheck, Smartphone } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { passkeyService } from '../services/passkeyService';
import { keyfileService } from '../services/keyfileService';
import { PASSKEY_ENABLED, NIP46_ENABLED } from '../config/featureFlags';
import logoIcon from '../assets/logo-icon.svg';
import NostrIcon from '../components/NostrIcon';

const Login = () => {
    const { user: authedUser, loading: authLoading, loginWithNostrAndCheckNew, loginWithNsecAndCheckNew, loginWithSeedPhraseAndCheckNew, loginWithBunkerAndCheckNew, loginWithPasskeyAndCheckNew, loginWithDemo } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [nsecInput, setNsecInput] = useState('');
    const [seedInput, setSeedInput] = useState('');
    const [loginMode, setLoginMode] = useState('nsec'); // 'nsec', 'seed', 'file', or 'bunker'
    const [bunkerInput, setBunkerInput] = useState('');
    const [keyFileName, setKeyFileName] = useState('');
    const [hasNostrExtension, setHasNostrExtension] = useState(
        typeof window !== 'undefined' && !!window.nostr
    );

    // Passkey state — only show button if feature is enabled and user has a stored encrypted key
    const [hasPasskey] = useState(() => PASSKEY_ENABLED && passkeyService.isSupported() && passkeyService.hasCredential());
    const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
    const [pendingNsec, setPendingNsec] = useState(null);
    const [pendingRedirect, setPendingRedirect] = useState(null);
    const [savingPasskey, setSavingPasskey] = useState(false);
    const [passkeyUser, setPasskeyUser] = useState(null);

    // Post-login keyfile download state
    const [dlKeyPassword, setDlKeyPassword] = useState('');
    const [dlKeyPasswordConfirm, setDlKeyPasswordConfirm] = useState('');
    const [showDlKeyPassword, setShowDlKeyPassword] = useState(false);
    const [dlEncrypting, setDlEncrypting] = useState(false);

    // Keyfile unlock state
    const [keyfilePayload, setKeyfilePayload] = useState(null);
    const [keyfileFilename, setKeyfileFilename] = useState('');
    const [unlockPassword, setUnlockPassword] = useState('');
    const [showUnlockPassword, setShowUnlockPassword] = useState(false);
    const [unlocking, setUnlocking] = useState(false);

    useEffect(() => {
        if (hasNostrExtension) return;

        const check = setInterval(() => {
            if (window.nostr) {
                setHasNostrExtension(true);
                clearInterval(check);
            }
        }, 100);

        const timeout = setTimeout(() => clearInterval(check), 3000);

        return () => {
            clearInterval(check);
            clearTimeout(timeout);
        };
    }, [hasNostrExtension]);

    // Redirect to dashboard if already logged in, but not while passkey prompt is showing
    useEffect(() => {
        if (!authLoading && authedUser && !showPasskeyPrompt) {
            navigate('/feed', { replace: true });
        }
    }, [authLoading, authedUser, showPasskeyPrompt, navigate]);

    const handleResult = (result, nsec) => {
        if (result.success) {
            const target = result.needsProfileSetup ? '/profile-setup' : '/feed';

            // Offer passkey save if: we have the nsec, passkeys are supported,
            // and user doesn't already have one for this account
            if (PASSKEY_ENABLED && nsec && passkeyService.isSupported() && !passkeyService.hasCredential(result.user?.nostrPubkey)) {
                setPendingNsec(nsec);
                setPendingRedirect(target);
                setPasskeyUser(result.user);
                setShowPasskeyPrompt(true);
            } else {
                navigate(target);
            }
        } else {
            setError(result.error || 'Login failed. Please try again.');
        }
    };

    const handleExtensionLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await loginWithNostrAndCheckNew();
            handleResult(result);
        } catch (err) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyLogin = async () => {
        setError('');
        setLoading(true);
        try {
            const result = await loginWithPasskeyAndCheckNew();
            if (result.cancelled) return;
            handleResult(result);
        } catch (err) {
            setError(err.message || 'Passkey login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleNsecLogin = async (e) => {
        e.preventDefault();
        if (!nsecInput.trim()) return;

        setError('');
        setLoading(true);
        try {
            const result = await loginWithNsecAndCheckNew(nsecInput);
            handleResult(result, nsecInput.trim());
        } catch (err) {
            console.error('nsec login error:', err);
            setError(err?.message || String(err) || 'Invalid nsec key or login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleSeedLogin = async (e) => {
        e.preventDefault();
        if (!seedInput.trim()) return;

        setError('');
        setLoading(true);
        try {
            // Derive nsec from seed for potential passkey save
            const sk = privateKeyFromSeedWords(seedInput.trim().toLowerCase());
            const nsec = nip19.nsecEncode(sk);

            const result = await loginWithSeedPhraseAndCheckNew(seedInput);
            handleResult(result, nsec);
        } catch (err) {
            setError(err.message || 'Invalid seed phrase or login failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleBunkerLogin = async (e) => {
        e.preventDefault();
        if (!bunkerInput.trim()) return;
        setError('');
        setLoading(true);
        try {
            const result = await loginWithBunkerAndCheckNew(bunkerInput);
            handleResult(result);
        } catch (err) {
            setError(err.message || 'Failed to connect to remote signer.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileLogin = async (file) => {
        setError('');
        setKeyFileName('');
        try {
            const text = await file.text();
            const parsed = keyfileService.parseKeyfile(text);

            if (!parsed) {
                setError('Invalid file. Expected a .nostrkey or key file.');
                return;
            }

            // Legacy .txt file with raw nsec — log in directly
            if (parsed.legacyNsec) {
                setKeyFileName(file.name);
                setLoading(true);
                const result = await loginWithNsecAndCheckNew(parsed.legacyNsec);
                handleResult(result, parsed.legacyNsec);
                setLoading(false);
                return;
            }

            // .nostrkey file — show password unlock prompt
            setKeyfilePayload(parsed);
            setKeyfileFilename(file.name);
        } catch (err) {
            setError(err.message || 'Failed to read key file.');
            setLoading(false);
        }
    };

    const handleUnlockKeyfile = async (e) => {
        e.preventDefault();
        if (!keyfilePayload || !unlockPassword) return;
        setError('');
        setUnlocking(true);
        try {
            await new Promise(r => setTimeout(r, 50));
            const { nsec } = keyfileService.decrypt(keyfilePayload.ncryptsec, unlockPassword, keyfilePayload.npub);
            setUnlockPassword('');
            const result = await loginWithNsecAndCheckNew(nsec);
            handleResult(result, nsec);
        } catch (err) {
            setError(err.message || 'Wrong password or corrupted file.');
        } finally {
            setUnlocking(false);
        }
    };

    const resetKeyfileState = () => {
        setKeyfilePayload(null);
        setKeyfileFilename('');
        setUnlockPassword('');
        setError('');
    };

    // TODO: Remove before production
    const handleDemoLogin = () => {
        const demoUser = {
            id: 'demo-user',
            email: 'demo@bies.dev',
            nostrPubkey: '0000000000000000000000000000000000000000000000000000000000000000',
            role: 'BUILDER',
            profile: { name: 'Demo User', bio: 'Demo account for mobile testing', avatar: '', banner: '' },
        };
        localStorage.setItem('bies_token', 'demo-token');
        localStorage.setItem('bies_user', JSON.stringify(demoUser));
        window.location.href = '/biestest/feed';
    };

    const handleDownloadKeyfile = async () => {
        if (!pendingNsec) return;
        if (dlKeyPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (dlKeyPassword !== dlKeyPasswordConfirm) { setError('Passwords do not match.'); return; }
        setError('');
        setDlEncrypting(true);
        try {
            await new Promise(r => setTimeout(r, 50));
            await keyfileService.encryptAndDownload(pendingNsec, dlKeyPassword);
            setDlKeyPassword('');
            setDlKeyPasswordConfirm('');
        } catch (err) {
            setError(err.message || 'Encryption failed.');
        } finally {
            setDlEncrypting(false);
        }
    };

    const handleSavePasskey = async () => {
        setSavingPasskey(true);
        setError('');
        try {
            await passkeyService.saveWithPasskey(pendingNsec, passkeyUser?.nostrPubkey);
            navigate(pendingRedirect);
        } catch (err) {
            if (err.cancelled) return;
            setError(err.message || 'Failed to save passkey.');
        } finally {
            setSavingPasskey(false);
        }
    };

    const handleSkipPasskey = () => {
        navigate(pendingRedirect);
    };

    // ─── Keyfile unlock prompt (shown after uploading a .nostrkey file) ───
    if (keyfilePayload) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="passkey-prompt-icon">
                        <Lock size={40} />
                    </div>

                    <h2 className="text-xl font-bold mb-2">Unlock Your Key</h2>

                    {keyfilePayload.npub && (
                        <p className="text-sm text-gray-500 mb-1">
                            Identity: <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{keyfilePayload.npub.slice(0, 16)}...{keyfilePayload.npub.slice(-6)}</span>
                        </p>
                    )}
                    {keyfileFilename && (
                        <p className="text-xs text-gray-400 mb-4">File: {keyfileFilename}</p>
                    )}

                    {error && (
                        <div className="error-banner">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleUnlockKeyfile} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="text-sm text-gray-600" style={{ display: 'block', marginBottom: 4 }}>
                                Enter the password you set when you created this key file
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showUnlockPassword ? 'text' : 'password'}
                                    value={unlockPassword}
                                    onChange={(e) => setUnlockPassword(e.target.value)}
                                    placeholder="Password"
                                    className="key-input"
                                    style={{ paddingLeft: '0.75rem', paddingRight: '2.5rem' }}
                                    autoComplete="current-password"
                                    autoFocus
                                />
                                <button type="button" onClick={() => setShowUnlockPassword(!showUnlockPassword)} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                                    {showUnlockPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={unlocking || !unlockPassword}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                        >
                            {unlocking ? (
                                <><Loader2 size={20} className="spin" /> Unlocking...</>
                            ) : (
                                <><Lock size={20} /> Unlock & Log In</>
                            )}
                        </button>
                    </form>

                    <button
                        onClick={resetKeyfileState}
                        className="mt-3 text-sm text-gray-400 flex items-center gap-1"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                        <ArrowLeft size={14} /> Choose a different file
                    </button>
                </div>

                <style jsx>{`
                    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-gray-50); }
                    .login-card { background: var(--color-surface); padding: 3rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); width: 100%; max-width: 450px; display: flex; flex-direction: column; align-items: center; }
                    .passkey-prompt-icon { width: 72px; height: 72px; border-radius: 50%; background: var(--color-blue-tint); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
                    .btn-login { background: var(--color-primary); color: white; font-weight: 600; transition: opacity 0.2s; border: none; cursor: pointer; }
                    .btn-login:hover { opacity: 0.9; }
                    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
                    .key-input { width: 100%; padding: 0.75rem; border: 1px solid var(--color-gray-200); border-radius: 9999px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
                    .key-input:focus { border-color: var(--color-primary); }
                    .error-banner { display: flex; align-items: center; gap: 8px; background: var(--color-red-tint); color: var(--color-error); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; width: 100%; margin-bottom: 1rem; border: 1px solid var(--color-red-200, #FECACA); }
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    }

    // ─── Post-login prompt: .nostrkey download + passkey save ───
    if (showPasskeyPrompt) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="passkey-prompt-icon">
                        <ShieldCheck size={40} />
                    </div>

                    <h2 className="text-xl font-bold mb-2">Secure Your Key</h2>
                    <p className="text-gray-500 mb-6 text-center text-sm">
                        Download an encrypted backup file or set up quick login with a passkey.
                    </p>

                    {error && (
                        <div className="error-banner">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* ── Backup: .nostrkey download ── */}
                        <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <p className="text-xs font-bold" style={{ color: 'var(--color-gray-500)', marginBottom: 2 }}>
                                Backup — Encrypted Key File
                            </p>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showDlKeyPassword ? 'text' : 'password'}
                                    value={dlKeyPassword}
                                    onChange={(e) => setDlKeyPassword(e.target.value)}
                                    placeholder="Password (min 8 chars)"
                                    style={{ width: '100%', padding: '0.5rem 2.25rem 0.5rem 0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: 6, fontSize: '0.8rem' }}
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowDlKeyPassword(!showDlKeyPassword)} style={{ position: 'absolute', right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                                    {showDlKeyPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            <input
                                type={showDlKeyPassword ? 'text' : 'password'}
                                value={dlKeyPasswordConfirm}
                                onChange={(e) => setDlKeyPasswordConfirm(e.target.value)}
                                placeholder="Confirm password"
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: 6, fontSize: '0.8rem' }}
                                autoComplete="new-password"
                            />
                            <button
                                onClick={handleDownloadKeyfile}
                                disabled={dlEncrypting || dlKeyPassword.length < 8 || dlKeyPassword !== dlKeyPasswordConfirm}
                                className="w-full btn-skip flex items-center justify-center gap-2 py-2 rounded-full"
                                style={{ opacity: (dlEncrypting || dlKeyPassword.length < 8 || dlKeyPassword !== dlKeyPasswordConfirm) ? 0.5 : 1 }}
                            >
                                {dlEncrypting ? <><Loader2 size={14} className="spin" /> Encrypting...</> : <><Download size={14} /> Download .nostrkey File</>}
                            </button>
                            <p className="text-xs" style={{ color: 'var(--color-gray-400)', lineHeight: 1.3 }}>
                                This password-protected file is a true backup of your key. Store it somewhere safe.
                            </p>
                        </div>

                        {/* ── Quick Login: Passkey ── */}
                        {PASSKEY_ENABLED && passkeyService.isSupported() && (
                            <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: 12, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <p className="text-xs font-bold" style={{ color: 'var(--color-gray-500)', marginBottom: 2 }}>
                                    Quick Login — Passkey (Optional)
                                </p>
                                <button
                                    onClick={handleSavePasskey}
                                    disabled={savingPasskey}
                                    className="w-full btn-login flex items-center justify-center gap-2 py-2 rounded-full"
                                >
                                    {savingPasskey ? (
                                        <Loader2 size={16} className="spin" />
                                    ) : (
                                        <Fingerprint size={16} />
                                    )}
                                    <span>{savingPasskey ? 'Saving...' : 'Save Passkey'}</span>
                                </button>
                                <p className="text-xs" style={{ color: '#f59e0b', lineHeight: 1.3 }}>
                                    Passkey does NOT save your nsec. It encrypts your key on this device using your fingerprint or PIN for quick login only. If you lose this device, the passkey is gone. Always keep a separate backup.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleSkipPasskey}
                            disabled={savingPasskey}
                            className="w-full btn-skip flex items-center justify-center py-3 rounded-full"
                        >
                            Continue to Dashboard
                        </button>
                    </div>
                </div>

                <style jsx>{`
                    .login-container {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: var(--color-gray-50);
                    }
                    .login-card {
                        background: var(--color-surface);
                        padding: 3rem;
                        border-radius: var(--radius-xl);
                        box-shadow: var(--shadow-lg);
                        width: 100%;
                        max-width: 450px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .passkey-prompt-icon {
                        width: 72px;
                        height: 72px;
                        border-radius: 50%;
                        background: var(--color-blue-tint);
                        color: var(--color-primary);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-bottom: 1.5rem;
                    }
                    .btn-login {
                        background: var(--color-primary);
                        color: white;
                        font-weight: 600;
                        transition: opacity 0.2s;
                        border: none;
                        cursor: pointer;
                    }
                    .btn-login:hover { opacity: 0.9; }
                    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
                    .btn-skip {
                        background: transparent;
                        border: 1px solid var(--color-gray-200);
                        color: var(--color-gray-500);
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-skip:hover { background: var(--color-gray-100); }
                    .btn-skip:disabled { opacity: 0.6; cursor: not-allowed; }
                    .error-banner {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: var(--color-red-tint);
                        color: var(--color-error);
                        padding: 0.75rem 1rem;
                        border-radius: var(--radius-md);
                        font-size: 0.875rem;
                        width: 100%;
                        margin-bottom: 1rem;
                        border: 1px solid var(--color-red-200, #FECACA);
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
    }

    // ─── Main login form ─────────────────────────────────────────────────────
    return (
        <div className="login-container">
            <div className="login-card">
                <div className="logo mb-6">
                    <img src={logoIcon} alt="BIES" style={{ height: '64px', width: 'auto' }} />
                </div>

                <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
                <p className="text-gray-500 mb-8 text-center">
                    Access the Bitcoin Investment Ecosystem of El Salvador
                </p>

                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Quick login methods */}
                {(hasNostrExtension || hasPasskey) && (
                    <div className="quick-login-buttons">
                        {hasNostrExtension && (
                            <button
                                onClick={handleExtensionLogin}
                                disabled={loading}
                                className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                            >
                                {loading && !nsecInput.trim() && !showPasskeyPrompt ? (
                                    <Loader2 size={20} className="spin" />
                                ) : (
                                    <Globe size={20} />
                                )}
                                <span>{loading && !nsecInput.trim() && !showPasskeyPrompt ? 'Connecting...' : 'Login with Extension'}</span>
                            </button>
                        )}
                        {hasPasskey && (
                            <button
                                onClick={handlePasskeyLogin}
                                disabled={loading}
                                className="w-full btn-passkey flex items-center justify-center gap-3 py-3 rounded-full"
                            >
                                {loading ? (
                                    <Loader2 size={20} className="spin" />
                                ) : (
                                    <Fingerprint size={20} />
                                )}
                                <span>Login with Passkey</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Divider between quick methods and manual methods */}
                {(hasNostrExtension || hasPasskey) && (
                    <div className="divider"><span>or</span></div>
                )}

                {/* Login mode tabs */}
                <div className="mode-tabs">
                    <button
                        className={`mode-tab ${loginMode === 'nsec' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('nsec'); setError(''); }}
                    >
                        <Key size={14} /> nsec Key
                    </button>
                    <button
                        className={`mode-tab ${loginMode === 'seed' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('seed'); setError(''); }}
                    >
                        <FileText size={14} /> Seed Phrase
                    </button>
                    <button
                        className={`mode-tab ${loginMode === 'file' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('file'); setError(''); setKeyFileName(''); }}
                    >
                        <Upload size={14} /> Key File
                    </button>
                    {NIP46_ENABLED && (
                        <button
                            className={`mode-tab ${loginMode === 'bunker' ? 'active' : ''}`}
                            onClick={() => { setLoginMode('bunker'); setError(''); }}
                        >
                            <Smartphone size={14} /> Remote
                        </button>
                    )}
                </div>

                {/* Login with nsec */}
                {loginMode === 'nsec' && (
                    <form onSubmit={handleNsecLogin} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="key-input-wrapper">
                            <Key size={16} className="key-input-icon" />
                            <input
                                type="password"
                                placeholder="Paste your nsec key..."
                                value={nsecInput}
                                onChange={(e) => setNsecInput(e.target.value)}
                                className="key-input"
                                autoComplete="off"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !nsecInput.trim()}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                        >
                            {loading && nsecInput.trim() ? (
                                <Loader2 size={20} className="spin" />
                            ) : (
                                <NostrIcon size={20} color="#8b5cf6" />
                            )}
                            <span>{loading && nsecInput.trim() ? 'Connecting...' : 'Login with nsec'}</span>
                        </button>
                    </form>
                )}

                {/* Login with seed phrase */}
                {loginMode === 'seed' && (
                    <form onSubmit={handleSeedLogin} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <textarea
                            placeholder="Enter your 12 or 24 word seed phrase..."
                            value={seedInput}
                            onChange={(e) => setSeedInput(e.target.value)}
                            className="seed-input"
                            autoComplete="off"
                            rows={3}
                        />
                        <button
                            type="submit"
                            disabled={loading || !seedInput.trim()}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                        >
                            {loading && seedInput.trim() ? (
                                <Loader2 size={20} className="spin" />
                            ) : (
                                <NostrIcon size={20} color="#8b5cf6" />
                            )}
                            <span>{loading && seedInput.trim() ? 'Connecting...' : 'Login with Seed Phrase'}</span>
                        </button>
                    </form>
                )}

                {/* Login with key file */}
                {loginMode === 'file' && (
                    <div className="w-full">
                        <label
                            className="file-drop-zone"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                if (file) handleFileLogin(file);
                            }}
                        >
                            <input
                                type="file"
                                accept=".nostrkey,.json,.txt"
                                className="hidden-file-input"
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) handleFileLogin(file);
                                }}
                            />
                            {loading ? (
                                <Loader2 size={24} className="spin" style={{ color: 'var(--color-gray-400)' }} />
                            ) : (
                                <Upload size={24} style={{ color: 'var(--color-gray-400)' }} />
                            )}
                            {keyFileName ? (
                                <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{keyFileName}</span>
                            ) : (
                                <>
                                    <span className="text-sm font-medium" style={{ color: 'var(--color-gray-500)' }}>
                                        Drop your <strong>.nostrkey</strong> file here
                                    </span>
                                    <span className="text-xs" style={{ color: 'var(--color-gray-400)' }}>or click to browse</span>
                                </>
                            )}
                        </label>
                    </div>
                )}

                {/* Login with remote signer (NIP-46) */}
                {loginMode === 'bunker' && (
                    <form onSubmit={handleBunkerLogin} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="key-input-wrapper">
                            <Smartphone size={16} className="key-input-icon" />
                            <input
                                type="text"
                                placeholder="bunker://... or name@domain.com"
                                value={bunkerInput}
                                onChange={(e) => setBunkerInput(e.target.value)}
                                className="key-input"
                                autoComplete="off"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !bunkerInput.trim()}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                        >
                            {loading && bunkerInput.trim() ? (
                                <Loader2 size={20} className="spin" />
                            ) : (
                                <NostrIcon size={20} color="#8b5cf6" />
                            )}
                            <span>{loading && bunkerInput.trim() ? 'Connecting to signer...' : 'Login with Remote Signer'}</span>
                        </button>
                        <p className="text-xs text-center" style={{ color: 'var(--color-gray-400)' }}>
                            Works with Amber, nsecBunker, and other NIP-46 signers
                        </p>
                    </form>
                )}

                {/* Create Account */}
                <div className="mt-6 pt-6 border-t border-gray-100 w-full text-center">
                    <p className="text-gray-500 mb-4">New to Nostr?</p>
                    <Link to="/signup" style={{
                        display: 'block',
                        width: '100%',
                        padding: '0.875rem 1.5rem',
                        background: '#1d4ed8',
                        color: 'white',
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        textAlign: 'center',
                        borderRadius: '9999px',
                    }}>
                        Create New Account
                    </Link>
                </div>

                {/* Demo login — TODO: Remove before production */}
                <div className="mt-4 w-full">
                    <button
                        onClick={handleDemoLogin}
                        disabled={loading}
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.75rem 1.5rem',
                            background: 'transparent',
                            color: 'var(--color-gray-400)',
                            border: '1px dashed var(--color-gray-300)',
                            borderRadius: '9999px',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                        }}
                    >
                        {loading ? 'Logging in...' : 'Demo Login (skip auth)'}
                    </button>
                </div>

                {/* Extension hint — shown when no extension detected */}
                {!hasNostrExtension && (
                    <>
                        <div className="divider mt-4"><span>or</span></div>
                        <p className="text-sm text-gray-400 text-center">
                            Have a Nostr browser extension?{' '}
                            <button
                                onClick={handleExtensionLogin}
                                disabled={loading}
                                className="text-blue-500 hover:underline font-medium"
                            >
                                Login with Extension
                            </button>
                        </p>
                        <div className="extension-links">
                            <p className="text-xs text-gray-400">No extension detected? Install one:</p>
                            <div className="flex gap-3 mt-1 justify-center">
                                <a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgcdlhiodkdc" target="_blank" rel="noopener noreferrer" className="extension-link">
                                    Chrome (nos2x)
                                </a>
                                <span className="text-xs text-gray-300">|</span>
                                <a href="https://addons.mozilla.org/en-US/firefox/addon/nos2x-fox/" target="_blank" rel="noopener noreferrer" className="extension-link">
                                    Firefox (nos2x-fox)
                                </a>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <style jsx>{`
                .login-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                }
                .login-card {
                    background: var(--color-surface);
                    padding: 3rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    width: 100%;
                    max-width: 450px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .quick-login-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    width: 100%;
                }
                .btn-login {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .btn-login:hover {
                    opacity: 0.9;
                }
                .btn-login:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .btn-passkey {
                    background: #1e1b4b;
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                    border: none;
                    cursor: pointer;
                }
                .btn-passkey:hover {
                    opacity: 0.9;
                }
                .btn-passkey:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .divider {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 0.75rem 0;
                    color: var(--color-gray-400);
                    font-size: 0.875rem;
                }
                .divider::before,
                .divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--color-gray-200);
                }
                .mode-tabs {
                    display: flex;
                    width: 100%;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                .mode-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0.5rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md, 8px);
                    background: transparent;
                    color: var(--color-gray-400);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mode-tab:hover {
                    border-color: var(--color-gray-300);
                    color: var(--color-gray-500);
                }
                .mode-tab.active {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: var(--color-blue-tint);
                }
                .key-input-wrapper {
                    width: 100%;
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .key-input-icon {
                    position: absolute;
                    left: 14px;
                    color: var(--color-gray-400);
                    pointer-events: none;
                }
                .key-input {
                    width: 100%;
                    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 9999px;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .key-input:focus {
                    border-color: var(--color-primary);
                }
                .seed-input {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md, 8px);
                    font-size: 0.875rem;
                    font-family: monospace;
                    outline: none;
                    resize: none;
                    transition: border-color 0.2s;
                }
                .seed-input:focus {
                    border-color: var(--color-primary);
                }
                .file-drop-zone {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 2rem 1rem;
                    border: 2px dashed var(--color-gray-200);
                    border-radius: var(--radius-md, 8px);
                    cursor: pointer;
                    transition: border-color 0.2s, background 0.2s;
                    margin-bottom: 0.75rem;
                }
                .file-drop-zone:hover {
                    border-color: var(--color-primary);
                    background: var(--color-gray-100);
                }
                .hidden-file-input {
                    display: none;
                }
                .extension-links {
                    margin-top: 0.75rem;
                    text-align: center;
                }
                .extension-link {
                    font-size: 0.75rem;
                    color: #3b82f6;
                    text-decoration: none;
                    font-weight: 500;
                }
                .extension-link:hover {
                    text-decoration: underline;
                }
                .error-banner {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--color-red-tint);
                    color: var(--color-error);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    width: 100%;
                    margin-bottom: 1rem;
                    border: 1px solid var(--color-red-200, #FECACA);
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

export default Login;
