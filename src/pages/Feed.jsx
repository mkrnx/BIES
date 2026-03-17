import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Heart, Repeat, Share, Loader2, Send, Globe, Lock, Zap, TrendingUp, Flame, Clock, ChevronDown } from 'lucide-react';
import { nostrService, BIES_RELAY } from '../services/nostrService';
import { primalService, EXPLORE_VIEWS } from '../services/primalService';
import { nostrSigner } from '../services/nostrSigner';
import { useAuth } from '../context/AuthContext';
import NostrIcon from '../components/NostrIcon';
import { nip19 } from 'nostr-tools';

const EXPLORE_ICONS = {
    trending_24h: TrendingUp,
    trending_4h: Flame,
    mostzapped: Zap,
    popular: Heart,
    latest: Clock,
};

function formatCount(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

function formatSats(n) {
    if (!n) return '0';
    if (n >= 100000000) return (n / 100000000).toFixed(2).replace(/\.?0+$/, '') + ' BTC';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

const Feed = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [noteStats, setNoteStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [feedMode, setFeedMode] = useState('private'); // 'private' | 'explore'
    const [exploreView, setExploreView] = useState('trending_24h');
    const fetchedProfiles = useRef(new Set());

    // Compose state
    const [composeText, setComposeText] = useState('');
    const [broadcastPublic, setBroadcastPublic] = useState(false);
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState('');

    const currentView = EXPLORE_VIEWS.find(v => v.key === exploreView) || EXPLORE_VIEWS[0];

    // Sort notes based on the current explore view
    const sortNotes = useCallback((notes, stats, viewKey) => {
        const view = EXPLORE_VIEWS.find(v => v.key === viewKey);
        if (!view) return notes;

        return [...notes].sort((a, b) => {
            const sa = stats[a.id] || {};
            const sb = stats[b.id] || {};

            if (view.timeframe === 'trending') {
                return (sb.score24h || 0) - (sa.score24h || 0);
            } else if (view.timeframe === 'popular') {
                return (sb.score || 0) - (sa.score || 0);
            } else if (view.timeframe === 'mostzapped') {
                return (sb.satszapped || 0) - (sa.satszapped || 0);
            }
            return b.created_at - a.created_at;
        });
    }, []);

    // Subscribe to private relay feed
    useEffect(() => {
        if (feedMode !== 'private') return;

        setPosts([]);
        setProfiles({});
        setNoteStats({});
        setLoading(true);
        fetchedProfiles.current.clear();

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
                oneose: () => setLoading(false),
                onclose: () => setLoading(false),
                onauth: async (evt) => nostrSigner.signEvent(evt),
            }
        );

        return () => {
            clearTimeout(timeout);
            if (sub) sub.close();
        };
    }, [feedMode]);

    // Fetch explore feed from Primal
    useEffect(() => {
        if (feedMode !== 'explore') return;

        let cancelled = false;
        setPosts([]);
        setProfiles({});
        setNoteStats({});
        setLoading(true);

        (async () => {
            try {
                const result = await primalService.fetchExploreFeed(currentView, { limit: 30 });
                if (cancelled) return;

                setProfiles(result.profiles);
                setNoteStats(result.stats);
                setPosts(sortNotes(result.notes, result.stats, exploreView));
            } catch (err) {
                console.error('[Feed] Primal fetch failed:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [feedMode, exploreView, currentView, sortNotes]);

    // Load more for explore feed
    const handleLoadMore = async () => {
        if (loadingMore || feedMode !== 'explore' || posts.length === 0) return;
        setLoadingMore(true);
        try {
            const result = await primalService.loadMore(currentView, posts, noteStats, { limit: 20 });
            if (result.notes.length > 0) {
                setProfiles(prev => ({ ...prev, ...result.profiles }));
                setNoteStats(prev => {
                    const merged = { ...prev, ...result.stats };
                    const allNotes = [...posts, ...result.notes];
                    const deduped = allNotes.filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
                    setPosts(sortNotes(deduped, merged, exploreView));
                    return merged;
                });
            }
        } catch (err) {
            console.error('[Feed] Load more failed:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    const handlePost = async () => {
        if (!composeText.trim() || posting) return;

        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !window.nostr) {
            setPostError('Nostr signing not available. Please log in with an nsec key or browser extension to post.');
            return;
        }

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
            const msg = err?.errors?.[0]?.message || err?.message || String(err);
            setPostError(`Post failed: ${msg}`);
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

    const getStats = (noteId) => noteStats[noteId] || {};

    return (
        <div className="feed-page">
            <div className="feed-container">
                <div className="feed-header">
                    <h1 className="feed-title page-header">
                        <NostrIcon size={24} /> BIES Feed
                    </h1>
                </div>

                {/* Feed Mode Tabs */}
                <div className="feed-tabs" data-testid="feed-tabs">
                    <button
                        className={`feed-tab ${feedMode === 'private' ? 'active' : ''}`}
                        onClick={() => setFeedMode('private')}
                        data-testid="tab-private"
                    >
                        <Lock size={14} />
                        <span>Private Relay</span>
                    </button>
                    <button
                        className={`feed-tab ${feedMode === 'explore' ? 'active' : ''}`}
                        onClick={() => setFeedMode('explore')}
                        data-testid="tab-explore"
                    >
                        <Globe size={14} />
                        <span>Explore</span>
                    </button>
                </div>

                {/* Explore View Sub-Tabs */}
                {feedMode === 'explore' && (
                    <div className="explore-tabs" data-testid="explore-tabs">
                        {EXPLORE_VIEWS.map(view => {
                            const Icon = EXPLORE_ICONS[view.key];
                            return (
                                <button
                                    key={view.key}
                                    className={`explore-tab ${exploreView === view.key ? 'active' : ''}`}
                                    onClick={() => setExploreView(view.key)}
                                    data-testid={`explore-${view.key}`}
                                >
                                    <Icon size={13} />
                                    <span>{view.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

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
                            data-testid="compose-input"
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
                            data-testid="post-btn"
                        >
                            {posting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                            <span>{posting ? 'Posting...' : 'Post'}</span>
                        </button>
                    </div>
                </div>

                {/* Feed */}
                {loading && posts.length === 0 ? (
                    <div className="feed-loading" data-testid="feed-loading">
                        <Loader2 size={24} className="spin" />
                        <p>{feedMode === 'private' ? 'Connecting to BIES relay...' : 'Loading trending notes...'}</p>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="feed-empty" data-testid="feed-empty">
                        <NostrIcon size={40} />
                        <h3>No posts yet</h3>
                        <p>
                            {feedMode === 'private'
                                ? 'Be the first to post on the BIES private relay!'
                                : 'No trending posts found. Try a different view.'}
                        </p>
                        {feedMode === 'private' && (
                            <button className="try-public-btn" onClick={() => setFeedMode('explore')}>
                                <Globe size={14} /> Explore Nostr
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="feed-list" data-testid="feed-list">
                        {posts.map(post => {
                            const stats = getStats(post.id);
                            return (
                                <div key={post.id} className="feed-note" data-testid="feed-note">
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
                                        <button className="action-btn" title="Replies">
                                            <MessageCircle size={15} />
                                            <span>{formatCount(stats.replies)}</span>
                                        </button>
                                        <button className="action-btn" title="Reposts">
                                            <Repeat size={15} />
                                            <span>{formatCount(stats.reposts)}</span>
                                        </button>
                                        <button className="action-btn" title="Likes">
                                            <Heart size={15} />
                                            <span>{formatCount(stats.likes)}</span>
                                        </button>
                                        <button className="action-btn action-zap" title="Zaps">
                                            <Zap size={15} />
                                            <span>{formatSats(stats.satszapped)}</span>
                                        </button>
                                        <button className="action-btn action-share" title="Share">
                                            <Share size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load More */}
                        {feedMode === 'explore' && posts.length >= 10 && (
                            <button
                                className="load-more-btn"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? (
                                    <><Loader2 size={16} className="spin" /> Loading...</>
                                ) : (
                                    <><ChevronDown size={16} /> Load More</>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>

            <style jsx>{`
                .feed-page {
                    min-height: calc(100vh - 73px);
                    background: var(--color-gray-50, #f9fafb);
                    padding: 2rem 1rem;
                }
                @media (max-width: 768px) {
                    .feed-page {
                        padding: 0.5rem 1rem;
                    }
                }
                .feed-container {
                    max-width: 640px;
                    margin: 0 auto;
                }
                .feed-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 1rem;
                }
                .feed-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--color-gray-900);
                }

                /* Feed Mode Tabs */
                .feed-tabs {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    background: var(--color-gray-100);
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-xl, 12px);
                    padding: 0.25rem;
                }

                @media (max-width: 768px) {
                    .page-header { display: none !important; }
                }
                .feed-tab {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    padding: 0.625rem 1rem;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: transparent;
                    color: #9ca3af;
                }
                .feed-tab:hover {
                    color: #6b7280;
                    background: #f9fafb;
                }
                .feed-tab.active {
                    background: #7c3aed;
                    color: white;
                    box-shadow: 0 1px 3px rgba(124, 58, 237, 0.3);
                }
                .feed-tab.active:nth-child(2) {
                    background: #2563eb;
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
                }

                /* Explore Sub-Tabs */
                .explore-tabs {
                    display: flex;
                    gap: 0.375rem;
                    margin-bottom: 1.25rem;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    padding-bottom: 2px;
                }
                .explore-tabs::-webkit-scrollbar { display: none; }
                .explore-tab {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.4rem 0.75rem;
                    border-radius: 9999px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    border: 1px solid #e5e7eb;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: transparent;
                    color: #9ca3af;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .explore-tab:hover {
                    color: #6b7280;
                    border-color: #d1d5db;
                    background: #f9fafb;
                }
                .explore-tab.active {
                    background: #2563eb;
                    color: white;
                    border-color: #2563eb;
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
                }

                /* Compose Box */
                .compose-box {
                    background: var(--color-gray-100);
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
                .try-public-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    margin-top: 0.5rem;
                    padding: 0.5rem 1.25rem;
                    background: #2563eb;
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .try-public-btn:hover { opacity: 0.9; }
                .feed-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .feed-note {
                    background: var(--color-gray-100);
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
                    gap: 1.25rem;
                    padding-left: 52px;
                }
                .action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    color: #9ca3af;
                    font-size: 0.8rem;
                    transition: color 0.2s;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                }
                .action-btn:hover { color: #7c3aed; }
                .action-zap:hover { color: #f59e0b; }
                .action-share { margin-left: auto; }

                /* Load More */
                .load-more-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.375rem;
                    width: 100%;
                    padding: 0.75rem;
                    background: transparent;
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-xl, 12px);
                    color: #6b7280;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .load-more-btn:hover {
                    background: var(--color-gray-100);
                    border-color: #d1d5db;
                    color: #374151;
                }
                .load-more-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* Dark mode */
                :global([data-theme="dark"]) .feed-note {
                    background: #1e2a3a;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .feed-note:hover {
                    border-color: rgba(139, 92, 246, 0.4);
                }
                :global([data-theme="dark"]) .note-name {
                    color: #f1f5f9;
                }
                :global([data-theme="dark"]) .note-handle {
                    color: #64748b;
                }
                :global([data-theme="dark"]) .note-content {
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .action-btn {
                    color: #64748b;
                }
                :global([data-theme="dark"]) .compose-box {
                    background: #1e2a3a;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .compose-bottom {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .compose-input {
                    color: #f1f5f9;
                }
                :global([data-theme="dark"]) .feed-tabs {
                    background: #1e2a3a;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .feed-tab {
                    color: #94a3b8;
                }
                :global([data-theme="dark"]) .feed-tab:hover {
                    background: #2d3748;
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .feed-tab.active {
                    color: #ffffff;
                }
                :global([data-theme="dark"]) .explore-tab {
                    color: #94a3b8;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .explore-tab:hover {
                    background: #2d3748;
                    color: #e2e8f0;
                    border-color: #475569;
                }
                :global([data-theme="dark"]) .explore-tab.active {
                    color: #ffffff;
                    border-color: #2563eb;
                }
                :global([data-theme="dark"]) .relay-toggle.private {
                    color: #c4b5fd;
                    border-color: #4c3a7a;
                    background: rgba(124, 58, 237, 0.2);
                }
                :global([data-theme="dark"]) .relay-toggle.public {
                    color: #93c5fd;
                    border-color: #1e3a5f;
                    background: rgba(37, 99, 235, 0.2);
                }
                :global([data-theme="dark"]) .post-btn {
                    color: #ffffff;
                }
                :global([data-theme="dark"]) .load-more-btn {
                    border-color: #2d3748;
                    color: #94a3b8;
                }
                :global([data-theme="dark"]) .load-more-btn:hover {
                    background: #1e2a3a;
                    border-color: #475569;
                    color: #e2e8f0;
                }
            `}</style>
        </div>
    );
};

export default Feed;
