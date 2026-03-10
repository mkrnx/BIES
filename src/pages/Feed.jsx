import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Heart, Repeat, Share, Loader2, Send, Globe, Lock } from 'lucide-react';
import { nostrService, BIES_RELAY } from '../services/nostrService';
import { nostrSigner } from '../services/nostrSigner';
import { useAuth } from '../context/AuthContext';
import NostrIcon from '../components/NostrIcon';
import { nip19 } from 'nostr-tools';

const Feed = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(true);
    const fetchedProfiles = useRef(new Set());

    // Compose state
    const [composeText, setComposeText] = useState('');
    const [broadcastPublic, setBroadcastPublic] = useState(false);
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState('');

    useEffect(() => {
        setLoading(true);
        const timeout = setTimeout(() => setLoading(false), 15000);

        const sub = nostrService.pool.subscribeMany(
            [BIES_RELAY],
            { kinds: [1], limit: 50 },
            {
                onevent: async (event) => {
                    if (!fetchedProfiles.current.has(event.pubkey)) {
                        fetchedProfiles.current.add(event.pubkey);
                        const profile = await nostrService.getProfile(event.pubkey);
                        if (profile) {
                            setProfiles(prev => ({ ...prev, [event.pubkey]: profile }));
                        }
                    }

                    setPosts(prev => {
                        if (prev.find(p => p.id === event.id)) return prev;
                        return [...prev, event].sort((a, b) => b.created_at - a.created_at);
                    });
                    clearTimeout(timeout);
                    setLoading(false);
                },
                onclose: () => setLoading(false),
                onauth: async (evt) => nostrSigner.signEvent(evt),
            }
        );

        return () => {
            clearTimeout(timeout);
            if (sub) sub.close();
        };
    }, []);

    const handlePost = async () => {
        if (!composeText.trim() || posting) return;
        setPosting(true);
        setPostError('');

        try {
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['t', 'bies']],
                content: composeText.trim(),
            };

            if (broadcastPublic) {
                await nostrService.publishEvent(event);
            } else {
                await nostrService.publishToBiesRelay(event);
            }

            setComposeText('');
        } catch (err) {
            console.error('[Feed] Post failed:', err);
            setPostError('Failed to post. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handlePost();
        }
    };

    const formatTime = (timestamp) => {
        const diff = Math.floor(Date.now() / 1000) - timestamp;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
        return `${Math.floor(diff / 86400)}d`;
    };

    const getDisplayName = (pubkey) => {
        const profile = profiles[pubkey];
        if (profile?.display_name) return profile.display_name;
        if (profile?.name) return profile.name;
        try {
            const npub = nip19.npubEncode(pubkey);
            return npub.substring(0, 12) + '...';
        } catch {
            return pubkey.substring(0, 12) + '...';
        }
    };

    const getHandle = (pubkey) => {
        const profile = profiles[pubkey];
        if (profile?.name) return `@${profile.name}`;
        return '';
    };

    const getAvatar = (pubkey) => {
        return profiles[pubkey]?.picture || null;
    };

    return (
        <div className="feed-page">
            <div className="feed-container">
                <div className="feed-header">
                    <h1 className="feed-title">
                        <NostrIcon size={24} /> BIES Feed
                    </h1>
                    <span className="relay-badge">Private Relay</span>
                </div>

                {/* Compose Box */}
                <div className="compose-box">
                    <div className="compose-top">
                        <div className="compose-avatar">
                            {user?.profile?.avatar ? (
                                <img src={user.profile.avatar} alt="" />
                            ) : (
                                <NostrIcon size={18} />
                            )}
                        </div>
                        <textarea
                            className="compose-input"
                            placeholder="What's happening on BIES?"
                            value={composeText}
                            onChange={(e) => setComposeText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={3}
                        />
                    </div>
                    {postError && <div className="compose-error">{postError}</div>}
                    <div className="compose-bottom">
                        <button
                            className={`relay-toggle ${broadcastPublic ? 'public' : 'private'}`}
                            onClick={() => setBroadcastPublic(!broadcastPublic)}
                            title={broadcastPublic ? 'Broadcasting to all relays' : 'Private relay only'}
                        >
                            {broadcastPublic ? <Globe size={14} /> : <Lock size={14} />}
                            <span>{broadcastPublic ? 'Public' : 'Private'}</span>
                        </button>
                        <button
                            className="post-btn"
                            onClick={handlePost}
                            disabled={!composeText.trim() || posting}
                        >
                            {posting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                            <span>{posting ? 'Posting...' : 'Post'}</span>
                        </button>
                    </div>
                </div>

                {/* Feed */}
                {loading && posts.length === 0 ? (
                    <div className="feed-loading">
                        <Loader2 size={24} className="spin" />
                        <p>Connecting to BIES relay...</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="feed-empty">
                        <NostrIcon size={40} />
                        <h3>No posts yet</h3>
                        <p>Be the first to post on the BIES private relay!</p>
                    </div>
                ) : (
                    <div className="feed-list">
                        {posts.map(post => (
                            <div key={post.id} className="feed-note">
                                <div className="note-header">
                                    <div className="note-avatar">
                                        {getAvatar(post.pubkey) ? (
                                            <img src={getAvatar(post.pubkey)} alt="" />
                                        ) : (
                                            <NostrIcon size={18} />
                                        )}
                                    </div>
                                    <div className="note-meta">
                                        <span className="note-name">{getDisplayName(post.pubkey)}</span>
                                        <span className="note-handle">{getHandle(post.pubkey)} · {formatTime(post.created_at)}</span>
                                    </div>
                                </div>
                                <div className="note-content">{post.content}</div>
                                <div className="note-actions">
                                    <button className="action-btn"><MessageCircle size={15} /> <span>0</span></button>
                                    <button className="action-btn"><Repeat size={15} /> <span>0</span></button>
                                    <button className="action-btn"><Heart size={15} /> <span>0</span></button>
                                    <button className="action-btn action-share"><Share size={15} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .feed-page {
                    min-height: calc(100vh - 73px);
                    background: var(--color-gray-50, #f9fafb);
                    padding: 2rem 1rem;
                }
                .feed-container {
                    max-width: 640px;
                    margin: 0 auto;
                }
                .feed-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1.5rem;
                }
                .feed-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--color-neutral-dark, #1f2937);
                }
                .relay-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    background: #ede9fe;
                    color: #7c3aed;
                    padding: 0.25rem 0.75rem;
                    border-radius: 9999px;
                    border: 1px solid #ddd6fe;
                }

                /* Compose Box */
                .compose-box {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-xl, 12px);
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                }
                .compose-top {
                    display: flex;
                    gap: 0.75rem;
                }
                .compose-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ede9fe, #f5f3ff);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #7c3aed;
                    border: 1px solid #ddd6fe;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .compose-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .compose-input {
                    flex: 1;
                    border: none;
                    outline: none;
                    resize: none;
                    font-size: 0.95rem;
                    font-family: inherit;
                    line-height: 1.5;
                    color: #1f2937;
                    background: transparent;
                }
                .compose-input::placeholder {
                    color: #9ca3af;
                }
                .compose-error {
                    color: var(--color-error, #ef4444);
                    font-size: 0.8rem;
                    padding: 0.25rem 0 0.25rem 52px;
                }
                .compose-bottom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 0.75rem;
                    margin-top: 0.5rem;
                    border-top: 1px solid #f3f4f6;
                }
                .relay-toggle {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.375rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    border: 1px solid;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: transparent;
                }
                .relay-toggle.private {
                    color: #7c3aed;
                    border-color: #ddd6fe;
                    background: #f5f3ff;
                }
                .relay-toggle.private:hover {
                    background: #ede9fe;
                }
                .relay-toggle.public {
                    color: #2563eb;
                    border-color: #bfdbfe;
                    background: #eff6ff;
                }
                .relay-toggle.public:hover {
                    background: #dbeafe;
                }
                .post-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    padding: 0.5rem 1.25rem;
                    background: var(--color-primary, #1e40af);
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .post-btn:hover { opacity: 0.9; }
                .post-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Feed */
                .feed-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 4rem 1rem;
                    color: #9ca3af;
                }
                .feed-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 4rem 1rem;
                    color: #9ca3af;
                    text-align: center;
                }
                .feed-empty h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #6b7280;
                }
                .feed-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .feed-note {
                    background: white;
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-xl, 12px);
                    padding: 1.25rem;
                    transition: box-shadow 0.2s, border-color 0.2s;
                }
                .feed-note:hover {
                    box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1));
                    border-color: #ddd6fe;
                }
                .note-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                }
                .note-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ede9fe, #f5f3ff);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #7c3aed;
                    border: 1px solid #ddd6fe;
                    overflow: hidden;
                    flex-shrink: 0;
                }
                .note-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .note-meta {
                    display: flex;
                    flex-direction: column;
                }
                .note-name {
                    font-weight: 600;
                    color: #1f2937;
                    font-size: 0.9rem;
                    line-height: 1.2;
                }
                .note-handle {
                    font-size: 0.8rem;
                    color: #9ca3af;
                }
                .note-content {
                    color: #374151;
                    line-height: 1.6;
                    font-size: 0.95rem;
                    padding-left: 52px;
                    margin-bottom: 0.75rem;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .note-actions {
                    display: flex;
                    gap: 1.5rem;
                    padding-left: 52px;
                }
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    color: #9ca3af;
                    font-size: 0.8rem;
                    transition: color 0.2s;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                }
                .action-btn:hover { color: #7c3aed; }
                .action-share { margin-left: auto; }
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

export default Feed;
