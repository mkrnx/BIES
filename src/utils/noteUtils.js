import { nip19 } from 'nostr-tools';

/**
 * Relative time formatter for Nostr event timestamps.
 */
export const formatTime = (timestamp) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`;
    return `${Math.floor(diff / 31536000)}y`;
};

/**
 * Split note content into text, images, and other media (video/audio/youtube).
 */
export const parseNoteContent = (content) => {
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

/**
 * Get a human-readable display name for a Nostr pubkey.
 * Accepts a profiles map (object keyed by hex pubkey).
 */
export const getDisplayName = (pubkey, profiles) => {
    const profile = profiles?.[pubkey];
    if (profile?.display_name) return profile.display_name;
    if (profile?.name) return profile.name;
    try {
        const npub = nip19.npubEncode(pubkey);
        return npub.substring(0, 12) + '...';
    } catch {
        return pubkey.substring(0, 12) + '...';
    }
};
