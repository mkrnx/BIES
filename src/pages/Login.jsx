import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Lock } from 'lucide-react';
import logoIcon from '../assets/logo-icon.svg';

const Login = () => {
    const { loginWithNostr } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleLogin = async () => {
        setError('');
        const result = await loginWithNostr();

        if (result === true) {
            navigate('/dashboard'); // Direct to dashboard if existing user
        } else if (result && result.needsSignup) {
            // Redirect to signup but with pre-filled npub (not implemented yet, just general signup for now)
            navigate('/signup?npub=' + result.npub);
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

                <button
                    onClick={handleLogin}
                    className="w-full btn-primary flex items-center justify-center gap-3 py-3 rounded-full mb-4"
                >
                    <Zap size={20} className="text-yellow-400 fill-yellow-400" />
                    <span>Connect with Nostr</span>
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
            `}</style>
        </div>
    );
};

export default Login;
