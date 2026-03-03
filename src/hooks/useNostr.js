import { useState, useEffect, useRef, useCallback } from 'react';
import { nostrService } from '../services/nostrService';
import { nip19 } from 'nostr-tools';

export const useNostrFeed = (npubs) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState({});

    useEffect(() => {
        if (!npubs || npubs.length === 0) return;

        setLoading(true);
        const sub = nostrService.subscribeToFeed(npubs, async (event) => {
            if (!profiles[event.pubkey]) {
                const profile = await nostrService.getProfile(event.pubkey);
                setProfiles(prev => ({
                    ...prev,
                    [event.pubkey]: profile
                }));
            }

            setPosts(prev => {
                if (prev.find(p => p.id === event.id)) return prev;
                const newPosts = [...prev, event].sort((a, b) => b.created_at - a.created_at);
                return newPosts;
            });
            setLoading(false);
        });

        return () => {
            if (sub) sub.close();
        };
    }, [JSON.stringify(npubs)]);

    return { posts, loading, profiles };
};

/**
 * NIP-17 Direct Messages hook
 *
 * Subscribes to kind:1059 gift-wraps, unwraps them to extract kind:14 rumors,
 * and groups messages by conversation partner.
 */
export const useNostrDMs = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [publicKey, setPublicKey] = useState(null);
    const [error, setError] = useState(null);
    const [profiles, setProfiles] = useState({});
    const subRef = useRef(null);
    const processedIds = useRef(new Set());

    const connect = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            if (!window.nostr) {
                throw new Error('Nostr extension not found. Please install Alby or nos2x.');
            }

            if (!window.nostr.nip44) {
                throw new Error('Your Nostr extension does not support NIP-44. Please update to the latest version.');
            }

            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);

            // Subscribe to NIP-17 gift-wraps (kind:1059)
            subRef.current = nostrService.subscribeToNip17DMs(pubkey, async (giftWrapEvent) => {
                // Skip already processed
                if (processedIds.current.has(giftWrapEvent.id)) return;
                processedIds.current.add(giftWrapEvent.id);

                try {
                    const { rumor, sealPubkey } = await nostrService.unwrapGiftWrap(giftWrapEvent);

                    // Determine the conversation partner
                    const isSender = sealPubkey === pubkey;
                    const partnerPubkey = isSender
                        ? rumor.tags.find(t => t[0] === 'p')?.[1]
                        : sealPubkey;

                    if (!partnerPubkey) return;

                    // Fetch partner profile if not cached
                    if (!profiles[partnerPubkey]) {
                        nostrService.getProfile(partnerPubkey).then(profile => {
                            if (profile) {
                                setProfiles(prev => ({ ...prev, [partnerPubkey]: profile }));
                            }
                        });
                    }

                    const dm = {
                        id: giftWrapEvent.id,
                        content: rumor.content,
                        created_at: rumor.created_at,
                        senderPubkey: sealPubkey,
                        partnerPubkey,
                        isSender,
                    };

                    setMessages(prev => {
                        if (prev.find(m => m.id === dm.id)) return prev;
                        return [...prev, dm].sort((a, b) => a.created_at - b.created_at);
                    });
                } catch (err) {
                    // Skip messages we can't decrypt (not for us, corrupted, etc.)
                    console.debug('Could not unwrap gift-wrap:', err.message);
                }
            });

        } catch (err) {
            console.error('Failed to connect Nostr DMs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Cleanup subscription on unmount
    useEffect(() => {
        return () => {
            if (subRef.current) {
                subRef.current.close();
            }
        };
    }, []);

    const sendMessage = useCallback(async (recipientPubkey, content) => {
        const rumor = await nostrService.sendNip17DM(recipientPubkey, content);

        // Optimistically add to local messages
        const dm = {
            id: 'pending-' + Date.now(),
            content: rumor.content,
            created_at: rumor.created_at,
            senderPubkey: publicKey,
            partnerPubkey: recipientPubkey,
            isSender: true,
        };

        setMessages(prev => [...prev, dm]);
        return dm;
    }, [publicKey]);

    // Group messages by conversation partner
    const conversations = messages.reduce((acc, msg) => {
        const key = msg.partnerPubkey;
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
    }, {});

    return {
        messages,
        conversations,
        profiles,
        loading,
        error,
        connect,
        publicKey,
        sendMessage,
    };
};
