import { SimplePool, nip19 } from 'nostr-tools';

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
        // SimplePool handles connections automatically when sub/get is called
        return true;
    }

    // Subscribe to posts (Kind 1) from specific authors
    subscribeToFeed(authors, callback) {
        // Ensure authors are hex keys
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

        return sub; // Return sub to allow cleanup
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

    // Subscribe to DMs (Kind 4 - NIP-04)
    // Note: This requires the user's private key (or extension) to decrypt
    // For now we just fetch the events, decryption happens in the component/hook using window.nostr
    subscribeToDMs(myPubkey, callback) {
        const sub = this.pool.subscribeMany(
            this.relays,
            [
                {
                    kinds: [4], // Direct Message
                    '#p': [myPubkey], // Received by me
                    limit: 50
                },
                {
                    kinds: [4],
                    authors: [myPubkey], // Sent by me
                    limit: 50
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

    // Publish event (Kind 1 or 4) via Window.Nostr (NIP-07)
    async publishEvent(event) {
        if (!window.nostr) {
            throw new Error("Nostr extension not found");
        }

        try {
            const signedEvent = await window.nostr.signEvent(event);
            return Promise.any(this.pool.publish(this.relays, signedEvent));
        } catch (error) {
            console.error("Error publishing event:", error);
            throw error;
        }
    }

    // Helper to encrypt and send DM (NIP-04)
    async sendDM(recipientPubkey, content) {
        if (!window.nostr) {
            throw new Error("Nostr extension not found");
        }

        try {
            // NIP-04 encryption
            const ciphertext = await window.nostr.nip04.encrypt(recipientPubkey, content);

            const event = {
                kind: 4,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', recipientPubkey]],
                content: ciphertext,
            };

            return this.publishEvent(event);
        } catch (error) {
            console.error("Error sending DM:", error);
            throw error;
        }
    }
}

export const nostrService = new NostrService();
