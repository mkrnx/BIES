import { SimplePool, nip19, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';
import { nostrSigner } from './nostrSigner.js';

// Private BIES relay (set via env or falls back to relative WebSocket URL)
export const BIES_RELAY = import.meta.env.VITE_NOSTR_RELAY || (
    typeof window !== 'undefined'
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/relay`
        : 'ws://localhost:7777'
);

// Public relays for fetching external profiles/content
export const PUBLIC_RELAYS = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://purplepag.es',
];

// Relays used for NIP-17 DMs — only public relays because gift-wraps are
// signed by throwaway keys that aren't on the BIES relay whitelist.
export const DM_RELAYS = [...PUBLIC_RELAYS];

// All relays (BIES relay first for priority)
export const NOSTR_RELAYS = [BIES_RELAY, ...PUBLIC_RELAYS];

/**
 * NIP-42 auth handler — signs the AUTH challenge event so the BIES
 * private relay allows read/write access.  Uses the unified signer
 * (in-memory key or browser extension, depending on login method).
 */
async function handleRelayAuth(evt) {
    return nostrSigner.signEvent(evt);
}

class NostrService {
    constructor() {
        this.pool = new SimplePool();
        this.relays = NOSTR_RELAYS;
        this.biesRelay = BIES_RELAY;
        this.publicRelays = PUBLIC_RELAYS;
        this.dmRelays = DM_RELAYS;
    }

    async connect() {
        return true;
    }

    // Subscribe to posts (Kind 1) from specific authors
    subscribeToFeed(authors, callback) {
        const authorsHex = authors
            .map(a => {
                try {
                    return a.startsWith('npub') ? nip19.decode(a).data : a;
                } catch (err) {
                    console.warn(`[Nostr] Invalid npub skipped: ${a.slice(0, 20)}...`, err.message);
                    return null;
                }
            })
            .filter(Boolean);

        if (authorsHex.length === 0) {
            console.warn('[Nostr] No valid authors to subscribe to');
            return { close: () => {} };
        }

        const sub = this.pool.subscribeMany(
            this.relays,
            [
                {
                    kinds: [1],
                    authors: authorsHex,
                    limit: 20
                }
            ],
            {
                onevent: (event) => {
                    callback(event);
                },
                onclose: () => {
                    console.log('Subscription closed');
                },
                onauth: handleRelayAuth,
            }
        );

        return sub;
    }

    // Fetch user profile (Kind 0 — NIP-01 + NIP-24 extra metadata fields)
    // Queries all public relays and picks the most recent Kind 0 event,
    // then merges any missing fields from older events so we get the
    // most complete profile (banner, picture, etc.).
    async getProfile(pubkey) {
        try {
            const filter = { kinds: [0], authors: [pubkey] };
            const events = await this.pool.querySync(this.publicRelays, filter);

            if (!events || events.length === 0) return null;

            // Sort newest-first so the primary profile is the latest event
            events.sort((a, b) => b.created_at - a.created_at);

            // Start with the newest event, then merge any missing fields
            // from older events (some relays may have stale Kind 0 that
            // still contains fields like banner that were dropped in a
            // later publish by a client that didn't preserve all fields).
            let merged = {};
            for (const evt of events) {
                try {
                    const data = JSON.parse(evt.content);
                    // Only fill in fields that are missing/empty in merged
                    for (const [key, value] of Object.entries(data)) {
                        if (value && !merged[key]) {
                            merged[key] = value;
                        }
                    }
                } catch {
                    // skip malformed content
                }
            }

            return merged;
        } catch (error) {
            console.error('Error fetching profile:', error);
            return null;
        }
    }

    // ─── NIP-17 Private Direct Messages ──────────────────────────────────────

    /**
     * Send a NIP-17 DM (kind:14 rumor → kind:13 seal → kind:1059 gift-wrap)
     *
     * Flow:
     * 1. Create unsigned kind:14 rumor with message content
     * 2. Sign a kind:13 seal containing NIP-44 encrypted rumor
     * 3. Create kind:1059 gift-wrap with random throwaway key
     * 4. Publish gift-wraps to both sender's and recipient's relays
     */
    async sendNip17DM(recipientPubkey, content) {
        const senderPubkey = await nostrSigner.getPublicKey();
        const now = Math.floor(Date.now() / 1000);
        // Randomize timestamp within +/- 2 days for metadata privacy
        const randomOffset = Math.floor(Math.random() * 172800) - 86400;

        // Step 1: Create kind:14 rumor (unsigned direct message)
        const rumor = {
            kind: 14,
            created_at: now,
            tags: [['p', recipientPubkey]],
            content: content,
            pubkey: senderPubkey,
        };

        // Step 2: Create kind:13 seal — encrypt rumor for recipient
        const rumorJson = JSON.stringify(rumor);

        if (!nostrSigner.hasNip44) {
            throw new Error('NIP-44 encryption not available. Please log in again.');
        }

        const encryptedForRecipient = await nostrSigner.nip44.encrypt(recipientPubkey, rumorJson);

        const sealForRecipient = await nostrSigner.signEvent({
            kind: 13,
            created_at: now + randomOffset,
            tags: [],
            content: encryptedForRecipient,
        });

        // Step 3: Gift-wrap for recipient (kind:1059) with random throwaway key
        const recipientGiftWrap = this._createGiftWrap(sealForRecipient, recipientPubkey, now);

        // Step 4: Create seal + gift-wrap for sender (so they can see sent messages)
        const encryptedForSender = await nostrSigner.nip44.encrypt(senderPubkey, rumorJson);

        const sealForSender = await nostrSigner.signEvent({
            kind: 13,
            created_at: now + randomOffset,
            tags: [],
            content: encryptedForSender,
        });

        const senderGiftWrap = this._createGiftWrap(sealForSender, senderPubkey, now);

        // Publish gift-wraps to DM relays only (not BIES relay — throwaway
        // keys aren't on the whitelist so the private relay would reject them).
        const results = await Promise.allSettled([
            ...this.pool.publish(this.dmRelays, recipientGiftWrap),
            ...this.pool.publish(this.dmRelays, senderGiftWrap),
        ]);

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
            console.warn(`[NIP-17] Published to ${succeeded} relays, ${failed} failed`);
        }
        if (succeeded === 0) {
            throw new Error('Failed to publish DM to any relay');
        }

        return rumor;
    }

    /**
     * Create a kind:1059 gift-wrap using a random throwaway key
     */
    _createGiftWrap(seal, recipientPubkey, baseTimestamp) {
        const randomSk = generateSecretKey();
        const randomPk = getPublicKey(randomSk);
        const randomOffset = Math.floor(Math.random() * 172800) - 86400;

        // NIP-44 encrypt the seal for the recipient using the throwaway key
        const conversationKey = nip44.v2.utils.getConversationKey(randomSk, recipientPubkey);
        const encryptedSeal = nip44.v2.encrypt(JSON.stringify(seal), conversationKey);

        const giftWrap = {
            kind: 1059,
            created_at: baseTimestamp + randomOffset,
            tags: [['p', recipientPubkey]],
            content: encryptedSeal,
            pubkey: randomPk,
        };

        // Sign with throwaway key
        return finalizeEvent(giftWrap, randomSk);
    }

    /**
     * Subscribe to NIP-17 DMs (kind:1059 gift-wraps addressed to myPubkey)
     */
    subscribeToNip17DMs(myPubkey, callback) {
        // Subscribe on DM relays — gift-wraps live on public relays, not the
        // BIES relay (throwaway keys aren't whitelisted there).
        const sub = this.pool.subscribeMany(
            this.dmRelays,
            [
                {
                    kinds: [1059],
                    '#p': [myPubkey],
                    limit: 100,
                }
            ],
            {
                onevent: (event) => {
                    callback(event);
                },
            }
        );
        return sub;
    }

    /**
     * Unwrap a NIP-17 gift-wrap to extract the rumor (kind:14)
     *
     * 1. NIP-44 decrypt gift-wrap content with my key + gift-wrap author pubkey → kind:13 seal
     * 2. NIP-44 decrypt seal content with my key + seal author pubkey → kind:14 rumor
     */
    async unwrapGiftWrap(giftWrapEvent) {
        if (!nostrSigner.hasNip44) {
            throw new Error('NIP-44 decryption not available. Please log in again.');
        }

        // Step 1: Decrypt the gift-wrap to get the seal
        const sealJson = await nostrSigner.nip44.decrypt(giftWrapEvent.pubkey, giftWrapEvent.content);
        const seal = JSON.parse(sealJson);

        if (seal.kind !== 13) {
            throw new Error('Invalid seal kind: ' + seal.kind);
        }

        // Step 2: Decrypt the seal to get the rumor
        const rumorJson = await nostrSigner.nip44.decrypt(seal.pubkey, seal.content);
        const rumor = JSON.parse(rumorJson);

        if (rumor.kind !== 14) {
            throw new Error('Invalid rumor kind: ' + rumor.kind);
        }

        return {
            rumor,
            sealPubkey: seal.pubkey, // The actual sender
            giftWrapId: giftWrapEvent.id,
        };
    }

    // Legacy NIP-04 methods (kept for backward compatibility)
    subscribeToDMs(myPubkey, callback) {
        const sub = this.pool.subscribeMany(
            this.relays,
            [
                { kinds: [4], '#p': [myPubkey], limit: 50 },
                { kinds: [4], authors: [myPubkey], limit: 50 }
            ],
            { onevent: (event) => callback(event), onauth: handleRelayAuth }
        );
        return sub;
    }

    async publishEvent(event) {
        const signedEvent = await nostrSigner.signEvent(event);
        return Promise.any(this.pool.publish(this.relays, signedEvent, { onauth: handleRelayAuth }));
    }

    /**
     * Update the user's Nostr profile (kind:0 metadata).
     * Signs via browser extension and publishes to all relays.
     * @param {Object} profileData - { name, about, picture, website, nip05, banner, lud16, ... }
     * @returns {Promise} resolves when published to at least one relay
     */
    async updateProfile(profileData) {
        const pubkey = await nostrSigner.getPublicKey();

        // Fetch existing kind:0 to preserve fields we're not editing
        const existing = await this.getProfile(pubkey);
        const merged = { ...existing, ...profileData };

        // Remove null/undefined values
        Object.keys(merged).forEach(k => {
            if (merged[k] == null || merged[k] === '') delete merged[k];
        });

        const event = {
            kind: 0,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify(merged),
        };

        return this.publishEvent(event);
    }

    /**
     * Search Nostr profiles by name using NIP-50 search on relay.nostr.band.
     * Returns an array of { pubkey, name, display_name, picture, nip05 }.
     */
    async searchProfiles(query, limit = 10) {
        try {
            const events = await this.pool.querySync(
                ['wss://relay.nostr.band'],
                {
                    kinds: [0],
                    search: query,
                    limit,
                }
            );

            return events.map(event => {
                try {
                    const profile = JSON.parse(event.content);
                    return {
                        pubkey: event.pubkey,
                        name: profile.name || '',
                        display_name: profile.display_name || '',
                        picture: profile.picture || '',
                        nip05: profile.nip05 || '',
                    };
                } catch {
                    return null;
                }
            }).filter(Boolean);
        } catch (error) {
            console.error('Nostr profile search failed:', error);
            return [];
        }
    }

    /**
     * Publish a NIP-99 classified listing (kind:30402) for a project.
     * For Nostr-native users — signs via browser extension.
     */
    async publishProjectListing(project) {
        const pubkey = await nostrSigner.getPublicKey();
        const tags = [
            ['d', project.id],
            ['title', project.title],
            ['summary', (project.description || '').substring(0, 200)],
            ['t', (project.category || 'other').toLowerCase()],
            ['t', (project.stage || 'idea').toLowerCase()],
            ['t', 'bies'],
            ['t', 'investment'],
        ];

        if (project.fundingGoal) {
            tags.push(['price', String(project.fundingGoal), 'USD']);
        }
        if (project.thumbnail) {
            tags.push(['image', project.thumbnail]);
        }
        if (project.location) {
            tags.push(['location', project.location]);
        }

        const event = {
            kind: 30402,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: project.description || '',
        };

        return this.publishEvent(event);
    }

    /**
     * Publish a NIP-65 relay list metadata event (kind:10002).
     * For Nostr-native users — signs via browser extension.
     * Tags BIES relay as write, public relays as read.
     */
    async publishRelayList() {
        const pubkey = await nostrSigner.getPublicKey();
        const tags = [
            ['r', this.biesRelay, 'write'],
            ...this.publicRelays.map(relay => ['r', relay, 'read']),
        ];

        const event = {
            kind: 10002,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: '',
        };

        return this.publishEvent(event);
    }

    async sendDM(recipientPubkey, content) {
        // Use NIP-17 by default
        return this.sendNip17DM(recipientPubkey, content);
    }
}

export const nostrService = new NostrService();
