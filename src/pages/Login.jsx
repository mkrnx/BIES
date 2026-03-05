import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, Key, Globe, FileText } from 'lucide-react';
import logoIcon from '../assets/logo-icon.svg';
import NostrIcon from '../components/NostrIcon';

const Login = () => {
    const { loginWithNostrAndCheckNew, loginWithNsecAndCheckNew, loginWithSeedPhraseAndCheckNew } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [nsecInput, setNsecInput] = useState('');
    const [seedInput, setSeedInput] = useState('');
    const [loginMode, setLoginMode] = useState('nsec'); // 'nsec' or 'seed'
    const [hasNostrExtension, setHasNostrExtension] = useState(
        typeof window !== 'undefined' && !!window.nostr
    );

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

    const handleResult = (result) => {
        if (result.success) {
            if (result.needsProfileSetup) {
                navigate('/profile-setup');
            } else {
                navigate('/dashboard');
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

    const handleNsecLogin = async (e) => {
        e.preventDefault();
        if (!nsecInput.trim()) return;

        setError('');
        setLoading(true);
        try {
            const result = await loginWithNsecAndCheckNew(nsecInput);
            handleResult(result);
        } catch (err) {
            setError(err.message || 'Invalid nsec key or login failed.');
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

                {/* Login with Extension — first when detected */}
                {hasNostrExtension && (
                    <>
                        <button
                            onClick={handleExtensionLogin}
                            disabled={loading}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full mb-3"
                        >
                            {loading && !nsecInput.trim() ? (
                                <Loader2 size={20} className="spin" />
                            ) : (
                                <Globe size={20} />
                            )}
                            <span>{loading && !nsecInput.trim() ? 'Connecting...' : 'Login with Extension'}</span>
                        </button>
                        <div className="divider"><span>or</span></div>
                    </>
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
                </div>

                {/* Login with nsec */}
                {loginMode === 'nsec' && (
                    <form onSubmit={handleNsecLogin} className="w-full">
                        <div className="key-input-wrapper mb-3">
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
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full mb-3"
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
                    <form onSubmit={handleSeedLogin} className="w-full">
                        <textarea
                            placeholder="Enter your 12 or 24 word seed phrase..."
                            value={seedInput}
                            onChange={(e) => setSeedInput(e.target.value)}
                            className="seed-input mb-3"
                            autoComplete="off"
                            rows={3}
                        />
                        <button
                            type="submit"
                            disabled={loading || !seedInput.trim()}
                            className="w-full btn-login flex items-center justify-center gap-3 py-3 rounded-full mb-3"
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

                {/* Create Account */}
                <div className="mt-6 pt-6 border-t border-gray-100 w-full text-center">
                    <p className="text-gray-500 mb-4">New to Nostr?</p>
                    <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
                        Create New Account
                    </Link>
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
                    background: white;
                    padding: 3rem;
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-lg);
                    width: 100%;
                    max-width: 450px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
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
                .divider {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin: 0.75rem 0;
                    color: #9ca3af;
                    font-size: 0.875rem;
                }
                .divider::before,
                .divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: #e5e7eb;
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
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-md, 8px);
                    background: transparent;
                    color: #9ca3af;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .mode-tab:hover {
                    border-color: #d1d5db;
                    color: #6b7280;
                }
                .mode-tab.active {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                    background: #eff6ff;
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
                    color: #9ca3af;
                    pointer-events: none;
                }
                .key-input {
                    width: 100%;
                    padding: 0.75rem 0.75rem 0.75rem 2.5rem;
                    border: 1px solid #e5e7eb;
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
                    border: 1px solid #e5e7eb;
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
                .error-banner {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #FEF2F2;
                    color: var(--color-error);
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    width: 100%;
                    margin-bottom: 1rem;
                    border: 1px solid #FECACA;
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
