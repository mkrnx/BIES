import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { MessageCircle, Heart, Repeat, Share, Loader2, Send, Globe, Lock, Zap, TrendingUp, Flame, Clock, ChevronDown, Calendar, X, ImagePlus, ChevronLeft, ChevronRight, Smile, MoreHorizontal, Link, Type, Hash, Code, Trash2, Flag, VolumeX, RefreshCw } from 'lucide-react';
import { nostrService, BIES_RELAY } from '../services/nostrService';
import { primalService, EXPLORE_VIEWS } from '../services/primalService';
import { nostrSigner } from '../services/nostrSigner';
import { blossomService } from '../services/blossomService';
import { useAuth } from '../context/AuthContext';
import { notificationsApi } from '../services/api';
import NostrIcon from '../components/NostrIcon';
import ZapModal from '../components/ZapModal';
import EmojiPicker from '../components/EmojiPicker';
import NostrGifPicker from '../components/NostrGifPicker';
import TranslatableText from '../components/TranslatableText';
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
    const { t } = useTranslation();
    const location = useLocation();
    const [posts, setPosts] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [noteStats, setNoteStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [feedMode, setFeedMode] = useState('private'); // 'private' | 'explore'
    const [exploreView, setExploreView] = useState('trending_24h');
    const [refreshKey, setRefreshKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const fetchedProfiles = useRef(new Set());

    // Re-subscribe to the private relay when the page regains visibility.
    // Mobile browsers kill WebSocket connections when backgrounded; bumping
    // refreshKey re-triggers the subscription effect so the feed reconnects.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && feedMode === 'private') {
                setRefreshKey(k => k + 1);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [feedMode]);

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
    const [myPubkey, setMyPubkey] = useState(null);
    const [repostMenu, setRepostMenu] = useState(null); // post.id or null — shows repost relay choice
    const [postMenu, setPostMenu] = useState(null); // post.id or null — shows "..." menu
    const [deletingPost, setDeletingPost] = useState(null); // post.id being deleted

    // Mention autocomplete
    const [mentionResults, setMentionResults] = useState([]);
    const [mentionLoading, setMentionLoading] = useState(false);
    const [mentionAnchor, setMentionAnchor] = useState(null); // { field: 'compose'|'reply', startIndex }
    const mentionSearchTimer = useRef(null);

    // Comment section state
    const [openComments, setOpenComments] = useState(new Set());
    const [comments, setComments] = useState({});
    const [loadingComments, setLoadingComments] = useState({});
    const [visibleCommentCount, setVisibleCommentCount] = useState({});
    const [likedComments, setLikedComments] = useState(new Set());
    const fetchedComments = useRef(new Set());

    // Emoji & GIF picker state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showGifPicker, setShowGifPicker] = useState(false);
    const [commentEmojiPicker, setCommentEmojiPicker] = useState(null); // post.id or null
    const [commentGifPicker, setCommentGifPicker] = useState(null); // post.id or null
    const composeInputRef = useRef(null);
    const commentInputRefs = useRef({});

    const currentView = EXPLORE_VIEWS.find(v => v.key === exploreView) || EXPLORE_VIEWS[0];

    // Fetch own pubkey once on mount for reaction persistence and notifications
    useEffect(() => {
        nostrSigner.getPublicKey().then(pk => {
            setMyPubkey(pk);
            if (pk && !fetchedProfiles.current.has(pk)) {
                fetchedProfiles.current.add(pk);
                nostrService.getProfile(pk).then(p => {
                    if (p) setProfiles(prev => ({ ...prev, [pk]: p }));
                });
            }
        }).catch(() => {});
    }, []);

    // Scroll to a specific post when navigated from notifications
    useEffect(() => {
        const scrollToPost = location.state?.scrollToPost;
        if (!scrollToPost || loading || feedMode !== 'private') return;
        // Wait a tick for posts to render
        const timer = setTimeout(() => {
            const el = document.querySelector(`[data-post-id="${CSS.escape(scrollToPost)}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.transition = 'box-shadow 0.3s';
                el.style.boxShadow = '0 0 0 2px var(--color-secondary)';
                setTimeout(() => { el.style.boxShadow = ''; }, 2000);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [location.state?.scrollToPost, loading, feedMode]);

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
        setComments({});
        setOpenComments(new Set());
        setLoading(true);
        fetchedProfiles.current.clear();
        fetchedComments.current.clear();

        let cancelled = false;
        let reconnectTimer = null;
        const timeout = setTimeout(() => setLoading(false), 15000);

        // Collect pubkeys during streaming, batch-fetch profiles after EOSE.
        // Post-EOSE live arrivals are debounced (300ms) and batched too.
        const preEosePubkeys = [];
        const liveQueue = new Set();
        let debounceTimer = null;
        let eoseFired = false;

        const flushLiveProfiles = async () => {
            if (liveQueue.size === 0) return;
            const toFetch = [...liveQueue].filter(pk => !fetchedProfiles.current.has(pk));
            toFetch.forEach(pk => fetchedProfiles.current.add(pk));
            liveQueue.clear();
            if (toFetch.length === 0) return;
            const profileMap = await nostrService.getProfiles(toFetch);
            if (profileMap.size > 0) {
                setProfiles(prev => {
                    const next = { ...prev };
                    for (const [pk, p] of profileMap) next[pk] = p;
                    return next;
                });
            }
        };

        const sub = nostrService.pool.subscribeMany(
            [BIES_RELAY],
            { kinds: [1, 6], limit: 50 },
            {
                onevent: (event) => {
                    // Handle reposts (kind 6) — parse the embedded original post
                    if (event.kind === 6) {
                        let original;
                        try { original = JSON.parse(event.content); } catch { return; }
                        if (!original?.id || !original?.pubkey || !original?.content) return;
                        // Mark as a repost so we can render "X reposted" label
                        const repostEvent = { ...original, _repostedBy: event.pubkey, _repostTime: event.created_at, _repostId: event.id };
                        setPosts(prev => {
                            if (prev.find(p => p.id === event.id || (p._repostId === event.id))) return prev;
                            return [...prev, repostEvent].sort((a, b) => (b._repostTime || b.created_at) - (a._repostTime || a.created_at));
                        });
                        if (!fetchedProfiles.current.has(event.pubkey)) {
                            if (!eoseFired) { preEosePubkeys.push(event.pubkey); }
                            else { liveQueue.add(event.pubkey); clearTimeout(debounceTimer); debounceTimer = setTimeout(flushLiveProfiles, 300); }
                        }
                        if (!fetchedProfiles.current.has(original.pubkey)) {
                            if (!eoseFired) { preEosePubkeys.push(original.pubkey); }
                            else { liveQueue.add(original.pubkey); clearTimeout(debounceTimer); debounceTimer = setTimeout(flushLiveProfiles, 300); }
                        }
                        clearTimeout(timeout);
                        setLoading(false);
                        return;
                    }

                    // Skip machine-generated events (JSON metadata, protocol messages)
                    const c = (event.content || '').trimStart();
                    if (c.startsWith('{') || c.startsWith('xitchat-') || c.startsWith('[')) return;

                    // Skip replies — events with 'e' tags are replies to other posts, not root posts
                    if (event.tags.some(t => t[0] === 'e')) return;

                    setPosts(prev => {
                        if (prev.find(p => p.id === event.id)) return prev;
                        return [...prev, event].sort((a, b) => (b._repostTime || b.created_at) - (a._repostTime || a.created_at));
                    });
                    clearTimeout(timeout);
                    setLoading(false);

                    if (!fetchedProfiles.current.has(event.pubkey)) {
                        if (!eoseFired) {
                            preEosePubkeys.push(event.pubkey);
                        } else {
                            liveQueue.add(event.pubkey);
                            clearTimeout(debounceTimer);
                            debounceTimer = setTimeout(flushLiveProfiles, 300);
                        }
                    }
                },
                oneose: async () => {
                    eoseFired = true;
                    setLoading(false);
                    clearTimeout(debounceTimer);
                    const toFetch = [...new Set(preEosePubkeys)].filter(pk => !fetchedProfiles.current.has(pk));
                    toFetch.forEach(pk => fetchedProfiles.current.add(pk));
                    if (toFetch.length === 0) return;
                    const profileMap = await nostrService.getProfiles(toFetch);
                    if (profileMap.size > 0) {
                        setProfiles(prev => {
                            const next = { ...prev };
                            for (const [pk, p] of profileMap) next[pk] = p;
                            return next;
                        });
                    }
                },
                onclose: () => {
                    setLoading(false);
                    // Auto-reconnect when the WebSocket drops unexpectedly
                    // (nginx timeout, mobile network switch, cell handoff).
                    if (!cancelled) {
                        reconnectTimer = setTimeout(() => {
                            setRefreshKey(k => k + 1);
                        }, 2000);
                    }
                },
                onauth: async (evt) => nostrSigner.signEvent(evt),
            }
        );

        return () => {
            cancelled = true;
            clearTimeout(timeout);
            clearTimeout(debounceTimer);
            clearTimeout(reconnectTimer);
            if (sub) sub.close();
        };
    }, [feedMode, refreshKey]);

    // Fetch ALL reactions for private relay posts — builds stats counts + marks user's own likes/reposts
    const fetchedReactionIds = useRef(new Set());
    useEffect(() => {
        if (feedMode !== 'private' || posts.length === 0) return;

        const postIds = posts.map(p => p.id).filter(id => !fetchedReactionIds.current.has(id));
        if (postIds.length === 0) return;
        postIds.forEach(id => fetchedReactionIds.current.add(id));
        const likeCounts = {};
        const repostCounts = {};
        const replyCounts = {};
        const userLiked = new Set();
        const userReposted = new Set();

        const sub = nostrService.pool.subscribeMany(
            [BIES_RELAY, ...nostrService.relays],
            { kinds: [7, 6, 1], '#e': postIds, limit: 2000 },
            {
                onevent: (event) => {
                    const eTag = event.tags.find(t => t[0] === 'e');
                    if (!eTag) return;
                    const targetId = eTag[1];
                    if (event.kind === 7) {
                        likeCounts[targetId] = (likeCounts[targetId] || 0) + 1;
                        if (myPubkey && event.pubkey === myPubkey) userLiked.add(targetId);
                    } else if (event.kind === 6) {
                        repostCounts[targetId] = (repostCounts[targetId] || 0) + 1;
                        if (myPubkey && event.pubkey === myPubkey) userReposted.add(targetId);
                    } else if (event.kind === 1) {
                        replyCounts[targetId] = (replyCounts[targetId] || 0) + 1;
                    }
                },
                oneose: () => {
                    sub.close();
                    // Build stats object
                    const stats = {};
                    for (const id of postIds) {
                        if (likeCounts[id] || repostCounts[id] || replyCounts[id]) {
                            stats[id] = {
                                likes: likeCounts[id] || 0,
                                reposts: repostCounts[id] || 0,
                                replies: replyCounts[id] || 0,
                            };
                        }
                    }
                    setNoteStats(prev => ({ ...prev, ...stats }));
                    if (userLiked.size) setLikedNotes(prev => new Set([...prev, ...userLiked]));
                    if (userReposted.size) setRepostedNotes(prev => new Set([...prev, ...userReposted]));
                },
                onauth: async (evt) => nostrSigner.signEvent(evt),
            }
        );

        return () => sub.close();
    }, [feedMode, posts, myPubkey]);

    // Reset reaction cache when switching feed modes
    useEffect(() => {
        fetchedReactionIds.current.clear();
    }, [feedMode]);

    // Ensure profiles are loaded for repost authors (catches missed/failed fetches)
    const repostProfileRetries = useRef(new Set());
    useEffect(() => {
        const missing = posts
            .filter(p => p._repostedBy && !profiles[p._repostedBy])
            .map(p => p._repostedBy);
        const unique = [...new Set(missing)].filter(pk => !repostProfileRetries.current.has(pk));
        if (unique.length === 0) return;
        unique.forEach(pk => repostProfileRetries.current.add(pk));
        nostrService.getProfiles(unique).then(profileMap => {
            if (profileMap.size > 0) {
                setProfiles(prev => {
                    const next = { ...prev };
                    for (const [pk, p] of profileMap) next[pk] = p;
                    return next;
                });
            }
        });
    }, [posts, profiles]);

    // Fetch explore feed from Primal
    useEffect(() => {
        if (feedMode !== 'explore') return;

        let cancelled = false;
        setPosts([]);
        setProfiles({});
        setNoteStats({});
        setComments({});
        setOpenComments(new Set());
        setLoading(true);
        fetchedComments.current.clear();

        (async () => {
            try {
                const opts = { limit: 30 };
                if (myPubkey) opts.userPubkey = myPubkey;
                const result = await primalService.fetchExploreFeed(currentView, opts);
                if (cancelled) return;

                setProfiles(result.profiles);
                setNoteStats(result.stats);
                setPosts(sortNotes(result.notes, result.stats, exploreView));

                // Pre-populate liked/reposted state from Primal actions
                if (result.actions) {
                    const liked = new Set();
                    const reposted = new Set();
                    for (const [eventId, action] of Object.entries(result.actions)) {
                        if (action.liked) liked.add(eventId);
                        if (action.reposted) reposted.add(eventId);
                    }
                    if (liked.size) setLikedNotes(prev => new Set([...prev, ...liked]));
                    if (reposted.size) setRepostedNotes(prev => new Set([...prev, ...reposted]));
                }
            } catch (err) {
                console.error('[Feed] Primal fetch failed:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [feedMode, exploreView, currentView, sortNotes, refreshKey]);

    // Load more for explore feed
    const handleLoadMore = async () => {
        if (loadingMore || feedMode !== 'explore' || posts.length === 0) return;
        setLoadingMore(true);
        try {
            const opts = { limit: 20 };
            if (myPubkey) opts.userPubkey = myPubkey;
            const result = await primalService.loadMore(currentView, posts, noteStats, opts);
            if (result.notes.length > 0) {
                setProfiles(prev => ({ ...prev, ...result.profiles }));
                setNoteStats(prev => {
                    const merged = { ...prev, ...result.stats };
                    const allNotes = [...posts, ...result.notes];
                    const deduped = allNotes.filter((n, i, arr) => arr.findIndex(x => x.id === n.id) === i);
                    setPosts(sortNotes(deduped, merged, exploreView));
                    return merged;
                });
                // Pre-populate liked/reposted for new posts
                if (result.actions) {
                    const liked = new Set();
                    const reposted = new Set();
                    for (const [eventId, action] of Object.entries(result.actions)) {
                        if (action.liked) liked.add(eventId);
                        if (action.reposted) reposted.add(eventId);
                    }
                    if (liked.size) setLikedNotes(prev => new Set([...prev, ...liked]));
                    if (reposted.size) setRepostedNotes(prev => new Set([...prev, ...reposted]));
                }
            }
        } catch (err) {
            console.error('[Feed] Load more failed:', err);
        } finally {
            setLoadingMore(false);
        }
    };

    // Refresh feed — bumps refreshKey to re-trigger subscription/fetch effects
    const handleRefreshFeed = useCallback(() => {
        if (loading || refreshing) return;
        setRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => setRefreshing(false), 1500);
    }, [loading, refreshing]);

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

        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) {
            setPostError('Nostr signing not available. Please log in with your Nostr account to post.');
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

            // Sign the event first so we can add it to the feed optimistically
            const signedEvent = await nostrSigner.signEvent(event);

            if (broadcastPublic) {
                await Promise.any(nostrService.pool.publish(nostrService.relays, signedEvent));
            } else {
                await Promise.any(nostrService.pool.publish([BIES_RELAY], signedEvent));
            }

            // Optimistically add to feed so the user sees it immediately
            setPosts(prev => {
                if (prev.find(p => p.id === signedEvent.id)) return prev;
                return [signedEvent, ...prev];
            });

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
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handlePost();
        }
    };

    // Insert emoji at cursor in compose textarea
    const handleComposeEmoji = (emoji) => {
        const el = composeInputRef.current;
        if (el) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const newText = composeText.slice(0, start) + emoji + composeText.slice(end);
            setComposeText(newText);
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + emoji.length;
                el.focus();
            });
        } else {
            setComposeText(prev => prev + emoji);
        }
    };

    // Insert emoji at cursor in comment textarea
    const handleCommentEmoji = (postId, emoji) => {
        const el = commentInputRefs.current[postId];
        if (el) {
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const current = (replyTarget?.id === postId ? replyText : '');
            const newText = current.slice(0, start) + emoji + current.slice(end);
            setReplyTarget({ id: postId, pubkey: replyTarget?.pubkey });
            setReplyText(newText);
            requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = start + emoji.length;
                el.focus();
            });
        } else {
            setReplyTarget({ id: postId, pubkey: replyTarget?.pubkey });
            setReplyText(prev => prev + emoji);
        }
        setCommentEmojiPicker(null);
    };

    // Insert GIF URL into compose
    const handleComposeGif = (url) => {
        setComposeText(prev => prev ? prev + '\n' + url : url);
        setShowGifPicker(false);
    };

    // Insert GIF URL into comment
    const handleCommentGif = (postId, postPubkey, url) => {
        setReplyTarget({ id: postId, pubkey: postPubkey });
        setReplyText(prev => prev ? prev + '\n' + url : url);
        setCommentGifPicker(null);
    };

    // Like a note (kind:7 reaction)
    const handleLike = async (post) => {
        if (likedNotes.has(post.id)) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;

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
            // Notify the post author (fire-and-forget)
            if (user) {
                notificationsApi.feedInteraction({
                    type: 'POST_LIKE',
                    targetPubkey: post.pubkey,
                    actorName: myPubkey ? getDisplayName(myPubkey) : '',
                    eventId: post.id,
                });
            }
        } catch (err) {
            console.error('[Feed] Like failed:', err);
        }
    };

    // Repost a note (kind:6) — relay: 'private' | 'public'
    const handleRepost = async (post, relay) => {
        if (repostedNotes.has(post.id)) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;

        setRepostMenu(null);
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
            if (relay === 'private') {
                await nostrService.publishToBiesRelay(event);
            } else {
                await nostrService.publishEvent(event);
                // Also publish to private relay so it shows up there
                try { await nostrService.publishToBiesRelay(event); } catch { /* best-effort */ }
            }
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
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;

        setReplyPosting(true);
        try {
            const content = replyText.trim();
            const unsigned = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', post.id, '', 'root'],
                    ['p', post.pubkey],
                ],
                content,
            };
            const signed = await nostrSigner.signEvent(unsigned);
            await Promise.any(nostrService.pool.publish(nostrService.relays, signed));
            setReplyText('');
            setReplyTarget(null);
            setNoteStats(prev => ({
                ...prev,
                [post.id]: { ...prev[post.id], replies: (prev[post.id]?.replies || 0) + 1 },
            }));

            // Add reply optimistically to local comment cache and open comments
            setComments(prev => {
                const existing = prev[post.id] || [];
                if (existing.find(e => e.id === signed.id)) return prev;
                return { ...prev, [post.id]: [...existing, signed].sort((a, b) => a.created_at - b.created_at) };
            });
            fetchedComments.current.add(post.id);
            setOpenComments(prev => new Set(prev).add(post.id));

            // Notify the post author (fire-and-forget)
            if (user) {
                const actorName = myPubkey ? getDisplayName(myPubkey) : '';
                notificationsApi.feedInteraction({
                    type: 'POST_COMMENT',
                    targetPubkey: post.pubkey,
                    actorName,
                    eventId: post.id,
                    contentPreview: content,
                });
                // If replying to a specific comment, also notify the comment author
                if (replyTarget?.pubkey && replyTarget.pubkey !== post.pubkey) {
                    notificationsApi.feedInteraction({
                        type: 'COMMENT_REPLY',
                        targetPubkey: replyTarget.pubkey,
                        actorName,
                        eventId: post.id,
                        contentPreview: content,
                    });
                }
            }
        } catch (err) {
            console.error('[Feed] Reply failed:', err);
        } finally {
            setReplyPosting(false);
        }
    };

    // Like a comment (kind:7 reaction targeting the comment event)
    const handleCommentLike = async (comment) => {
        if (likedComments.has(comment.id)) return;
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;

        try {
            const event = {
                kind: 7,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', comment.id],
                    ['p', comment.pubkey],
                ],
                content: '+',
            };
            await nostrService.publishEvent(event);
            setLikedComments(prev => new Set(prev).add(comment.id));
            // Notify the comment author (fire-and-forget)
            if (user) {
                notificationsApi.feedInteraction({
                    type: 'COMMENT_LIKE',
                    targetPubkey: comment.pubkey,
                    actorName: myPubkey ? getDisplayName(myPubkey) : '',
                    eventId: comment.id,
                });
            }
        } catch (err) {
            console.error('[Feed] Comment like failed:', err);
        }
    };

    // Reply to a comment — prefill the textarea with @npub and focus it
    const handleCommentReply = (postId, comment) => {
        const npub = nip19.npubEncode(comment.pubkey);
        const mention = `nostr:${npub} `;
        setReplyTarget({ id: postId, pubkey: comment.pubkey });
        setReplyText(mention);
        // Focus the textarea for this post
        setTimeout(() => {
            const el = commentInputRefs.current[postId];
            if (el) {
                el.focus();
                el.setSelectionRange(mention.length, mention.length);
            }
        }, 50);
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

    // NIP-09: Request delete — publishes a kind:5 event referencing the target event
    const handleDeletePost = async (post) => {
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;
        setPostMenu(null);
        setDeletingPost(post.id);
        try {
            const event = {
                kind: 5,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['e', post.id]],
                content: 'Request delete',
            };
            // Publish delete request to both private and public relays
            await nostrService.publishEvent(event);
            try { await nostrService.publishToBiesRelay(event); } catch { /* best-effort */ }
            // Remove from local feed
            setPosts(prev => prev.filter(p => p.id !== post.id && p._repostId !== post.id));
        } catch (err) {
            console.error('[Feed] Delete request failed:', err);
        } finally {
            setDeletingPost(null);
        }
    };

    // Mute a user — add to local mute set (stored in localStorage)
    const [mutedUsers, setMutedUsers] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('bies_muted_users') || '[]')); }
        catch { return new Set(); }
    });

    const handleMuteUser = (pubkey) => {
        setMutedUsers(prev => {
            const next = new Set(prev).add(pubkey);
            localStorage.setItem('bies_muted_users', JSON.stringify([...next]));
            return next;
        });
    };

    // Report content — NIP-56 kind:1984 report event
    const handleReport = async (post) => {
        if (!nostrSigner.hasKey && nostrSigner.mode !== 'extension' && !nostrSigner.storedMethod && !window.nostr) return;
        setPostMenu(null);
        try {
            const event = {
                kind: 1984,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['e', post.id, 'spam'],
                    ['p', post.pubkey],
                ],
                content: '',
            };
            await nostrService.publishEvent(event);
            try { await nostrService.publishToBiesRelay(event); } catch { /* best-effort */ }
        } catch (err) {
            console.error('[Feed] Report failed:', err);
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

    // Mention autocomplete: detect @query in textarea and search profiles
    const handleMentionInput = useCallback((text, caretPos, field) => {
        const before = text.slice(0, caretPos);
        const match = before.match(/@(\S*)$/);
        if (match) {
            const query = match[1];
            setMentionAnchor({ field, startIndex: caretPos - match[0].length });
            if (mentionSearchTimer.current) clearTimeout(mentionSearchTimer.current);
            if (query.length >= 2) {
                setMentionLoading(true);
                setMentionResults([]);
                mentionSearchTimer.current = setTimeout(async () => {
                    try {
                        const results = await nostrService.searchProfiles(query, 6);
                        setMentionResults(results);
                    } catch {
                        setMentionResults([]);
                    } finally {
                        setMentionLoading(false);
                    }
                }, 350);
            } else {
                setMentionResults([]);
                setMentionLoading(false);
            }
        } else {
            setMentionAnchor(null);
            setMentionResults([]);
            setMentionLoading(false);
        }
    }, []);

    const handleMentionSelect = (profile) => {
        if (!mentionAnchor) return;
        const npub = nip19.npubEncode(profile.pubkey);
        const mention = `nostr:${npub} `;
        const insertMention = (prev) => {
            const before = prev.slice(0, mentionAnchor.startIndex);
            const after = prev.slice(mentionAnchor.startIndex).replace(/^@\S*/, '');
            return before + mention + after;
        };
        if (mentionAnchor.field === 'compose') {
            setComposeText(insertMention);
        } else {
            setReplyText(insertMention);
        }
        // Cache the mentioned profile so their name renders inline
        if (profile.name || profile.display_name) {
            setProfiles(prev => ({ ...prev, [profile.pubkey]: { ...prev[profile.pubkey], ...profile } }));
        }
        setMentionAnchor(null);
        setMentionResults([]);
        setMentionLoading(false);
    };

    // Render note text with nostr:npub mentions as styled @name spans
    const renderContent = (text) => {
        if (!text) return null;
        const parts = text.split(/(nostr:npub[a-z0-9]+)/gi);
        return parts.map((part, i) => {
            if (/^nostr:npub[a-z0-9]+$/i.test(part)) {
                const npubStr = part.slice(6); // strip "nostr:"
                try {
                    const decoded = nip19.decode(npubStr);
                    if (decoded.type === 'npub') {
                        return <span key={i} className="note-mention">@{getDisplayName(decoded.data)}</span>;
                    }
                } catch { /* fall through */ }
            }
            return <span key={i}>{part}</span>;
        });
    };

    // Only show root posts — filter out replies (events with 'e' tags referencing other events)
    // Show root posts + reposts (reposts have _repostId marker, so allow them through)
    // Show root posts + reposts, filter out muted users
    const rootPosts = useMemo(() => posts.filter(p => {
        if (mutedUsers.has(p.pubkey)) return false;
        if (p._repostedBy && mutedUsers.has(p._repostedBy)) return false;
        return p._repostId || !p.tags?.some(t => t[0] === 'e');
    }), [posts, mutedUsers]);

    const getStats = (noteId) => noteStats[noteId] || {};

    const loadComments = useCallback(async (postId) => {
        if (fetchedComments.current.has(postId)) return;
        fetchedComments.current.add(postId);
        setLoadingComments(prev => ({ ...prev, [postId]: true }));

        // For private relay feed, subscribe directly to BIES relay for replies
        if (feedMode === 'private') {
            const commentPubkeys = [];
            const sub = nostrService.pool.subscribeMany(
                [BIES_RELAY],
                { kinds: [1], '#e': [postId], limit: 100 },
                {
                    onevent: (event) => {
                        if (!fetchedProfiles.current.has(event.pubkey)) {
                            commentPubkeys.push(event.pubkey);
                        }
                        setComments(prev => {
                            const existing = prev[postId] || [];
                            if (existing.find(e => e.id === event.id)) return prev;
                            return { ...prev, [postId]: [...existing, event].sort((a, b) => a.created_at - b.created_at) };
                        });
                    },
                    oneose: async () => {
                        sub.close();
                        setLoadingComments(prev => ({ ...prev, [postId]: false }));
                        const toFetch = [...new Set(commentPubkeys)].filter(pk => !fetchedProfiles.current.has(pk));
                        toFetch.forEach(pk => fetchedProfiles.current.add(pk));
                        if (toFetch.length === 0) return;
                        const profileMap = await nostrService.getProfiles(toFetch);
                        if (profileMap.size > 0) {
                            setProfiles(prev => {
                                const next = { ...prev };
                                for (const [pk, p] of profileMap) next[pk] = p;
                                return next;
                            });
                        }
                    },
                    onclose: () => setLoadingComments(prev => ({ ...prev, [postId]: false })),
                    onauth: async (evt) => nostrSigner.signEvent(evt),
                }
            );
            return;
        }

        try {
            const result = await primalService.fetchReplies(postId, { limit: 100 });

            // Merge profiles from reply authors
            if (Object.keys(result.profiles).length > 0) {
                setProfiles(prev => ({ ...prev, ...result.profiles }));
                for (const pubkey of Object.keys(result.profiles)) {
                    fetchedProfiles.current.add(pubkey);
                }
            }

            // Set comments sorted by time
            if (result.notes.length > 0) {
                const sorted = result.notes.sort((a, b) => a.created_at - b.created_at);
                setComments(prev => {
                    const existing = prev[postId] || [];
                    const merged = [...existing];
                    for (const note of sorted) {
                        if (!merged.find(e => e.id === note.id)) {
                            merged.push(note);
                        }
                    }
                    merged.sort((a, b) => a.created_at - b.created_at);
                    return { ...prev, [postId]: merged };
                });
            }
        } catch (err) {
            console.error('[Feed] Failed to load comments via Primal:', err);
            // Remove from cache so user can retry
            fetchedComments.current.delete(postId);
        } finally {
            setLoadingComments(prev => ({ ...prev, [postId]: false }));
        }
    }, [feedMode]);

    const toggleComments = (postId) => {
        setOpenComments(prev => {
            const next = new Set(prev);
            if (next.has(postId)) {
                next.delete(postId);
            } else {
                next.add(postId);
                loadComments(postId);
            }
            return next;
        });
    };

    // Close repost menu and post menu on outside click
    useEffect(() => {
        if (!repostMenu && !postMenu) return;
        const handler = (e) => {
            if (repostMenu && !e.target.closest('.repost-wrapper')) setRepostMenu(null);
            if (postMenu && !e.target.closest('.note-menu-wrapper')) setPostMenu(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [repostMenu, postMenu]);

    // Lightbox state
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [lightboxGallery, setLightboxGallery] = useState([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const openLightbox = (src, gallery = []) => {
        setLightboxSrc(src);
        setLightboxGallery(gallery);
        setLightboxIndex(gallery.indexOf(src));
    };
    const lightboxPrev = () => {
        if (lightboxGallery.length < 2) return;
        const idx = (lightboxIndex - 1 + lightboxGallery.length) % lightboxGallery.length;
        setLightboxIndex(idx);
        setLightboxSrc(lightboxGallery[idx]);
    };
    const lightboxNext = () => {
        if (lightboxGallery.length < 2) return;
        const idx = (lightboxIndex + 1) % lightboxGallery.length;
        setLightboxIndex(idx);
        setLightboxSrc(lightboxGallery[idx]);
    };

    // Parse note content: separate text, images, and other media
    const parseNoteContent = (content) => {
        if (!content || typeof content !== 'string') return { text: '', images: [], otherMedia: [] };
        const urlRegex = /(https?:\/\/[^\s<]+)/g;
        const parts = content.split(urlRegex);
        const images = [];
        const otherMedia = [];
        const textParts = [];

        for (const part of parts) {
            if (/^https?:\/\//i.test(part)) {
                const lower = part.toLowerCase();
                if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(lower)) {
                    images.push(part);
                } else if (/\.(mp4|webm|mov|ogg)(\?.*)?$/i.test(lower)) {
                    otherMedia.push({ type: 'video', url: part });
                } else if (/\.(mp3|wav|flac|aac|m4a)(\?.*)?$/i.test(lower)) {
                    otherMedia.push({ type: 'audio', url: part });
                } else if (/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i.test(part)) {
                    const match = part.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/i);
                    if (match) otherMedia.push({ type: 'youtube', id: match[1], url: part });
                    else textParts.push(part);
                } else {
                    textParts.push(part);
                }
            } else {
                textParts.push(part);
            }
        }

        return { text: textParts.join('').trim(), images, otherMedia };
    };

    // Inline styles for image grid cells
    const gridCellStyle = {
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
    };
    const gridImgStyle = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
    };

    const renderImageGrid = (images) => {
        if (images.length === 0) return null;
        const maxShow = 5;
        const displayImages = images.slice(0, maxShow);
        const extraCount = images.length - maxShow;

        // Single image — scale proportionally, no crop
        if (images.length === 1) {
            return (
                <div style={{ margin: '0.5rem 0 0.75rem', paddingLeft: '52px', overflow: 'hidden' }}>
                    <img
                        src={images[0]}
                        alt=""
                        loading="lazy"
                        onClick={(e) => { e.stopPropagation(); openLightbox(images[0], images); }}
                        style={{
                            display: 'block',
                            maxWidth: '100%',
                            height: 'auto',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                    />
                </div>
            );
        }

        // 2 images — side by side squares
        if (images.length === 2) {
            return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', margin: '0.5rem 0 0.75rem', borderRadius: '8px', overflow: 'hidden' }}>
                    {images.map((src, i) => (
                        <div key={i} style={{ ...gridCellStyle, paddingBottom: '100%' }} onClick={(e) => { e.stopPropagation(); openLightbox(src, images); }}>
                            <img src={src} alt="" loading="lazy" style={gridImgStyle} />
                        </div>
                    ))}
                </div>
            );
        }

        // 3 images — one large left, two stacked right
        if (images.length === 3) {
            return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '3px', margin: '0.5rem 0 0.75rem', height: '320px', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ ...gridCellStyle, gridRow: '1 / 3' }} onClick={(e) => { e.stopPropagation(); openLightbox(images[0], images); }}>
                        <img src={images[0]} alt="" loading="lazy" style={gridImgStyle} />
                    </div>
                    <div style={gridCellStyle} onClick={(e) => { e.stopPropagation(); openLightbox(images[1], images); }}>
                        <img src={images[1]} alt="" loading="lazy" style={gridImgStyle} />
                    </div>
                    <div style={gridCellStyle} onClick={(e) => { e.stopPropagation(); openLightbox(images[2], images); }}>
                        <img src={images[2]} alt="" loading="lazy" style={gridImgStyle} />
                    </div>
                </div>
            );
        }

        // 4 images — 2x2 grid
        if (images.length === 4) {
            return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', margin: '0.5rem 0 0.75rem', borderRadius: '8px', overflow: 'hidden' }}>
                    {images.map((src, i) => (
                        <div key={i} style={{ ...gridCellStyle, paddingBottom: '100%' }} onClick={(e) => { e.stopPropagation(); openLightbox(src, images); }}>
                            <img src={src} alt="" loading="lazy" style={gridImgStyle} />
                        </div>
                    ))}
                </div>
            );
        }

        // 5+ images — top row 2, bottom row 3 (Facebook style)
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '0.5rem 0 0.75rem', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                    {displayImages.slice(0, 2).map((src, i) => (
                        <div key={i} style={{ ...gridCellStyle, paddingBottom: '75%' }} onClick={(e) => { e.stopPropagation(); openLightbox(src, images); }}>
                            <img src={src} alt="" loading="lazy" style={gridImgStyle} />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px' }}>
                    {displayImages.slice(2, 5).map((src, i) => (
                        <div
                            key={i}
                            style={{ ...gridCellStyle, paddingBottom: '100%' }}
                            onClick={(e) => { e.stopPropagation(); openLightbox(src, images); }}
                        >
                            <img src={src} alt="" loading="lazy" style={gridImgStyle} />
                            {i === 2 && extraCount > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontSize: '2rem',
                                    fontWeight: 700,
                                    zIndex: 1,
                                }}>+{extraCount}</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderOtherMedia = (media) => {
        if (media.length === 0) return null;
        return (
            <div className="note-media">
                {media.map((m, i) => {
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
        );
    };

    return (
        <div className="feed-page">
            <div className="feed-container">
                <div className="feed-header">
                    <h1 className="feed-title page-header">
                        <NostrIcon size={24} /> {t('feed.biesFeed')}
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
                        <span>{t('feed.privateRelay')}</span>
                    </button>
                    <button
                        className={`feed-tab ${feedMode === 'explore' ? 'active' : ''}`}
                        onClick={() => setFeedMode('explore')}
                        data-testid="tab-explore"
                    >
                        <Globe size={14} />
                        <span>{t('feed.explore')}</span>
                    </button>
                    <button
                        className={`feed-tab-refresh${refreshing ? ' spinning' : ''}`}
                        onClick={handleRefreshFeed}
                        disabled={loading || refreshing}
                        title={t('feed.refresh', 'Refresh feed')}
                        aria-label={t('feed.refresh', 'Refresh feed')}
                    >
                        <RefreshCw size={14} />
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
                            ref={composeInputRef}
                            className="compose-input"
                            placeholder={t('feed.whatsHappening')}
                            value={composeText}
                            onChange={(e) => {
                                setComposeText(e.target.value);
                                handleMentionInput(e.target.value, e.target.selectionStart, 'compose');
                            }}
                            onKeyDown={handleKeyDown}
                            onBlur={() => setTimeout(() => setMentionAnchor(null), 150)}
                            rows={3}
                            data-testid="compose-input"
                        />
                    </div>
                    {mentionAnchor?.field === 'compose' && (mentionResults.length > 0 || mentionLoading) && (
                        <div className="mention-dropdown">
                            {mentionLoading && mentionResults.length === 0 && (
                                <div className="mention-loading"><Loader2 size={12} className="spin" /> {t('feed.searching')}</div>
                            )}
                            {mentionResults.map(p => (
                                <button key={p.pubkey} className="mention-item" onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(p); }}>
                                    {p.picture ? (
                                        <img src={p.picture} className="mention-avatar" alt="" />
                                    ) : (
                                        <div className="mention-avatar-placeholder"><NostrIcon size={12} /></div>
                                    )}
                                    <div className="mention-info">
                                        <span className="mention-name">{p.display_name || p.name || p.pubkey.slice(0, 10)}</span>
                                        {p.nip05 && <span className="mention-nip05">{p.nip05}</span>}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
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
                                title={broadcastPublic ? t('feed.broadcastingPublic') : t('feed.privateRelayOnly')}
                            >
                                {broadcastPublic ? <Globe size={14} /> : <Lock size={14} />}
                                <span>{broadcastPublic ? t('feed.public') : t('feed.private')}</span>
                            </button>
                        </div>
                        <div className="compose-actions-right">
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
                            <div className="picker-anchor">
                                <button
                                    className="media-attach-btn"
                                    onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
                                    title="Emoji"
                                >
                                    <Smile size={16} />
                                </button>
                                {showEmojiPicker && (
                                    <EmojiPicker
                                        onSelect={(emoji) => handleComposeEmoji(emoji)}
                                        onClose={() => setShowEmojiPicker(false)}
                                    />
                                )}
                            </div>
                            <div className="picker-anchor">
                                <button
                                    className="media-attach-btn"
                                    onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
                                    title="GIF"
                                >
                                    <span className="gif-label">GIF</span>
                                </button>
                                {showGifPicker && (
                                    <NostrGifPicker
                                        onSelect={handleComposeGif}
                                        onClose={() => setShowGifPicker(false)}
                                        dropDown
                                    />
                                )}
                            </div>
                            <button
                                className="post-btn"
                                onClick={handlePost}
                                disabled={(!composeText.trim() && attachedFiles.length === 0) || posting || uploading}
                                data-testid="post-btn"
                            >
                                {(posting || uploading) ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                                <span>{uploading ? t('feed.uploading') : posting ? t('feed.posting') : t('feed.post')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Feed */}
                {loading && rootPosts.length === 0 ? (
                    <div className="feed-loading" data-testid="feed-loading">
                        <Loader2 size={24} className="spin" />
                        <p>{feedMode === 'private' ? t('feed.connectingRelay') : t('feed.loadingTrending')}</p>
                    </div>
                ) : rootPosts.length === 0 ? (
                    <div className="feed-empty" data-testid="feed-empty">
                        <NostrIcon size={40} />
                        <h3>{t('feed.noPostsTitle')}</h3>
                        <p>
                            {feedMode === 'private'
                                ? t('feed.noPostsPrivate')
                                : t('feed.noPostsExplore')}
                        </p>
                        {feedMode === 'private' && (
                            <button className="try-public-btn" onClick={() => setFeedMode('explore')}>
                                <Globe size={14} /> {t('feed.exploreNostr')}
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="feed-list" data-testid="feed-list">
                        {rootPosts.map(post => {
                            const stats = getStats(post.id);
                            const isLiked = likedNotes.has(post.id);
                            const isReposted = repostedNotes.has(post.id) || (post._repostedBy && post._repostedBy === myPubkey);
                            const isReplying = replyTarget?.id === post.id;
                            const isCommentsOpen = openComments.has(post.id);
                            const postComments = comments[post.id] || [];
                            const { text, images, otherMedia } = parseNoteContent(post.content);
                            const isOwnPost = myPubkey && post.pubkey === myPubkey;
                            return (
                                <div key={post._repostId || post.id} className="feed-note" data-testid="feed-note" data-post-id={post.id}>
                                    <div className="note-menu-wrapper">
                                        <button className="note-menu-btn" onClick={() => setPostMenu(postMenu === post.id ? null : post.id)}>
                                            <MoreHorizontal size={16} />
                                        </button>
                                        {postMenu === post.id && (
                                            <div className="note-menu">
                                                <button className="note-menu-item" onClick={() => { handleShare(post); setPostMenu(null); }}>
                                                    <Share size={14} /> {t('feed.shareNote')}
                                                </button>
                                                <button className="note-menu-item" onClick={() => { navigator.clipboard.writeText(`https://njump.me/${nip19.noteEncode(post.id)}`); setPostMenu(null); }}>
                                                    <Link size={14} /> {t('feed.copyNoteLink')}
                                                </button>
                                                <button className="note-menu-item" onClick={() => { navigator.clipboard.writeText(post.content || ''); setPostMenu(null); }}>
                                                    <Type size={14} /> {t('feed.copyNoteText')}
                                                </button>
                                                <button className="note-menu-item" onClick={() => { navigator.clipboard.writeText(post.id); setPostMenu(null); }}>
                                                    <Hash size={14} /> {t('feed.copyNoteId')}
                                                </button>
                                                <button className="note-menu-item" onClick={() => { navigator.clipboard.writeText(JSON.stringify(post, null, 2)); setPostMenu(null); }}>
                                                    <Code size={14} /> {t('feed.copyRawData')}
                                                </button>
                                                {isOwnPost && (
                                                    <button className="note-menu-item note-menu-danger" onClick={() => handleDeletePost(post)}>
                                                        <Trash2 size={14} /> {t('feed.requestDelete')}
                                                    </button>
                                                )}
                                                {!isOwnPost && (
                                                    <>
                                                        <button className="note-menu-item note-menu-danger" onClick={() => { handleMuteUser(post.pubkey); setPostMenu(null); }}>
                                                            <VolumeX size={14} /> {t('feed.muteUser')}
                                                        </button>
                                                        <button className="note-menu-item note-menu-danger" onClick={() => { handleReport(post); setPostMenu(null); }}>
                                                            <Flag size={14} /> {t('feed.reportContent')}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {post._repostedBy && (
                                        <div className="repost-label">
                                            <Repeat size={13} />
                                            <span>{getDisplayName(post._repostedBy)} {t('feed.reposted')}</span>
                                        </div>
                                    )}
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
                                            <span className="note-handle">{getHandle(post.pubkey)} · {formatTime(post._repostTime || post.created_at)}</span>
                                        </div>
                                    </div>
                                    {text && (
                                        <div className="note-content">
                                            {renderContent(text)}
                                        </div>
                                    )}
                                    {text && <TranslatableText text={text} buttonOnly />}
                                    {renderImageGrid(images)}
                                    {renderOtherMedia(otherMedia)}
                                    <div className="note-actions">
                                        <button
                                            className={`action-btn ${isCommentsOpen ? 'active-reply' : ''}`}
                                            title="Comments"
                                            onClick={() => toggleComments(post.id)}
                                        >
                                            <MessageCircle size={15} />
                                            <span>{formatCount(stats.replies)}</span>
                                        </button>
                                        <div className="repost-wrapper">
                                            <button
                                                className={`action-btn ${isReposted ? 'active-repost' : ''}`}
                                                title="Repost"
                                                onClick={() => {
                                                    if (isReposted) return;
                                                    setRepostMenu(repostMenu === post.id ? null : post.id);
                                                }}
                                            >
                                                <Repeat size={15} />
                                                <span>{formatCount(stats.reposts)}</span>
                                            </button>
                                            {repostMenu === post.id && (
                                                <div className="repost-menu">
                                                    <button className="repost-menu-item" onClick={() => handleRepost(post, 'private')}>
                                                        <Lock size={14} />
                                                        <span>{t('feed.repostPrivate')}</span>
                                                    </button>
                                                    <button className="repost-menu-item" onClick={() => handleRepost(post, 'public')}>
                                                        <Globe size={14} />
                                                        <span>{t('feed.repostPublic')}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            className={`action-btn ${isLiked ? 'active-like' : ''}`}
                                            title="Like"
                                            data-testid="like-btn"
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

                                    {/* Comment Section */}
                                    {isCommentsOpen && (
                                        <div className="comment-section">
                                            {/* Reply compose - at top */}
                                            <div className="comment-compose">
                                                <div className="comment-compose-avatar">
                                                    {user?.profile?.avatar ? (
                                                        <img src={user.profile.avatar} alt="" />
                                                    ) : (
                                                        <NostrIcon size={13} />
                                                    )}
                                                </div>
                                                <div className="comment-compose-input-row">
                                                    <textarea
                                                        ref={el => { commentInputRefs.current[post.id] = el; }}
                                                        className="comment-input"
                                                        placeholder={t('feed.replyTo', { name: getDisplayName(post.pubkey) })}
                                                        value={isReplying ? replyText : ''}
                                                        onChange={(e) => {
                                                            setReplyTarget({ id: post.id, pubkey: post.pubkey });
                                                            setReplyText(e.target.value);
                                                            handleMentionInput(e.target.value, e.target.selectionStart, 'reply');
                                                        }}
                                                        onFocus={() => setReplyTarget({ id: post.id, pubkey: post.pubkey })}
                                                        onBlur={() => setTimeout(() => setMentionAnchor(null), 150)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(post); }
                                                        }}
                                                        rows={1}
                                                    />
                                                    <div className="comment-picker-btns">
                                                        <div className="picker-anchor">
                                                            <button
                                                                className="comment-picker-btn"
                                                                onClick={() => { setCommentEmojiPicker(commentEmojiPicker === post.id ? null : post.id); setCommentGifPicker(null); }}
                                                                title="Emoji"
                                                            >
                                                                <Smile size={14} />
                                                            </button>
                                                            {commentEmojiPicker === post.id && (
                                                                <EmojiPicker
                                                                    onSelect={(emoji) => handleCommentEmoji(post.id, emoji)}
                                                                    onClose={() => setCommentEmojiPicker(null)}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="picker-anchor">
                                                            <button
                                                                className="comment-picker-btn"
                                                                onClick={() => { setCommentGifPicker(commentGifPicker === post.id ? null : post.id); setCommentEmojiPicker(null); }}
                                                                title="GIF"
                                                            >
                                                                <span className="gif-label-sm">GIF</span>
                                                            </button>
                                                            {commentGifPicker === post.id && (
                                                                <NostrGifPicker
                                                                    onSelect={(url) => handleCommentGif(post.id, post.pubkey, url)}
                                                                    onClose={() => setCommentGifPicker(null)}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="comment-send-btn"
                                                        onClick={() => handleReply(post)}
                                                        disabled={!isReplying || !replyText.trim() || replyPosting}
                                                    >
                                                        {replyPosting && isReplying ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Mention dropdown for replies */}
                                            {isReplying && mentionAnchor?.field === 'reply' && (mentionResults.length > 0 || mentionLoading) && (
                                                <div className="mention-dropdown mention-dropdown-reply">
                                                    {mentionLoading && mentionResults.length === 0 && (
                                                        <div className="mention-loading"><Loader2 size={12} className="spin" /> {t('feed.searching')}</div>
                                                    )}
                                                    {mentionResults.map(p => (
                                                        <button key={p.pubkey} className="mention-item" onMouseDown={(e) => { e.preventDefault(); handleMentionSelect(p); }}>
                                                            {p.picture ? (
                                                                <img src={p.picture} className="mention-avatar" alt="" />
                                                            ) : (
                                                                <div className="mention-avatar-placeholder"><NostrIcon size={12} /></div>
                                                            )}
                                                            <div className="mention-info">
                                                                <span className="mention-name">{p.display_name || p.name || p.pubkey.slice(0, 10)}</span>
                                                                {p.nip05 && <span className="mention-nip05">{p.nip05}</span>}
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {loadingComments[post.id] && postComments.length === 0 && (
                                                <div className="comment-loading">
                                                    <Loader2 size={14} className="spin" /> {t('feed.loadingComments')}
                                                </div>
                                            )}

                                            {(() => {
                                                const limit = visibleCommentCount[post.id] || 5;
                                                const latest = postComments.slice(-limit).reverse();
                                                const hiddenCount = postComments.length - limit;
                                                return (
                                                    <>
                                                        {latest.map(comment => {
                                                            const { text: ct, images: ci, otherMedia: cm } = parseNoteContent(comment.content);
                                                            return (
                                                                <div key={comment.id} className="comment-item">
                                                                    <div className="comment-avatar">
                                                                        {getAvatar(comment.pubkey) ? (
                                                                            <img src={getAvatar(comment.pubkey)} alt="" />
                                                                        ) : (
                                                                            <NostrIcon size={13} />
                                                                        )}
                                                                    </div>
                                                                    <div className="comment-body">
                                                                        <div className="comment-meta">
                                                                            <span className="comment-name">{getDisplayName(comment.pubkey)}</span>
                                                                            <span className="comment-time">{formatTime(comment.created_at)}</span>
                                                                        </div>
                                                                        {ct && <div className="comment-text">{renderContent(ct)}</div>}
                                                                        {ci.length > 0 && (
                                                                            <div className="comment-images">
                                                                                {ci.map((src, i) => (
                                                                                    <img key={i} src={src} alt="" className="comment-img" onClick={(e) => { e.stopPropagation(); openLightbox(src, ci); }} />
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        <div className="comment-actions">
                                                                            <button
                                                                                className="comment-action-btn"
                                                                                onClick={() => handleCommentReply(post.id, comment)}
                                                                            >
                                                                                <MessageCircle size={13} />
                                                                                <span>{t('feed.reply')}</span>
                                                                            </button>
                                                                            <button
                                                                                className={`comment-action-btn${likedComments.has(comment.id) ? ' comment-liked' : ''}`}
                                                                                onClick={() => handleCommentLike(comment)}
                                                                            >
                                                                                <Heart size={13} fill={likedComments.has(comment.id) ? 'currentColor' : 'none'} />
                                                                                <span>{t('feed.like')}</span>
                                                                            </button>
                                                                            <button
                                                                                className="comment-action-btn"
                                                                                onClick={() => setZapTarget({
                                                                                    pubkey: comment.pubkey,
                                                                                    name: getDisplayName(comment.pubkey),
                                                                                    avatar: getAvatar(comment.pubkey),
                                                                                    eventId: comment.id,
                                                                                })}
                                                                            >
                                                                                <Zap size={13} />
                                                                                <span>{t('feed.zap')}</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}

                                                        {hiddenCount > 0 && (
                                                            <button
                                                                className="show-more-comments"
                                                                onClick={() => setVisibleCommentCount(prev => ({
                                                                    ...prev,
                                                                    [post.id]: (prev[post.id] || 5) * 2,
                                                                }))}
                                                            >
                                                                {t('feed.showMoreComments', { count: Math.min(hiddenCount, limit) })}
                                                            </button>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {!loadingComments[post.id] && postComments.length === 0 && (
                                                <div className="comment-empty">{t('feed.noReplies')}</div>
                                            )}

                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Load More */}
                        {feedMode === 'explore' && rootPosts.length >= 10 && (
                            <button
                                className="load-more-btn"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? (
                                    <><Loader2 size={16} className="spin" /> {t('feed.loading')}</>
                                ) : (
                                    <><ChevronDown size={16} /> {t('feed.loadMore')}</>
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

            {/* Lightbox */}
            {lightboxSrc && (
                <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
                    <button className="lightbox-close" onClick={() => setLightboxSrc(null)}>
                        <X size={24} />
                    </button>
                    {lightboxGallery.length > 1 && (
                        <button className="lightbox-arrow lightbox-prev" onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}>
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    <img src={lightboxSrc} alt="" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
                    {lightboxGallery.length > 1 && (
                        <button className="lightbox-arrow lightbox-next" onClick={(e) => { e.stopPropagation(); lightboxNext(); }}>
                            <ChevronRight size={32} />
                        </button>
                    )}
                    {lightboxGallery.length > 1 && (
                        <div className="lightbox-counter">{lightboxIndex + 1} / {lightboxGallery.length}</div>
                    )}
                </div>
            )}

            <style jsx>{`
                .feed-page {
                    min-height: calc(100vh - 73px);
                    background: var(--color-gray-50, #f9fafb);
                    padding: 2rem 1rem;
                    overflow-x: hidden;
                }
                @media (max-width: 768px) {
                    .feed-page {
                        padding: 0.5rem 1rem;
                    }
                }
                .feed-container {
                    max-width: 640px;
                    margin: 0 auto;
                    min-width: 0;
                    overflow: hidden;
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

                .feed-tab-refresh.spinning svg {
                    animation: spin 0.8s linear infinite;
                }

                /* Refresh button in tab bar */
                .feed-tab-refresh {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    min-width: 36px;
                    padding: 0.625rem 0;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: transparent;
                    color: #9ca3af;
                    flex-shrink: 0;
                }
                .feed-tab-refresh:hover {
                    color: var(--color-primary, #0047AB);
                    background: #f9fafb;
                }
                .feed-tab-refresh:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
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
                    cursor: text;
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
                .compose-actions-right {
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
                    min-width: 0;
                }
                .feed-note {
                    position: relative;
                    background: var(--color-gray-100);
                    border: 1px solid #e5e7eb;
                    border-radius: var(--radius-xl, 12px);
                    padding: 1.25rem;
                    transition: box-shadow 0.2s, border-color 0.2s;
                    overflow: visible;
                    min-width: 0;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .feed-note:hover {
                    box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1));
                    border-color: #ddd6fe;
                }
                /* Repost label */
                .repost-label {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding-left: 52px;
                    margin-bottom: 0.35rem;
                    color: #22c55e;
                    font-size: 0.78rem;
                    font-weight: 600;
                }

                .note-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.75rem;
                }

                /* Three-dot menu */
                .note-menu-wrapper {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    z-index: 10;
                }
                .note-menu-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: transparent;
                    color: #9ca3af;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: background 0.12s, color 0.12s;
                }
                .note-menu-btn:hover {
                    background: #f3f4f6;
                    color: #6b7280;
                }
                .note-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 4px;
                    background: var(--color-surface, white);
                    border: 1px solid #e5e7eb;
                    border-radius: 12px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                    z-index: 9999;
                    overflow: hidden;
                    min-width: 200px;
                }
                .note-menu-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    width: 100%;
                    padding: 0.6rem 0.85rem;
                    border: none;
                    background: transparent;
                    color: var(--color-gray-900, #1f2937);
                    font-size: 0.82rem;
                    font-family: inherit;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 0.12s;
                }
                .note-menu-item:hover {
                    background: #f3f4f6;
                }
                .note-menu-item + .note-menu-item {
                    border-top: 1px solid #f3f4f6;
                }
                .note-menu-danger {
                    color: #ef4444;
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

                /* Repost relay choice dropdown */
                .repost-wrapper {
                    position: relative;
                }
                .repost-menu {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    margin-bottom: 6px;
                    background: var(--color-surface, white);
                    border: 1px solid #e5e7eb;
                    border-radius: 10px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                    z-index: 9999;
                    overflow: hidden;
                    min-width: 200px;
                }
                .repost-menu-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.55rem 0.85rem;
                    border: none;
                    background: transparent;
                    color: var(--color-gray-900, #1f2937);
                    font-size: 0.82rem;
                    font-family: inherit;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: background 0.12s;
                }
                .repost-menu-item:hover {
                    background: #f3f4f6;
                }
                .repost-menu-item:first-child {
                    border-bottom: 1px solid #f3f4f6;
                }

                /* Media in notes */
                .note-media {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-top: 0.75rem;
                    overflow: hidden;
                    max-width: 100%;
                    padding-left: 52px;
                    box-sizing: border-box;
                }
                .note-media-img {
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 12px;
                    object-fit: contain;
                }
                .note-media-video {
                    width: 100%;
                    max-width: 100%;
                    max-height: 500px;
                    border-radius: 12px;
                    aspect-ratio: 16/9;
                    border: none;
                    object-fit: contain;
                    box-sizing: border-box;
                }
                .note-media-audio {
                    width: 100%;
                    border-radius: 8px;
                }

                /* Comment section */
                .comment-section {
                    margin-top: 0.75rem;
                    border-top: 1px solid #ede9fe;
                    padding-top: 0.75rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .comment-loading {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: #9ca3af;
                    padding: 0.25rem 0;
                }
                .comment-empty {
                    font-size: 0.8rem;
                    color: #9ca3af;
                    text-align: center;
                    padding: 0.5rem 0;
                }
                .comment-item {
                    display: flex;
                    gap: 0.6rem;
                    align-items: flex-start;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                }
                .comment-item:last-of-type {
                    border-bottom: none;
                    padding-bottom: 0;
                }
                .comment-avatar {
                    width: 28px;
                    height: 28px;
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
                .comment-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .comment-body {
                    flex: 1;
                    min-width: 0;
                }
                .show-more-comments {
                    background: none;
                    border: none;
                    color: #f97316;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0.25rem 0;
                    text-align: center;
                    display: block;
                    width: 100%;
                }
                .show-more-comments:hover {
                    text-decoration: underline;
                }
                .comment-meta {
                    display: flex;
                    align-items: baseline;
                    gap: 0.5rem;
                    margin-bottom: 0.15rem;
                }
                .comment-name {
                    font-weight: 600;
                    font-size: 0.8rem;
                    color: #1f2937;
                }
                .comment-time {
                    font-size: 0.72rem;
                    color: #9ca3af;
                }
                .comment-text {
                    font-size: 0.875rem;
                    color: #374151;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .comment-images {
                    display: flex;
                    gap: 4px;
                    margin-top: 0.4rem;
                    flex-wrap: wrap;
                }
                .comment-img {
                    max-width: 160px;
                    max-height: 120px;
                    border-radius: 8px;
                    object-fit: cover;
                    cursor: pointer;
                }
                .comment-actions {
                    display: flex;
                    gap: 0.75rem;
                    margin-top: 0.3rem;
                }
                .comment-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 0.72rem;
                    cursor: pointer;
                    padding: 0;
                    transition: color 0.15s;
                }
                .comment-action-btn:hover {
                    color: #f97316;
                }
                .comment-action-btn.comment-liked {
                    color: #ef4444;
                }
                .comment-compose {
                    display: flex;
                    gap: 0.6rem;
                    align-items: flex-start;
                    padding-top: 0.25rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid #ede9fe;
                    margin-bottom: 0.25rem;
                }
                .comment-compose-avatar {
                    width: 28px;
                    height: 28px;
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
                .comment-compose-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .comment-compose-input-row {
                    flex: 1;
                    display: flex;
                    gap: 0.5rem;
                    align-items: flex-end;
                }
                .comment-input {
                    flex: 1;
                    border: 1px solid #e5e7eb;
                    border-radius: 20px;
                    padding: 0.45rem 0.85rem;
                    font-size: 0.875rem;
                    font-family: inherit;
                    resize: none;
                    outline: none;
                    background: var(--color-surface, white);
                    color: inherit;
                    box-sizing: border-box;
                    line-height: 1.4;
                    cursor: text;
                }
                .comment-input:focus {
                    border-color: #7c3aed;
                }
                .comment-send-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: #7c3aed;
                    color: white;
                    border: none;
                    cursor: pointer;
                    flex-shrink: 0;
                    transition: opacity 0.2s;
                }
                .comment-send-btn:hover { opacity: 0.85; }
                .comment-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* Picker anchor (relative positioning for popups) */
                .picker-anchor {
                    position: relative;
                }
                .gif-label {
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }
                .comment-picker-btns {
                    display: flex;
                    gap: 0.25rem;
                    align-items: center;
                    flex-shrink: 0;
                }
                .comment-picker-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    border: none;
                    background: transparent;
                    color: #9ca3af;
                    cursor: pointer;
                    transition: all 0.15s;
                    padding: 0;
                }
                .comment-picker-btn:hover {
                    background: #f3f4f6;
                    color: #6b7280;
                }
                .gif-label-sm {
                    font-size: 0.6rem;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }

                :global([data-theme="dark"]) .comment-picker-btn:hover {
                    background: #2d3748;
                    color: #e2e8f0;
                }

                /* Mention dropdown */
                .mention-dropdown {
                    background: var(--color-surface, white);
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
                    max-height: 220px;
                    overflow-y: auto;
                    margin: 0.25rem 0 0.25rem 52px;
                }
                .mention-dropdown-reply {
                    margin: 0 0 0.25rem 34px;
                }
                .mention-loading {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.78rem;
                    color: #9ca3af;
                    padding: 0.5rem 0.75rem;
                }
                .mention-item {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    width: 100%;
                    padding: 0.45rem 0.75rem;
                    background: none;
                    border: none;
                    border-bottom: 1px solid #f3f4f6;
                    cursor: pointer;
                    text-align: left;
                    transition: background 0.12s;
                }
                .mention-item:last-child { border-bottom: none; }
                .mention-item:hover, .mention-item:focus { background: #f5f3ff; outline: none; }
                .mention-avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    object-fit: cover;
                    flex-shrink: 0;
                }
                .mention-avatar-placeholder {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: #ede9fe;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #7c3aed;
                    flex-shrink: 0;
                }
                .mention-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 0;
                    overflow: hidden;
                }
                .mention-name {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: #1f2937;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .mention-nip05 {
                    font-size: 0.7rem;
                    color: #9ca3af;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .note-mention {
                    color: #7c3aed;
                    font-weight: 600;
                    cursor: pointer;
                }
                .note-mention:hover { text-decoration: underline; }
                :global([data-theme="dark"]) .mention-dropdown {
                    background: #1e2a3a;
                    border-color: #2d3748;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                }
                :global([data-theme="dark"]) .mention-item {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .mention-item:hover,
                :global([data-theme="dark"]) .mention-item:focus { background: #2d3748; }
                :global([data-theme="dark"]) .mention-name { color: #f1f5f9; }
                :global([data-theme="dark"]) .note-mention { color: #a78bfa; }

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

                /* Lightbox */
                .lightbox-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .lightbox-close {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: rgba(255,255,255,0.15);
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    cursor: pointer;
                    transition: background 0.2s;
                    z-index: 10001;
                }
                .lightbox-close:hover { background: rgba(255,255,255,0.3); }
                .lightbox-img {
                    max-width: 90vw;
                    max-height: 90vh;
                    object-fit: contain;
                    border-radius: 8px;
                    cursor: default;
                }
                .lightbox-arrow {
                    position: fixed;
                    top: 50%;
                    transform: translateY(-50%);
                    background: rgba(0,0,0,0.5);
                    border: none;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 8px;
                    cursor: pointer;
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .lightbox-arrow:hover { background: rgba(0,0,0,0.7); }
                .lightbox-prev { left: 1rem; }
                .lightbox-next { right: 1rem; }
                .lightbox-counter {
                    position: fixed;
                    bottom: 2rem;
                    left: 50%;
                    transform: translateX(-50%);
                    color: white;
                    background: rgba(0,0,0,0.5);
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    z-index: 10001;
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
                :global([data-theme="dark"]) .note-menu-btn {
                    color: #64748b;
                }
                :global([data-theme="dark"]) .note-menu-btn:hover {
                    background: #2d3748;
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .note-menu {
                    background: #1e2a3a;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .note-menu-item {
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .note-menu-item:hover {
                    background: #2d3748;
                }
                :global([data-theme="dark"]) .note-menu-item + .note-menu-item {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .note-menu-danger {
                    color: #f87171;
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
                :global([data-theme="dark"]) .action-btn.active-repost { color: #22c55e; }
                :global([data-theme="dark"]) .action-btn.active-like { color: #ef4444; }
                :global([data-theme="dark"]) .action-btn.active-reply { color: #7c3aed; }
                :global([data-theme="dark"]) .repost-menu {
                    background: #1e2a3a;
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .repost-menu-item {
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .repost-menu-item:hover {
                    background: #2d3748;
                }
                :global([data-theme="dark"]) .repost-menu-item:first-child {
                    border-color: #2d3748;
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
                :global([data-theme="dark"]) .feed-tab-refresh {
                    color: #94a3b8;
                }
                :global([data-theme="dark"]) .feed-tab-refresh:hover {
                    background: #2d3748;
                    color: #60a5fa;
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
                :global([data-theme="dark"]) .comment-section {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .comment-compose {
                    border-color: #2d3748;
                }
                :global([data-theme="dark"]) .comment-item {
                    border-color: rgba(255, 255, 255, 0.08);
                }
                :global([data-theme="dark"]) .comment-name {
                    color: #f1f5f9;
                }
                :global([data-theme="dark"]) .comment-text {
                    color: #e2e8f0;
                }
                :global([data-theme="dark"]) .comment-action-btn {
                    color: #64748b;
                }
                :global([data-theme="dark"]) .comment-action-btn:hover {
                    color: #f97316;
                }
                :global([data-theme="dark"]) .comment-input {
                    background: #0f172a;
                    border-color: #2d3748;
                    color: #f1f5f9;
                }
                :global([data-theme="dark"]) .comment-input:focus {
                    border-color: #7c3aed;
                }
            `}</style>
        </div>
    );
};

export default Feed;
