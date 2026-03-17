import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Heart, Repeat, Share, Loader2, Send, Globe, Lock, Zap, TrendingUp, Flame, Clock, ChevronDown, Calendar, X, ImagePlus } from 'lucide-react';
import { nostrService, BIES_RELAY } from '../services/nostrService';
import { primalService, EXPLORE_VIEWS } from '../services/primalService';
import { nostrSigner } from '../services/nostrSigner';
import { blossomService } from '../services/blossomService';
import { useAuth } from '../context/AuthContext';
import NostrIcon from '../components/NostrIcon';
import ZapModal from '../components/ZapModal';
import { nip19 } from 'nostr-tools';

const EXPLORE_ICONS = {
    trending_24h: TrendingUp,
    trending_4h: Flame,
    trending_48h: Calendar,
    trending_7d: TrendingUp,
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
    const [attachedFiles, setAttachedFiles] = useState([]); // { file, previewUrl, type, dimensions }
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Interaction state
    const [likedNotes, setLikedNotes] = useState(new Set());
    const [repostedNotes, setRepostedNotes] = useState(new Set());
    const [replyTarget, setReplyTarget] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [replyPosting, setReplyPosting] = useState(false);
    const [zapTarget, setZapTarget] = useState(null);

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

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        setPostError('');

        const newAttachments = [];
        for (const file of files) {
            const err = blossomService.validateFile(file, attachedFiles.length + newAttachments.length);
            if (err) {
                setPostError(err);
                break;
            }
            const dimensions = await blossomService.getImageDimensions(file);
            newAttachments.push({
                file,
                previewUrl: URL.createObjectURL(file),
                type: file.type,
                dimensions,
            });
        }

        if (newAttachments.length > 0) {
            setAttachedFiles(prev => [...prev, ...newAttachments]);
        }
    };

    const removeAttachment = (index) => {
        setAttachedFiles(prev => {
            const updated = [...prev];
            URL.revokeObjectURL(updated[index].previewUrl);
            updated.splice(index, 1);
            return updated;
        });
    };

    const handlePost = async () => {
        if ((!composeText.trim() && attachedFiles.length === 0) || posting || uploading) return;

        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !window.nostr) {
            setPostError('Nostr signing not available. Please log in with an nsec key or browser extension to post.');
            return;
        }

        setPosting(true);
        setPostError('');

        try {
            let content = composeText.trim();
            const tags = [['t', 'bies']];

            if (attachedFiles.length > 0) {
                setUploading(true);
                const uploadResults = await Promise.all(
                    attachedFiles.map(a => blossomService.uploadFile(a.file))
                );

                const urls = uploadResults.map(r => r.url);
                if (content) content += '\n';
                content += urls.join('\n');

                uploadResults.forEach((result, i) => {
                    tags.push(blossomService.buildImetaTag(result, attachedFiles[i].file, attachedFiles[i].dimensions));
                });
            }

            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags,
                content,
            };

            if (broadcastPublic) {
                await nostrService.publishEvent(event);
            } else {
                await nostrService.publishToBiesRelay(event);
            }

            setComposeText('');
            attachedFiles.forEach(a => URL.revokeObjectURL(a.previewUrl));
            setAttachedFiles([]);
        } catch (err) {
            console.error('[Feed] Post failed:', err);
            const msg = err?.errors?.[0]?.message || err?.message || String(err);
            setPostError(`Post failed: ${msg}`);
        } finally {
            setPosting(false);
            setUploading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handlePost();
        }
    };

    // Like a note (kind:7 reaction)
    const handleLike = async (post) => {
        if (likedNotes.has(post.id)) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !window.nostr) return;

        try {
            const event = {
                kind: 7,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', post.id],
                    ['p', post.pubkey],
                ],
                content: '+',
            };
            await nostrService.publishEvent(event);
            setLikedNotes(prev => new Set(prev).add(post.id));
            setNoteStats(prev => ({
                ...prev,
                [post.id]: { ...prev[post.id], likes: (prev[post.id]?.likes || 0) + 1 },
            }));
        } catch (err) {
            console.error('[Feed] Like failed:', err);
        }
    };

    // Repost a note (kind:6)
    const handleRepost = async (post) => {
        if (repostedNotes.has(post.id)) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !window.nostr) return;

        try {
            const event = {
                kind: 6,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', post.id, ''],
                    ['p', post.pubkey],
                ],
                content: JSON.stringify(post),
            };
            await nostrService.publishEvent(event);
            setRepostedNotes(prev => new Set(prev).add(post.id));
            setNoteStats(prev => ({
                ...prev,
                [post.id]: { ...prev[post.id], reposts: (prev[post.id]?.reposts || 0) + 1 },
            }));
        } catch (err) {
            console.error('[Feed] Repost failed:', err);
        }
    };

    // Reply to a note (kind:1 with e/p tags)
    const handleReply = async (post) => {
        if (!replyText.trim() || replyPosting) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !window.nostr) return;

        setReplyPosting(true);
        try {
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', post.id, '', 'root'],
                    ['p', post.pubkey],
                ],
                content: replyText.trim(),
            };
            await nostrService.publishEvent(event);
            setReplyText('');
            setReplyTarget(null);
            setNoteStats(prev => ({
                ...prev,
                [post.id]: { ...prev[post.id], replies: (prev[post.id]?.replies || 0) + 1 },
            }));
        } catch (err) {
            console.error('[Feed] Reply failed:', err);
        } finally {
            setReplyPosting(false);
        }
    };

    // Share a note
    const handleShare = async (post) => {
        const noteId = nip19.noteEncode(post.id);
        const url = `https://njump.me/${noteId}`;
        if (navigator.share) {
            try {
                await navigator.share({ url });
            } catch { /* cancelled */ }
        } else {
            await navigator.clipboard.writeText(url);
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

    // Parse note content: extract media URLs and render text + embeds
    const renderContent = (content) => {
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        const parts = content.split(urlRegex);
        const mediaUrls = [];
        const textParts = [];

        for (const part of parts) {
            if (/^https?:\/\//i.test(part)) {
                const lower = part.toLowerCase();
                if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(lower)) {
                    mediaUrls.push({ type: 'image', url: part });
                } else if (/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(lower)) {
                    mediaUrls.push({ type: 'video', url: part });
                } else if (/\.(mp3|wav|flac|aac|m4a)(\?.*)?$/i.test(lower)) {
                    mediaUrls.push({ type: 'audio', url: part });
                } else if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i.test(part)) {
                    const match = part.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i);
                    if (match) mediaUrls.push({ type: 'youtube', id: match[1], url: part });
                    else textParts.push(part);
                } else {
                    textParts.push(part);
                }
            } else {
                textParts.push(part);
            }
        }

        return (
            <>
                <span>{textParts.join('')}</span>
                {mediaUrls.length > 0 && (
                    <div className="note-media">
                        {mediaUrls.map((m, i) => {
                            if (m.type === 'image') {
                                return <img key={i} src={m.url} alt="" className="note-media-img" loading="lazy" />;
                            }
                            if (m.type === 'video') {
                                return <video key={i} src={m.url} controls className="note-media-video" preload="metadata" />;
                            }
                            if (m.type === 'audio') {
                                return <audio key={i} src={m.url} controls className="note-media-audio" preload="metadata" />;
                            }
                            if (m.type === 'youtube') {
                                return (
                                    <iframe
                                        key={i}
                                        className="note-media-video"
                                        src={`https://www.youtube-nocookie.com/embed/${m.id}`}
                                        title="YouTube video"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        loading="lazy"
                                    />
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </>
        );
    };

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
                    {attachedFiles.length > 0 && (
                        <div className="compose-media-preview">
                            {attachedFiles.map((item, i) => (
                                <div key={i} className="media-preview-item">
                                    {item.type.startsWith('image/') ? (
                                        <img src={item.previewUrl} alt="" />
                                    ) : (
                                        <video src={item.previewUrl} muted />
                                    )}
                                    <button className="media-remove-btn" onClick={() => removeAttachment(i)}>
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {postError && <div className="compose-error">{postError}</div>}
                    <div className="compose-bottom">
                        <div className="compose-actions-left">
                            <button
                                className={`relay-toggle ${broadcastPublic ? 'public' : 'private'}`}
                                onClick={() => setBroadcastPublic(!broadcastPublic)}
                                title={broadcastPublic ? 'Broadcasting to all relays' : 'Private relay only'}
                            >
                                {broadcastPublic ? <Globe size={14} /> : <Lock size={14} />}
                                <span>{broadcastPublic ? 'Public' : 'Private'}</span>
                            </button>
                            <button
                                className="media-attach-btn"
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach image or video"
                                disabled={attachedFiles.length >= blossomService.MAX_ATTACHMENTS || posting || uploading}
                            >
                                <ImagePlus size={16} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/*"
                                multiple
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />
                        </div>
                        <button
                            className="post-btn"
                            onClick={handlePost}
                            disabled={(!composeText.trim() && attachedFiles.length === 0) || posting || uploading}
                            data-testid="post-btn"
                        >
                            {(posting || uploading) ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                            <span>{uploading ? 'Uploading...' : posting ? 'Posting...' : 'Post'}</span>
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
                            const isLiked = likedNotes.has(post.id);
                            const isReposted = repostedNotes.has(post.id);
                            const isReplying = replyTarget?.id === post.id;
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
                                    <div className="note-content">{renderContent(post.content)}</div>
                                    <div className="note-actions">
                                        <button
                                            className={`action-btn ${isReplying ? 'active-reply' : ''}`}
                                            title="Reply"
                                            onClick={() => setReplyTarget(isReplying ? null : { id: post.id, pubkey: post.pubkey })}
                                        >
                                            <MessageCircle size={15} />
                                            <span>{formatCount(stats.replies)}</span>
                                        </button>
                                        <button
                                            className={`action-btn ${isReposted ? 'active-repost' : ''}`}
                                            title="Repost"
                                            onClick={() => handleRepost(post)}
                                        >
                                            <Repeat size={15} />
                                            <span>{formatCount(stats.reposts)}</span>
                                        </button>
                                        <button
                                            className={`action-btn ${isLiked ? 'active-like' : ''}`}
                                            title="Like"
                                            onClick={() => handleLike(post)}
                                        >
                                            <Heart size={15} fill={isLiked ? '#ef4444' : 'none'} />
                                            <span>{formatCount(stats.likes)}</span>
                                        </button>
                                        <button
                                            className="action-btn action-zap"
                                            title="Zap"
                                            onClick={() => setZapTarget({
                                                pubkey: post.pubkey,
                                                name: getDisplayName(post.pubkey),
                                                avatar: getAvatar(post.pubkey),
                                                eventId: post.id,
                                            })}
                                        >
                                            <Zap size={15} />
                                            <span>{formatSats(stats.satszapped)}</span>
                                        </button>
                                        <button
                                            className="action-btn action-share"
                                            title="Share"
                                            onClick={() => handleShare(post)}
                                        >
                                            <Share size={15} />
                                        </button>
                                    </div>

                                    {/* Inline Reply */}
                                    {isReplying && (
                                        <div className="reply-box">
                                            <textarea
                                                className="reply-input"
                                                placeholder={`Reply to ${getDisplayName(post.pubkey)}...`}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply(post);
                                                    if (e.key === 'Escape') { setReplyTarget(null); setReplyText(''); }
                                                }}
                                                rows={2}
                                                autoFocus
                                            />
                                            <div className="reply-actions">
                                                <button className="reply-cancel" onClick={() => { setReplyTarget(null); setReplyText(''); }}>
                                                    <X size={14} /> Cancel
                                                </button>
                                                <button
                                                    className="reply-send"
                                                    onClick={() => handleReply(post)}
                                                    disabled={!replyText.trim() || replyPosting}
                                                >
                                                    {replyPosting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                                    Reply
                                                </button>
                                            </div>
                                        </div>
                                    )}
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

                {/* Zap Modal */}
                {zapTarget && (
                    <ZapModal
                        recipients={[{ pubkey: zapTarget.pubkey, name: zapTarget.name, avatar: zapTarget.avatar }]}
                        eventId={zapTarget.eventId}
                        onClose={() => setZapTarget(null)}
                    />
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
                .compose-media-preview {
                    display: flex;
                    gap: 0.5rem;
                    padding: 0.75rem 0 0.25rem 52px;
                    overflow-x: auto;
                }
                .media-preview-item {
                    position: relative;
                    width: 80px;
                    height: 80px;
                    border-radius: 8px;
                    overflow: hidden;
                    flex-shrink: 0;
                    border: 1px solid #e5e7eb;
                }
                .media-preview-item img,
                .media-preview-item video {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .media-remove-btn {
                    position: absolute;
                    top: 4px;
                    right: 4px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.6);
                    color: white;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                }
                .media-remove-btn:hover {
                    background: rgba(0, 0, 0, 0.8);
                }
                .compose-actions-left {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .media-attach-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    border: 1px solid #e5e7eb;
                    background: transparent;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .media-attach-btn:hover {
                    background: #f3f4f6;
                    color: #4b5563;
                    border-color: #d1d5db;
                }
                .media-attach-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
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
                .action-btn.active-like { color: #ef4444; }
                .action-btn.active-repost { color: #22c55e; }
                .action-btn.active-reply { color: #7c3aed; }
                .action-zap:hover { color: #f59e0b; }
                .action-share { margin-left: auto; }

                /* Media in notes */
                .note-media {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                }
                .note-media-img {
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 12px;
                    object-fit: contain;
                }
                .note-media-video {
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 12px;
                    aspect-ratio: 16/9;
                    border: none;
                }
                .note-media-audio {
                    width: 100%;
                    border-radius: 8px;
                }

                /* Reply box */
                .reply-box {
                    margin-top: 0.75rem;
                    padding: 0.75rem;
                    padding-left: 52px;
                    background: rgba(124, 58, 237, 0.04);
                    border-radius: 0 0 12px 12px;
                    border-top: 1px solid #ede9fe;
                }
                .reply-input {
                    width: 100%;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    font-family: inherit;
                    resize: none;
                    outline: none;
                    background: var(--color-surface, white);
                    color: inherit;
                    box-sizing: border-box;
                }
                .reply-input:focus {
                    border-color: #7c3aed;
                }
                .reply-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }
                .reply-cancel, .reply-send {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.35rem 0.75rem;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                }
                .reply-cancel {
                    background: transparent;
                    color: #9ca3af;
                }
                .reply-cancel:hover { color: #6b7280; }
                .reply-send {
                    background: #7c3aed;
                    color: white;
                }
                .reply-send:hover { opacity: 0.9; }
                .reply-send:disabled { opacity: 0.5; cursor: not-allowed; }

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
                :global([data-theme="dark"]) .media-preview-item {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .media-attach-btn {
                    border-color: #2d3748;
                    color: #94a3b8;
                }
                :global([data-theme="dark"]) .media-attach-btn:hover {
                    background: #2d3748;
                    color: #e2e8f0;
                    border-color: #4a5568;
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
                :global([data-theme="dark"]) .reply-box {
                    background: rgba(124, 58, 237, 0.08);
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .reply-input {
                    background: #0f172a;
                    border-color: #2d3748;
                    color: #f1f5f9;
                }
                :global([data-theme="dark"]) .reply-input:focus {
                    border-color: #7c3aed;
                }
            `}</style>
        </div>
    );
};

export default Feed;
