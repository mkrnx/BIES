import { SimplePool, nip19, finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';

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
];

// All relays (BIES relay first for priority)
export const NOSTR_RELAYS = [BIES_RELAY, ...PUBLIC_RELAYS];

class NostrService {
    constructor() {
        this.pool = new SimplePool();
        this.relays = NOSTR_RELAYS;
        this.biesRelay = BIES_RELAY;
        this.publicRelays = PUBLIC_RELAYS;
    }

    async connect() {
        return true;
    }

    // Subscribe to posts (Kind 1) from specific authors
    subscribeToFeed(authors, callback) {
        const authorsHex = authors.map(a => a.startsWith('npub') ? nip19.decode(a).data : a);

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
                }
            }
        );

        return sub;
    }

    // Fetch user profile (Kind 0)
    async getProfile(pubkey) {
        try {
            const event = await this.pool.get(this.relays, {
                kinds: [0],
                authors: [pubkey],
            });
            return event ? JSON.parse(event.content) : null;
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
        if (!window.nostr) {
            throw new Error('Nostr extension not found');
        }

        const senderPubkey = await window.nostr.getPublicKey();
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
        // We need the sender to sign the seal, so we use window.nostr
        const rumorJson = JSON.stringify(rumor);

        // Encrypt rumor with NIP-44 for recipient
        let encryptedForRecipient;
        if (window.nostr.nip44) {
            encryptedForRecipient = await window.nostr.nip44.encrypt(recipientPubkey, rumorJson);
        } else {
            throw new Error('Your Nostr extension does not support NIP-44 encryption. Please update your extension.');
        }

        const sealForRecipient = await window.nostr.signEvent({
            kind: 13,
            created_at: now + randomOffset,
            tags: [],
            content: encryptedForRecipient,
        });

        // Step 3: Gift-wrap for recipient (kind:1059) with random throwaway key
        const recipientGiftWrap = this._createGiftWrap(sealForRecipient, recipientPubkey, now);

        // Step 4: Create seal + gift-wrap for sender (so they can see sent messages)
        let encryptedForSender;
        if (window.nostr.nip44) {
            encryptedForSender = await window.nostr.nip44.encrypt(senderPubkey, rumorJson);
        }

        const sealForSender = await window.nostr.signEvent({
            kind: 13,
            created_at: now + randomOffset,
            tags: [],
            content: encryptedForSender,
        });

        const senderGiftWrap = this._createGiftWrap(sealForSender, senderPubkey, now);

        // Publish both gift-wraps
        await Promise.allSettled([
            ...this.pool.publish(this.relays, recipientGiftWrap),
            ...this.pool.publish(this.relays, senderGiftWrap),
        ]);

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
        const sub = this.pool.subscribeMany(
            this.relays,
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
        if (!window.nostr?.nip44) {
            throw new Error('NIP-44 not supported by extension');
        }

        // Step 1: Decrypt the gift-wrap to get the seal
        const sealJson = await window.nostr.nip44.decrypt(giftWrapEvent.pubkey, giftWrapEvent.content);
        const seal = JSON.parse(sealJson);

        if (seal.kind !== 13) {
            throw new Error('Invalid seal kind: ' + seal.kind);
        }

        // Step 2: Decrypt the seal to get the rumor
        const rumorJson = await window.nostr.nip44.decrypt(seal.pubkey, seal.content);
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
            { onevent: (event) => callback(event) }
        );
        return sub;
    }

    async publishEvent(event) {
        if (!window.nostr) {
            throw new Error('Nostr extension not found');
        }
        const signedEvent = await window.nostr.signEvent(event);
        return Promise.any(this.pool.publish(this.relays, signedEvent));
    }

    async sendDM(recipientPubkey, content) {
        // Use NIP-17 by default
        return this.sendNip17DM(recipientPubkey, content);
    }
}

export const nostrService = new NostrService();
