import { useState, useEffect, useRef } from 'react';
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
            // Fetch profile if not already fetched
            if (!profiles[event.pubkey]) {
                const profile = await nostrService.getProfile(event.pubkey);
                setProfiles(prev => ({
                    ...prev,
                    [event.pubkey]: profile
                }));
            }

            setPosts(prev => {
                // Deduplicate based on id
                if (prev.find(p => p.id === event.id)) return prev;
                // Add new post and sort by created_at desc
                const newPosts = [...prev, event].sort((a, b) => b.created_at - a.created_at);
                return newPosts;
            });
            setLoading(false);
        });

        return () => {
            if (sub) sub.close();
        };
    }, [JSON.stringify(npubs)]); // stringify to compare array content

    return { posts, loading, profiles };
};

export const useNostrDMs = () => {
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState({});
    const [loading, setLoading] = useState(false);
    const [publicKey, setPublicKey] = useState(null);
    const [error, setError] = useState(null);

    const connect = async () => {
        setLoading(true);
        setError(null);

        try {
            if (!window.nostr) {
                throw new Error("Nostr extension not found. Please install Alby or nos2x.");
            }

            const pubkey = await window.nostr.getPublicKey();
            setPublicKey(pubkey);

            nostrService.subscribeToDMs(pubkey, async (event) => {
                // Determine counterpart
                const isSender = event.pubkey === pubkey;
                const otherParty = isSender
                    ? event.tags.find(t => t[0] === 'p')?.[1]
                    : event.pubkey;

                if (!otherParty) return;

                // Try to decrypt content
                // Note: This might prompt user for each message if not handled carefully by extension
                // For better UX, we usually only decrypt active chat or list preview
                // Here we fetch metadata but decrypting might be done on demand or carefully

                // For now, let's just group them
                setMessages(prev => {
                    if (prev.find(m => m.id === event.id)) return prev;
                    return [...prev, event].sort((a, b) => a.created_at - b.created_at);
                });
            });

        } catch (err) {
            console.error("Failed to connect Nostr:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const decryptMessage = async (peerPubkey, ciphertext) => {
        if (!window.nostr) return "[Encrypted]";
        try {
            return await window.nostr.nip04.decrypt(peerPubkey, ciphertext);
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Decryption Error]";
        }
    };

    const sendMessage = async (recipientPubkey, content) => {
        return nostrService.sendDM(recipientPubkey, content);
    };

    return {
        messages,
        conversations,
        loading,
        error,
        connect,
        publicKey,
        decryptMessage,
        sendMessage
    };
};
