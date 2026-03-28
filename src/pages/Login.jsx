import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, Key, Globe, FileText, Upload, Fingerprint, Lock, Eye, EyeOff, ArrowLeft, Smartphone } from 'lucide-react';
import { keyfileService } from '../services/keyfileService';
import { PASSKEY_ENABLED, NIP46_ENABLED } from '../config/featureFlags';
import logoIcon from '../assets/logo-icon.svg';
import NostrIcon from '../components/NostrIcon';

const Login = () => {
    const { t } = useTranslation();
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

    // Passkey — always available when feature flag is on.
    // discoverAndLogin handles both stored-credential and discoverable flows.

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

    // Redirect to dashboard if already logged in
    useEffect(() => {
        if (!authLoading && authedUser) {
            navigate('/feed', { replace: true });
        }
    }, [authLoading, authedUser, navigate]);

    const handleResult = (result) => {
        if (result.success) {
            const target = result.needsProfileSetup ? '/profile-setup' : '/feed';
            navigate(target);
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
            const msg = err.message || '';
            if (/rp\.?id.*origin|origin.*rp\.?id/i.test(msg)) {
                // Browser doesn't support WebAuthn Related Origin Requests
                setError(
                    'This browser doesn\'t support cross-origin passkeys. ' +
                    'Please use Chrome, Edge, or Safari instead.'
                );
            } else if (/PRF.*not (available|supported)|not support.*PRF/i.test(msg)) {
                // PRF extension not supported (iOS Chrome / older browsers)
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                setError(
                    isIOS
                        ? 'Passkey login requires Safari on iOS. Chrome and other browsers on iPhone/iPad don\'t support the required security feature (PRF).'
                        : 'This browser doesn\'t support the WebAuthn PRF extension required for passkey login. Please use Chrome 116+, Edge 116+, or Safari 18+.'
                );
            } else {
                setError(err.message || 'Passkey login failed.');
            }
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
            handleResult(result);
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
            const result = await loginWithSeedPhraseAndCheckNew(seedInput);
            handleResult(result);
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
                handleResult(result);
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
            handleResult(result);
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

    // ─── Keyfile unlock prompt (shown after uploading a .nostrkey file) ───
    if (keyfilePayload) {
        return (
            <div className="login-container">
                <div className="login-card">
                    <div className="passkey-prompt-icon">
                        <Lock size={40} />
                    </div>

                    <h2 className="login-heading">{t('login.unlockYourKey')}</h2>

                    {keyfilePayload.npub && (
                        <p className="login-subtext" style={{ marginBottom: '0.25rem' }}>
                            {t('login.identity')}: <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{keyfilePayload.npub.slice(0, 16)}...{keyfilePayload.npub.slice(-6)}</span>
                        </p>
                    )}
                    {keyfileFilename && (
                        <p className="login-hint" style={{ marginBottom: '1rem' }}>{t('login.file')}: {keyfileFilename}</p>
                    )}

                    {error && (
                        <div className="error-banner">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleUnlockKeyfile} className="w-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="login-label">
                                {t('login.enterKeyFilePassword')}
                            </label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type={showUnlockPassword ? 'text' : 'password'}
                                    id="nostrkey-unlock-password"
                                    name="password"
                                    value={unlockPassword}
                                    onChange={(e) => setUnlockPassword(e.target.value)}
                                    placeholder={t('login.password')}
                                    className="login-input"
                                    style={{ paddingLeft: '0.75rem', paddingRight: '2.5rem' }}
                                    autoComplete="current-password"
                                    autoFocus
                                />
                                <button type="button" onClick={() => setShowUnlockPassword(!showUnlockPassword)} className="login-eye-btn">
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
                                <><Loader2 size={20} className="spin" /> {t('login.unlocking')}</>
                            ) : (
                                <><Lock size={20} /> {t('login.unlockAndLogIn')}</>
                            )}
                        </button>
                    </form>

                    <button onClick={resetKeyfileState} className="login-back-btn">
                        <ArrowLeft size={14} /> {t('login.chooseDifferentFile')}
                    </button>
                </div>

                <style jsx>{`
                    .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-gray-50); padding: 1rem; }
                    .login-card { background: var(--color-surface); color: var(--color-text, inherit); padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid var(--color-gray-200); width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; }
                    .login-heading { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--color-text, inherit); }
                    .login-subtext { font-size: 0.875rem; color: var(--color-gray-500); }
                    .login-hint { font-size: 0.75rem; color: var(--color-gray-500); }
                    .login-label { display: block; margin-bottom: 4px; font-size: 0.875rem; color: var(--color-gray-500); }
                    .login-input { width: 100%; padding: 0.75rem; border: 1px solid var(--color-gray-200); border-radius: 1rem; font-size: 0.875rem; outline: none; transition: border-color 0.2s; background: var(--color-surface); color: var(--color-text, inherit); }
                    .login-input:focus { border-color: var(--color-primary); }
                    .login-eye-btn { position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: var(--color-gray-500); padding: 4px; }
                    .login-back-btn { margin-top: 0.75rem; font-size: 0.875rem; color: var(--color-gray-500); display: flex; align-items: center; gap: 4px; background: none; border: none; cursor: pointer; }
                    .login-back-btn:hover { color: var(--color-primary); }
                    .passkey-prompt-icon { width: 72px; height: 72px; border-radius: 50%; background: var(--color-blue-tint); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; }
                    .btn-login { background: var(--color-primary); color: white; font-weight: 600; transition: all 0.2s; border: none; cursor: pointer; border-radius: 9999px; padding: 1rem 1.5rem; }
                    .btn-login:hover { opacity: 0.9; }
                    .btn-login:disabled { opacity: 0.5; cursor: not-allowed; }
                    .error-banner { display: flex; align-items: center; gap: 8px; background: var(--color-red-tint); color: var(--color-error); padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.875rem; width: 100%; margin-bottom: 1rem; border: 1px solid var(--badge-error-bg); }
                    .spin { animation: spin 1s linear infinite; }
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

                <h2 className="login-heading" style={{ fontSize: '1.5rem' }}>{t('login.welcomeBack')}</h2>
                <p className="login-subtext" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    {t('login.accessEcosystem')}
                </p>

                {error && (
                    <div className="error-banner">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Quick login methods — passkey always shown */}
                {(hasNostrExtension || PASSKEY_ENABLED) && (
                    <div className="quick-login-buttons">
                        {PASSKEY_ENABLED && (
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
                                <span>{t('login.loginWithPasskey')}</span>
                            </button>
                        )}
                        {hasNostrExtension && (
                            <button
                                onClick={handleExtensionLogin}
                                disabled={loading}
                                className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full"
                            >
                                {loading && !nsecInput.trim() ? (
                                    <Loader2 size={20} className="spin" />
                                ) : (
                                    <Globe size={20} />
                                )}
                                <span>{loading && !nsecInput.trim() ? t('common.connecting') : t('login.loginWithExtension')}</span>
                            </button>
                        )}
                    </div>
                )}

                {/* Divider between quick methods and manual methods */}
                {(hasNostrExtension || PASSKEY_ENABLED) && (
                    <div className="divider"><span>{t('common.or')}</span></div>
                )}

                {/* Login mode tabs */}
                <div className="mode-tabs">
                    <button
                        className={`mode-tab ${loginMode === 'nsec' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('nsec'); setError(''); }}
                    >
                        <Key size={14} /> {t('login.nsecKey')}
                    </button>
                    <button
                        className={`mode-tab ${loginMode === 'seed' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('seed'); setError(''); }}
                    >
                        <FileText size={14} /> {t('login.seedPhrase')}
                    </button>
                    <button
                        className={`mode-tab ${loginMode === 'file' ? 'active' : ''}`}
                        onClick={() => { setLoginMode('file'); setError(''); setKeyFileName(''); }}
                    >
                        <Upload size={14} /> {t('login.keyFile')}
                    </button>
                    {NIP46_ENABLED && (
                        <button
                            className={`mode-tab ${loginMode === 'bunker' ? 'active' : ''}`}
                            onClick={() => { setLoginMode('bunker'); setError(''); }}
                        >
                            <Smartphone size={14} /> {t('login.remote')}
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
                        <p className="login-hint" style={{ textAlign: 'center' }}>
                            Works with Amber, nsecBunker, and other NIP-46 signers
                        </p>
                    </form>
                )}

                {/* Create Account */}
                <div className="login-footer">
                    <p className="login-subtext" style={{ marginBottom: '0.5rem' }}>New to Nostr?</p>
                    <Link to="/signup" className="btn-create-account">
                        Create New Account
                    </Link>
                </div>

                {/* Demo login — TODO: Remove before production */}
                <div className="mt-4 w-full">
                    <button onClick={handleDemoLogin} disabled={loading} className="btn-demo">
                        {loading ? 'Logging in...' : 'Demo Login (skip auth)'}
                    </button>
                </div>

                {/* Extension hint — shown when no extension detected */}
                {!hasNostrExtension && (
                    <>
                        <div className="divider mt-4"><span>or</span></div>
                        <p className="login-subtext" style={{ textAlign: 'center' }}>
                            Have a Nostr browser extension?{' '}
                            <button
                                onClick={handleExtensionLogin}
                                disabled={loading}
                                className="login-link-btn"
                            >
                                Login with Extension
                            </button>
                        </p>
                        <div className="extension-links">
                            <p className="login-hint">No extension detected? Install one:</p>
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
                    min-height: calc(100vh - 150px);
                    min-height: calc(100dvh - 150px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                    padding: clamp(1rem, 3vh, 2rem) clamp(0.5rem, 2vh, 1rem);
                }
                .login-card {
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                    padding: clamp(1rem, 2.5vh, 2rem);
                    border-radius: 1.5rem;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
                    border: 1px solid var(--color-gray-200);
                    width: 100%;
                    max-width: 440px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .login-heading {
                    font-size: clamp(1.25rem, 3vh, 1.5rem);
                    font-weight: 700;
                    margin-bottom: clamp(0.25rem, 1vh, 0.5rem);
                    color: var(--color-text, inherit);
                }
                .login-subtext {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                }
                .login-hint {
                    font-size: 0.75rem;
                    color: var(--color-gray-500);
                }
                .login-label {
                    display: block;
                    margin-bottom: 4px;
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                }
                .login-footer {
                    margin-top: clamp(1rem, 3vh, 1.5rem);
                    padding-top: clamp(0.5rem, 1.5vh, 0.75rem);
                    border-top: 1px solid var(--color-gray-200);
                    width: 100%;
                    text-align: center;
                }
                .quick-login-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    width: 100%;
                }
                .btn-login {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                    border-radius: 9999px;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                }
                .btn-login:hover { opacity: 0.9; }
                .btn-login:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-passkey {
                    background: #1e1b4b;
                    color: white;
                    font-weight: 600;
                    transition: all 0.2s;
                    border: none;
                    cursor: pointer;
                    border-radius: 9999px;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                }
                .btn-passkey:hover { opacity: 0.9; }
                .btn-passkey:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-create-account {
                    display: block;
                    width: 100%;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                    background: var(--color-primary);
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    text-decoration: none;
                    text-align: center;
                    border-radius: 9999px;
                    transition: opacity 0.2s;
                }
                .btn-create-account:hover { opacity: 0.9; }
                .btn-demo {
                    display: block;
                    width: 100%;
                    padding: 0.75rem 1.5rem;
                    background: transparent;
                    color: var(--color-gray-500);
                    border: 1px dashed var(--color-gray-200);
                    border-radius: 9999px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-demo:hover { background: var(--color-gray-100); }
                .login-link-btn {
                    background: none;
                    border: none;
                    color: var(--color-primary);
                    font-weight: 500;
                    cursor: pointer;
                    padding: 0;
                    font-size: inherit;
                }
                .login-link-btn:hover { text-decoration: underline; }
                .divider {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 0.75rem 0;
                    color: var(--color-gray-500);
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
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    width: 100%;
                    gap: 0.75rem;
                    margin-bottom: clamp(0.75rem, 2vh, 1.5rem);
                }
                .mode-tab {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0.75rem 0.5rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 9999px;
                    background: transparent;
                    color: var(--color-gray-500);
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mode-tab:hover {
                    border-color: var(--color-gray-400);
                    color: var(--color-text, inherit);
                }
                .mode-tab.active {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: var(--color-blue-tint);
                    font-weight: 600;
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
                    color: var(--color-gray-500);
                    pointer-events: none;
                }
                .key-input {
                    width: 100%;
                    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 1rem;
                    font-size: 0.875rem;
                    outline: none;
                    transition: border-color 0.2s;
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                }
                .key-input:focus {
                    border-color: var(--color-primary);
                }
                .key-input::placeholder,
                .seed-input::placeholder {
                    color: var(--color-gray-500);
                }
                .seed-input {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 1rem;
                    font-size: 0.875rem;
                    font-family: monospace;
                    outline: none;
                    resize: none;
                    transition: border-color 0.2s;
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
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
                    border-radius: 0.75rem;
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
                    color: var(--color-primary);
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
                    border-radius: 0.75rem;
                    font-size: 0.875rem;
                    width: 100%;
                    margin-bottom: 1rem;
                    border: 1px solid var(--badge-error-bg);
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
