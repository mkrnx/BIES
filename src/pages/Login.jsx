import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, AlertCircle, Loader2, User } from 'lucide-react';
import logoIcon from '../assets/logo-icon.svg';

const Login = () => {
    const { loginWithNostrAndCheckNew, loginWithEmail } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const hasNostrExtension = typeof window !== 'undefined' && !!window.nostr;

    const handleLogin = async () => {
        setError('');
        setLoading(true);

        try {
            const result = await loginWithNostrAndCheckNew();

            if (result.success) {
                if (result.needsProfileSetup) {
                    navigate('/profile-setup');
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(result.error || 'Login failed. Please try again.');
            }
        } catch (err) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setError('');
        const result = await loginWithEmail('maria.santos@bies.dev', 'password123');
        if (result.success) {
            navigate('/dashboard');
        } else {
            setError(result.error || 'Failed to login with demo account');
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

                {hasNostrExtension ? (
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full btn-primary flex items-center justify-center gap-3 py-3 rounded-full mb-4"
                    >
                        {loading ? (
                            <Loader2 size={20} className="spin" />
                        ) : (
                            <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                        )}
                        <span>{loading ? 'Connecting...' : 'Connect with Nostr'}</span>
                    </button>
                ) : (
                    <div className="no-extension-notice">
                        <p className="text-sm text-gray-600 mb-3">
                            A Nostr browser extension is required to log in.
                        </p>
                        <a
                            href="https://getalby.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full btn-primary flex items-center justify-center gap-3 py-3 rounded-full mb-4"
                        >
                            <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                            <span>Get Alby Extension</span>
                        </a>
                    </div>
                )}

                <button
                    onClick={handleDemoLogin}
                    className="w-full btn-outline flex items-center justify-center gap-3 py-3 rounded-full mb-4 border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    <User size={20} />
                    <span>Demo Login (Builder Mode)</span>
                </button>

                <div className="text-sm text-center text-gray-500 mt-4">
                    Don't have an extension?{' '}
                    <a href="https://getalby.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        Get Alby
                    </a>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 w-full text-center">
                    <p className="text-gray-500 mb-4">New to Nostr?</p>
                    <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
                        Create New Account
                    </Link>
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
                .btn-primary {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                }
                .btn-primary:hover {
                    opacity: 0.9;
                }
                .btn-outline {
                    background: transparent;
                    font-weight: 600;
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
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
                .no-extension-notice {
                    width: 100%;
                    text-align: center;
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
