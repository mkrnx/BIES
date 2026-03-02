import React, { useState } from 'react';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Copy, Download, CheckCircle, ShieldAlert, ArrowRight } from 'lucide-react';

const Signup = () => {
    const { signup } = useAuth();
    const navigate = useNavigate();

    // Steps: 0 = Intro, 1 = Key Gen, 2 = Backup, 3 = Profile
    const [step, setStep] = useState(0);
    const [keys, setKeys] = useState(null); // { nsec, npub, sk, pk }
    const [profile, setProfile] = useState({ name: '', role: 'investor' });
    const [copied, setCopied] = useState(false);

    const generateKeys = () => {
        const sk = generateSecretKey(); // Returns Uint8Array
        const pk = getPublicKey(sk);

        const nsec = nip19.nsecEncode(sk);
        const npub = nip19.npubEncode(pk);

        setKeys({ sk, pk, nsec, npub });
        setStep(1);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleBackupConfirm = () => {
        setStep(2);
    };

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        if (!profile.name) return;

        // Register user in our mock backend
        signup({
            npub: keys.pk, // use hex for backend storage usually, or bech32 if preferred. Let's use hex for internal ID.
            npubBech32: keys.npub,
            name: profile.name,
            role: profile.role
        });

        // Redirect to dashboard (or onboarding)
        navigate('/dashboard');
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

                        <div className="key-box mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-gray-400">PUBLIC ID (Share this)</span>
                                <button onClick={() => copyToClipboard(keys.npub)} className="text-blue-500 text-xs">
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="bg-gray-100 p-3 rounded text-xs break-all font-mono">
                                {keys.npub}
                            </div>
                        </div>

                        <div className="key-box mb-6">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-red-400">SECRET KEY (Keep Safe!)</span>
                                <button onClick={() => copyToClipboard(keys.nsec)} className="text-blue-500 text-xs">
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="bg-red-50 p-3 rounded text-xs break-all font-mono border border-red-100 text-red-600">
                                {keys.nsec}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 btn-outline flex items-center justify-center gap-2">
                                <Download size={16} /> Save File
                            </button>
                            <button onClick={handleBackupConfirm} className="flex-1 btn-primary">
                                I've Saved It
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <form onSubmit={handleProfileSubmit} className="w-full">
                        <h2 className="text-2xl font-bold mb-6 text-center">Complete Profile</h2>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border rounded-lg"
                                placeholder="e.g. Satoshi Nakamoto"
                                value={profile.name}
                                onChange={e => setProfile({ ...profile, name: e.target.value })}
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label>
                            <div className="grid grid-cols-2 gap-4">
                                <div
                                    className={`role-card ${profile.role === 'investor' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'investor' })}
                                >
                                    <div className="font-bold">Investor</div>
                                    <div className="text-xs text-gray-500"> looking for opportunities</div>
                                </div>
                                <div
                                    className={`role-card ${profile.role === 'builder' ? 'active' : ''}`}
                                    onClick={() => setProfile({ ...profile, role: 'builder' })}
                                >
                                    <div className="font-bold">Builder</div>
                                    <div className="text-xs text-gray-500"> building project in El Salvador</div>
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
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                }
                .signup-card {
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
                    background: #e2e8f0;
                    color: #64748b;
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
                    background: #e2e8f0;
                    margin: 0 5px;
                }
                
                .btn-primary {
                    background: var(--color-primary);
                    color: white;
                    font-weight: 600;
                    transition: opacity 0.2s;
                }
                .btn-primary:hover { opacity: 0.9; }
                
                .btn-outline {
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    border-radius: 99px;
                }
                .btn-outline:hover { background: var(--color-gray-50); }

                .role-card {
                    border: 2px solid #e2e8f0;
                    border-radius: var(--radius-lg);
                    padding: 1rem;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                }
                .role-card.active {
                    border-color: var(--color-primary);
                    background: #eff6ff;
                }
            `}</style>
        </div>
    );
};

export default Signup;
