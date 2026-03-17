import React, { useState } from 'react';
import { getPublicKey, nip19 } from 'nostr-tools';
import { generateSeedWords, privateKeyFromSeedWords } from 'nostr-tools/nip06';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Download, CheckCircle, ShieldAlert, ArrowRight, AlertCircle, Fingerprint, Loader2, Lock, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { passkeyService } from '../services/passkeyService';
import { keyfileService } from '../services/keyfileService';

const Signup = () => {
    const { loginWithNsec, updateRole } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(0);
    const [keys, setKeys] = useState(null);
    const [profile, setProfile] = useState({ name: '', role: 'investor' });
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [logn, setLogn] = useState(16);
    const [encrypting, setEncrypting] = useState(false);
    const [downloadedFilename, setDownloadedFilename] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [savingPasskey, setSavingPasskey] = useState(false);
    const [passkeySaved, setPasskeySaved] = useState(false);

    const generateKeys = () => {
        const mnemonic = generateSeedWords();
        const sk = privateKeyFromSeedWords(mnemonic);
        const pk = getPublicKey(sk);
        const nsec = nip19.nsecEncode(sk);
        const npub = nip19.npubEncode(pk);
        setKeys({ sk, pk, nsec, npub, mnemonic });
        setStep(1);
    };

    const getPasswordStrength = () => {
        if (!password) return { label: '', color: '' };
        if (password.length < 8) return { label: 'Too short', color: '#ef4444' };
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);
        const variety = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
        if (password.length >= 12 && variety >= 3) return { label: 'Strong', color: '#22c55e' };
        if (password.length >= 8 && variety >= 2) return { label: 'Good', color: '#f59e0b' };
        return { label: 'Weak', color: '#ef4444' };
    };

    const handleEncryptAndDownload = async () => {
        setError('');
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        setEncrypting(true);
        try {
            await new Promise(r => setTimeout(r, 50));
            const { json, filename } = keyfileService.buildKeyfile(keys.sk, password, logn);
            keyfileService.triggerDownload(json, filename);
            setDownloadedFilename(filename);
            setPassword(''); setConfirmPassword('');
            setStep(2);
        } catch (err) {
            setError(err.message || 'Encryption failed. Please try again.');
        } finally { setEncrypting(false); }
    };

    const handleSavePasskey = async () => {
        if (!keys) return;
        setSavingPasskey(true); setError('');
        const originalPath = window.location.pathname;
        const loginPath = originalPath.replace(/\/signup\/?$/, '/login');
        if (loginPath !== originalPath) window.history.replaceState(null, '', loginPath);
        try {
            await passkeyService.saveWithPasskey(keys.nsec, keys.pk);
            setPasskeySaved(true);
        } catch (err) {
            if (!err.cancelled) setError(err.message || 'Failed to save passkey.');
        } finally {
            if (loginPath !== originalPath) window.history.replaceState(null, '', originalPath);
            setSavingPasskey(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        if (!profile.name || submitting) return;
        setError(''); setSubmitting(true);
        try {
            const result = await loginWithNsec(keys.nsec);
            if (result.success) {
                await updateRole(profile.role.toUpperCase());
                const { authService } = await import('../services/authService.js');
                await authService.completeNostrProfile({ name: profile.name });
                navigate('/dashboard');
            } else { setError(result.error || 'Failed to register. Please try again.'); }
        } catch (err) {
            setError(err?.message || 'Registration failed.');
        } finally { setSubmitting(false); }
    };

    const strength = getPasswordStrength();

    return (
        <div className="signup-container">
            <div className="signup-card">
                <div className="progress-bar mb-8">
                    {[0, 1, 2, 3].map((s, i) => (
                        <React.Fragment key={s}>
                            {i > 0 && <div className="line"></div>}
                            <div className={`step ${step >= s ? 'active' : ''}`}>{s + 1}</div>
                        </React.Fragment>
                    ))}
                </div>

                {step === 0 && (
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4">Create Your Identity</h2>
                        <p className="text-gray-500 mb-8">BIES uses Nostr-native authentication. Your private key will be encrypted and saved to a file. You'll use this file + a password to log in.</p>
                        <button onClick={generateKeys} className="btn-primary w-full py-3 rounded-full">Generate My Keys</button>
                        <div className="mt-4 text-sm text-gray-400">Already have keys? <Link to="/login" className="text-blue-500">Log in</Link></div>
                    </div>
                )}

                {step === 1 && keys && (
                    <div className="w-full">
                        <div className="text-center mb-6">
                            <div className="icon-circle mb-4"><Lock size={28} /></div>
                            <h2 className="text-xl font-bold mb-2">Encrypt Your Key</h2>
                            <p className="text-sm text-gray-500">Choose a password to encrypt your private key. You will need this password every time you log in.</p>
                        </div>
                        <div className="warning-box mb-6"><ShieldAlert size={16} style={{ flexShrink: 0 }} /><span>There is NO password recovery. If you lose your password AND your key file, your account is gone forever.</span></div>
                        {error && <div className="error-banner mb-4"><AlertCircle size={16} /><span>{error}</span></div>}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="password-wrapper">
                                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" className="password-input" autoComplete="new-password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                            </div>
                            {password && <div className="strength-bar mt-2"><div className="strength-fill" style={{ width: strength.label === 'Strong' ? '100%' : strength.label === 'Good' ? '66%' : '33%', background: strength.color }}></div><span className="text-xs ml-2" style={{ color: strength.color }}>{strength.label}</span></div>}
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                            <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="password-input" autoComplete="new-password" />
                            {confirmPassword && password !== confirmPassword && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>}
                        </div>
                        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="advanced-toggle mb-4"><ChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /> Advanced: encryption strength</button>
                        {showAdvanced && <div className="advanced-panel mb-4"><label className="block text-xs font-medium text-gray-500 mb-1">Scrypt cost (log_n) — higher = slower but more secure</label><select value={logn} onChange={(e) => setLogn(Number(e.target.value))} className="logn-select"><option value={16}>16 — Default (fast, 64 MiB)</option><option value={18}>18 — Stronger (slower, 256 MiB)</option><option value={20}>20 — Maximum (very slow, 1 GiB)</option></select></div>}
                        <button onClick={handleEncryptAndDownload} disabled={encrypting || password.length < 8 || password !== confirmPassword} className="w-full btn-primary py-3 rounded-full flex items-center justify-center gap-2">{encrypting ? <><Loader2 size={18} className="spin" /> Encrypting...</> : <><Download size={18} /> Create Account & Download Key File</>}</button>
                    </div>
                )}

                {step === 2 && (
                    <div className="w-full text-center">
                        <div className="icon-circle success mb-4"><CheckCircle size={28} /></div>
                        <h2 className="text-xl font-bold mb-2">Key File Downloaded</h2>
                        <p className="text-sm text-gray-500 mb-2">{downloadedFilename}</p>
                        <div className="warning-list mb-6">
                            <div className="warning-item"><ShieldAlert size={14} /> Store this file safely — USB drive, password manager, or encrypted cloud storage.</div>
                            <div className="warning-item"><ShieldAlert size={14} /> Remember your password — it is NOT stored anywhere.</div>
                            <div className="warning-item"><ShieldAlert size={14} /> There is NO recovery if both the file and password are lost.</div>
                        </div>
                        {error && <div className="error-banner mb-4"><AlertCircle size={16} /><span>{error}</span></div>}
                        {passkeyService.isSupported() && (
                            <div className="mb-4">
                                <button onClick={handleSavePasskey} disabled={savingPasskey || passkeySaved} className="w-full btn-outline py-3 rounded-full flex items-center justify-center gap-2">{passkeySaved ? <><CheckCircle size={16} style={{ color: '#22c55e' }} /> Passkey Saved</> : savingPasskey ? <><Loader2 size={16} className="spin" /> Saving...</> : <><Fingerprint size={16} /> Also Save to Passkey (Quick Login)</>}</button>
                                <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>Passkey encrypts your key on this device for quick login — it is not a backup.</p>
                            </div>
                        )}
                        <label className="confirm-checkbox mb-4"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I understand that I am responsible for keeping this file and password safe</span></label>
                        <button onClick={() => setStep(3)} disabled={!confirmed} className="w-full btn-primary py-3 rounded-full">Continue</button>
                    </div>
                )}

                {step === 3 && (
                    <form onSubmit={handleProfileSubmit} className="w-full">
                        <h2 className="text-2xl font-bold mb-6 text-center">Complete Profile</h2>
                        <p className="text-sm text-gray-500 mb-4 text-center">Set up your display name and role to get started.</p>
                        {error && <div className="error-banner mb-4"><AlertCircle size={16} /><span>{error}</span></div>}
                        <div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label><input type="text" required className="w-full p-3 border rounded-lg" placeholder="e.g. Satoshi Nakamoto" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></div>
                        <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">I am a...</label><div className="grid grid-cols-2 gap-4"><div className={`role-card ${profile.role === 'investor' ? 'active' : ''}`} onClick={() => setProfile({ ...profile, role: 'investor' })}><div className="font-bold">Investor</div><div className="text-xs text-gray-500"> looking for opportunities</div></div><div className={`role-card ${profile.role === 'builder' ? 'active' : ''}`} onClick={() => setProfile({ ...profile, role: 'builder' })}><div className="font-bold">Builder</div><div className="text-xs text-gray-500"> building project in El Salvador</div></div></div></div>
                        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 rounded-full flex items-center justify-center gap-2">{submitting ? <Loader2 size={18} className="spin" /> : null} Enter Dashboard <ArrowRight size={18} /></button>
                    </form>
                )}
            </div>
            <style jsx>{`
                .signup-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--color-gray-50); }
                .signup-card { background: white; padding: 3rem; border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); width: 100%; max-width: 500px; display: flex; flex-direction: column; align-items: center; }
                .progress-bar { display: flex; align-items: center; width: 100%; max-width: 260px; }
                .step { width: 30px; height: 30px; border-radius: 50%; background: #e2e8f0; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: bold; flex-shrink: 0; }
                .step.active { background: var(--color-primary); color: white; }
                .line { flex: 1; height: 2px; background: #e2e8f0; margin: 0 5px; }
                .icon-circle { width: 64px; height: 64px; border-radius: 50%; background: var(--color-blue-tint, #eff6ff); color: var(--color-primary); display: flex; align-items: center; justify-content: center; margin: 0 auto; }
                .icon-circle.success { background: #f0fdf4; color: #22c55e; }
                .warning-box { display: flex; align-items: flex-start; gap: 8px; background: #fffbeb; color: #92400e; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.8rem; border: 1px solid #fde68a; line-height: 1.4; }
                .error-banner { display: flex; align-items: center; gap: 8px; background: #FEF2F2; color: #EF4444; padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.875rem; width: 100%; border: 1px solid #FECACA; }
                .password-wrapper { position: relative; display: flex; align-items: center; }
                .password-input { width: 100%; padding: 0.75rem; padding-right: 2.5rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
                .password-input:focus { border-color: var(--color-primary); }
                .password-toggle { position: absolute; right: 10px; background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; }
                .strength-bar { display: flex; align-items: center; height: 4px; background: #e2e8f0; border-radius: 2px; position: relative; }
                .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
                .advanced-toggle { display: flex; align-items: center; gap: 6px; background: none; border: none; color: #64748b; font-size: 0.8rem; cursor: pointer; padding: 0; }
                .advanced-toggle:hover { color: #334155; }
                .advanced-panel { background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0; }
                .logn-select { width: 100%; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 0.8rem; background: white; }
                .warning-list { display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
                .warning-item { display: flex; align-items: flex-start; gap: 8px; font-size: 0.8rem; color: #92400e; line-height: 1.4; }
                .confirm-checkbox { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; font-size: 0.85rem; color: #334155; text-align: left; }
                .confirm-checkbox input { margin-top: 3px; flex-shrink: 0; }
                .btn-primary { background: var(--color-primary); color: white; font-weight: 600; transition: opacity 0.2s; border: none; cursor: pointer; }
                .btn-primary:hover { opacity: 0.9; }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-outline { border: 1px solid #e2e8f0; color: #64748b; border-radius: 99px; background: transparent; cursor: pointer; }
                .btn-outline:hover { background: var(--color-gray-50); }
                .btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
                .role-card { border: 2px solid #e2e8f0; border-radius: var(--radius-lg); padding: 1rem; cursor: pointer; text-align: center; transition: all 0.2s; }
                .role-card.active { border-color: var(--color-primary); background: #eff6ff; }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default Signup;
