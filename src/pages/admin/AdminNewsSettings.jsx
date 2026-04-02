import React, { useState, useEffect } from 'react';
import { Loader2, Plus, X, Save } from 'lucide-react';
import { newsApi } from '../../services/api';
import { nip19 } from 'nostr-tools';

const AdminNewsSettings = () => {
    const [npubs, setNpubs] = useState([]);
    const [handles, setHandles] = useState([]);
    const [livestreamUrl, setLivestreamUrl] = useState('');
    const [livestreamActive, setLivestreamActive] = useState(false);
    const [newNpub, setNewNpub] = useState('');
    const [newHandle, setNewHandle] = useState('');
    const [npubError, setNpubError] = useState('');
    const [handleError, setHandleError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState(null);

    useEffect(() => {
        newsApi.settings()
            .then(res => {
                setNpubs(res?.nostrNpubs || []);
                setHandles(res?.twitterHandles || []);
                setLivestreamUrl(res?.livestreamUrl || '');
                setLivestreamActive(res?.livestreamActive || false);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const addNpub = () => {
        const val = newNpub.trim();
        if (!val) return;
        if (!val.startsWith('npub1')) {
            setNpubError('Must start with npub1');
            return;
        }
        try {
            nip19.decode(val);
        } catch {
            setNpubError('Invalid npub checksum');
            return;
        }
        if (npubs.includes(val)) {
            setNpubError('Already added');
            return;
        }
        setNpubs(prev => [...prev, val]);
        setNewNpub('');
        setNpubError('');
    };

    const addHandle = () => {
        const val = newHandle.trim().replace(/^@/, '');
        if (!val) return;
        if (!/^[a-zA-Z0-9_]{1,15}$/.test(val)) {
            setHandleError('Invalid handle (letters, numbers, underscore, max 15 chars)');
            return;
        }
        if (handles.includes(val)) {
            setHandleError('Already added');
            return;
        }
        setHandles(prev => [...prev, val]);
        setNewHandle('');
        setHandleError('');
    };

    const save = async () => {
        setSaving(true);
        setStatus(null);
        try {
            await newsApi.updateSettings({ nostrNpubs: npubs, twitterHandles: handles, livestreamUrl, livestreamActive });
            setStatus({ type: 'success', message: 'Settings saved.' });
        } catch {
            setStatus({ type: 'error', message: 'Failed to save settings.' });
        } finally {
            setSaving(false);
        }
    };

    const extractVideoId = (url) => {
        if (!url) return '';
        const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match?.[1] || '';
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
        );
    }

    return (
        <>
            <div className="header">
                <div>
                    <h1>News Feed Settings</h1>
                    <p className="subtitle">Configure social feeds displayed on the News page</p>
                </div>
                <button className="btn btn-primary" onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                    Save Settings
                </button>
            </div>

            {status && (
                <div className={`status-msg ${status.type}`}>
                    {status.message}
                </div>
            )}

            {/* Nostr Npubs */}
            <div className="settings-card">
                <h3>Nostr Accounts</h3>
                <p className="card-desc">Public keys (npub) of Nostr accounts to display in the Social Pulse feed.</p>

                <div className="items-list">
                    {npubs.map((npub, i) => (
                        <div key={i} className="item-row">
                            <code className="item-value">{npub.slice(0, 20)}...{npub.slice(-8)}</code>
                            <button className="btn-icon" onClick={() => setNpubs(prev => prev.filter((_, idx) => idx !== i))}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="add-row">
                    <input
                        type="text"
                        placeholder="npub1..."
                        value={newNpub}
                        onChange={(e) => { setNewNpub(e.target.value); setNpubError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && addNpub()}
                    />
                    <button className="btn btn-outline" onClick={addNpub}>
                        <Plus size={14} /> Add
                    </button>
                </div>
                {npubError && <p className="field-error">{npubError}</p>}
            </div>

            {/* Twitter/X Handles */}
            <div className="settings-card">
                <h3>X / Twitter Accounts</h3>
                <p className="card-desc">Handles of X accounts whose posts will appear in the X feed column.</p>

                <div className="items-list">
                    {handles.map((handle, i) => (
                        <div key={i} className="item-row">
                            <span className="item-value">@{handle}</span>
                            <button className="btn-icon" onClick={() => setHandles(prev => prev.filter((_, idx) => idx !== i))}>
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="add-row">
                    <input
                        type="text"
                        placeholder="@handle"
                        value={newHandle}
                        onChange={(e) => { setNewHandle(e.target.value); setHandleError(''); }}
                        onKeyDown={(e) => e.key === 'Enter' && addHandle()}
                    />
                    <button className="btn btn-outline" onClick={addHandle}>
                        <Plus size={14} /> Add
                    </button>
                </div>
                {handleError && <p className="field-error">{handleError}</p>}
            </div>

            {/* Livestream */}
            <div className="settings-card">
                <h3>Livestream</h3>
                <p className="card-desc">Paste a YouTube video/livestream URL. Toggle "Active" to show it on the Media page.</p>

                <div className="livestream-row">
                    <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={livestreamUrl}
                        onChange={(e) => setLivestreamUrl(e.target.value)}
                        className="livestream-input"
                    />
                    <label className="toggle-label">
                        <input
                            type="checkbox"
                            checked={livestreamActive}
                            onChange={(e) => setLivestreamActive(e.target.checked)}
                        />
                        Active
                    </label>
                </div>

                {livestreamUrl && extractVideoId(livestreamUrl) && (
                    <p className="video-id-preview">✓ Video ID: {extractVideoId(livestreamUrl)}</p>
                )}
                {livestreamUrl && !extractVideoId(livestreamUrl) && (
                    <p className="field-error">⚠ No valid YouTube URL detected</p>
                )}
            </div>

            <style jsx>{`
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 2rem;
                }
                .header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
                .subtitle { color: var(--color-gray-500); font-size: 0.9rem; }

                .status-msg {
                    padding: 0.75rem 1rem;
                    border-radius: var(--radius-md);
                    margin-bottom: 1.5rem;
                    font-size: 0.9rem;
                }
                .status-msg.success { background: var(--color-green-tint); color: var(--badge-success-text); border: 1px solid var(--badge-success-bg); }
                .status-msg.error { background: var(--color-red-tint); color: var(--badge-error-text); border: 1px solid var(--badge-error-bg); }

                .settings-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .settings-card h3 { font-size: 1.1rem; margin-bottom: 0.25rem; }
                .card-desc { color: var(--color-gray-500); font-size: 0.85rem; margin-bottom: 1rem; }

                .items-list { margin-bottom: 1rem; }
                .item-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem 0.75rem;
                    background: var(--color-gray-50);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    margin-bottom: 0.5rem;
                }
                .item-value { font-size: 0.85rem; }
                code.item-value { font-family: monospace; font-size: 0.8rem; }

                .btn-icon {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-gray-400);
                    padding: 4px;
                    border-radius: 4px;
                    display: flex;
                }
                .btn-icon:hover { color: var(--color-error); background: var(--color-red-tint); }

                .add-row {
                    display: flex;
                    gap: 0.5rem;
                }
                .add-row input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                }
                .add-row input:focus { outline: none; border-color: var(--color-primary); }

                .btn-outline {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    cursor: pointer;
                    font-size: 0.85rem;
                }
                .btn-outline:hover { background: var(--color-gray-50); }

                .field-error { color: var(--color-error); font-size: 0.8rem; margin-top: 0.25rem; }

                .livestream-row {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }
                .livestream-input {
                    flex: 1;
                    padding: 0.5rem 0.75rem;
                    border: 1px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.9rem;
                }
                .livestream-input:focus { outline: none; border-color: var(--color-primary); }

                .toggle-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    font-weight: 500;
                }
                .toggle-label input[type="checkbox"] {
                    cursor: pointer;
                    width: 18px;
                    height: 18px;
                }

                .video-id-preview {
                    color: var(--color-success);
                    font-size: 0.85rem;
                    margin-top: 0.5rem;
                }
                @media (max-width: 768px) {
                    .header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
                    .header h1 { font-size: 1.25rem; }
                    .livestream-row { flex-direction: column; align-items: stretch; }
                    .livestream-input { width: 100%; }
                    .add-row input,
                    .livestream-input { min-height: 44px; font-size: 1rem; }
                    .btn-outline,
                    .btn-icon { min-height: 44px; min-width: 44px; }
                    .settings-card { padding: 1rem; }
                    .toggle-label input[type="checkbox"] { width: 22px; height: 22px; }
                }
            `}</style>
        </>
    );
};

export default AdminNewsSettings;
