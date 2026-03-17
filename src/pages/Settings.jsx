import React, { useState } from 'react';
import { Moon, Bell, Lock, Globe, Eye, Zap, Download, Loader2, CheckCircle, EyeOff, AlertCircle } from 'lucide-react';
import WalletConnect from '../components/WalletConnect';
import { useTheme } from '../context/ThemeContext';
import { nostrSigner } from '../services/nostrSigner';
import { keyfileService } from '../services/keyfileService';
import { nip19 } from 'nostr-tools';

const ExportKeyfile = () => {
    const [showForm, setShowForm] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exported, setExported] = useState(false);
    const [error, setError] = useState('');
    const canExport = nostrSigner.hasKey;

    const handleExport = async () => {
        setError('');
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        setExporting(true);
        try {
            await new Promise(r => setTimeout(r, 50));
            const nsec = nip19.nsecEncode(nostrSigner._sk);
            keyfileService.encryptAndDownload(nsec, password);
            setPassword(''); setConfirmPassword('');
            setExported(true);
            setTimeout(() => { setExported(false); setShowForm(false); }, 3000);
        } catch (err) { setError(err.message || 'Export failed.'); }
        finally { setExporting(false); }
    };

    if (!canExport) return null;

    return (
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div className="setting-info">
                    <div className="icon-box"><Download size={20} /></div>
                    <div>
                        <p className="setting-label">Export Encrypted Key File</p>
                        <p className="setting-desc">Download a password-encrypted .nostrkey backup</p>
                    </div>
                </div>
                {!showForm && <button className="btn btn-outline btn-sm" onClick={() => setShowForm(true)}>Export</button>}
            </div>
            {showForm && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md, 8px)' }}>
                    {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', color: '#EF4444', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', marginBottom: '0.75rem', border: '1px solid #FECACA' }}><AlertCircle size={14} /><span>{error}</span></div>}
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>Password</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 8 characters" style={{ width: '100%', padding: '0.5rem', paddingRight: '2.25rem', border: '1px solid var(--color-gray-200)', borderRadius: 6, fontSize: '0.85rem' }} autoComplete="new-password" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                        </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: 4 }}>Confirm Password</label>
                        <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--color-gray-200)', borderRadius: 6, fontSize: '0.85rem' }} autoComplete="new-password" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleExport} disabled={exporting || password.length < 8 || password !== confirmPassword} style={{ flex: 1, padding: '0.5rem 1rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', opacity: (exporting || password.length < 8 || password !== confirmPassword) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{exported ? <><CheckCircle size={14} /> Downloaded</> : exporting ? <><Loader2 size={14} className="spin" /> Encrypting...</> : <><Download size={14} /> Download .nostrkey</>}</button>
                        <button onClick={() => { setShowForm(false); setPassword(''); setConfirmPassword(''); setError(''); }} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--color-gray-200)', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', color: 'var(--color-gray-500)' }}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const Settings = () => {
    const { theme, setTheme } = useTheme();
    return (
        <div className="container py-8 max-w-3xl">
            <h1 className="mb-8">Settings</h1>
            <div className="settings-section"><h2><Zap size={16} /> Lightning Wallet</h2><div className="setting-item"><WalletConnect /></div></div>
            <div className="settings-section">
                <h2>Preferences</h2>
                <div className="setting-item"><div className="setting-info"><div className="icon-box"><Moon size={20} /></div><div><p className="setting-label">Dark Mode</p><p className="setting-desc">Switch between light and dark themes</p></div></div><select className="select-input" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
                <div className="setting-item"><div className="setting-info"><div className="icon-box"><Globe size={20} /></div><div><p className="setting-label">Language</p><p className="setting-desc">Select your preferred language</p></div></div><select className="select-input"><option>English</option><option>Español</option></select></div>
            </div>
            <div className="settings-section">
                <h2>Notifications</h2>
                <div className="setting-item"><div className="setting-info"><div className="icon-box"><Bell size={20} /></div><div><p className="setting-label">Email Notifications</p><p className="setting-desc">Receive updates about your projects</p></div></div><button className="toggle-btn active">On</button></div>
                <div className="setting-item"><div className="setting-info"><div className="icon-box"><Eye size={20} /></div><div><p className="setting-label">Profile Visibility</p><p className="setting-desc">Allow others to see your profile activity</p></div></div><button className="toggle-btn active">On</button></div>
            </div>
            <div className="settings-section">
                <h2>Security</h2>
                <ExportKeyfile />
                <div className="setting-item"><div className="setting-info"><div className="icon-box"><Lock size={20} /></div><div><p className="setting-label">Change Password</p><p className="setting-desc">Update your account password</p></div></div><button className="btn btn-outline btn-sm">Update</button></div>
            </div>
            <style jsx>{`
                .max-w-3xl { max-width: 48rem; }
                .settings-section { background: var(--color-surface); border: 1px solid var(--color-gray-200); border-radius: var(--radius-lg); overflow: hidden; margin-bottom: 2rem; }
                .settings-section h2 { padding: 1rem 1.5rem; background: var(--color-gray-50); border-bottom: 1px solid var(--color-gray-200); font-size: 1rem; color: var(--color-gray-600); }
                .setting-item { padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--color-gray-100); }
                .setting-item:last-child { border-bottom: none; }
                .setting-info { display: flex; align-items: center; gap: 1rem; }
                .icon-box { width: 40px; height: 40px; background: var(--color-gray-100); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--color-gray-600); }
                .setting-label { font-weight: 600; margin-bottom: 2px; }
                .setting-desc { font-size: 0.85rem; color: var(--color-gray-500); }
                .toggle-btn { padding: 0.5rem 1rem; border-radius: 99px; border: 1px solid var(--color-gray-300); background: var(--color-surface); color: var(--color-gray-500); font-size: 0.85rem; cursor: pointer; width: 60px; }
                .toggle-btn.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
                .select-input { padding: 0.5rem; border-radius: var(--radius-md); border: 1px solid var(--color-gray-300); }
                .btn-sm { font-size: 0.85rem; padding: 0.5rem 1rem; }
            `}</style>
        </div>
    );
};

export default Settings;
