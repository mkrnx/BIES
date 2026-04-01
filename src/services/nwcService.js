/**
 * NIP-47 Nostr Wallet Connect (NWC) Service
 *
 * Manages NWC connections for one-click Lightning payments.
 * Parses nostr+walletconnect:// URIs, sends pay_invoice requests (kind:23194),
 * and listens for responses (kind:23195).
 *
 * Connection secrets are stored in localStorage only — never sent to the server.
 */

import { SimplePool, finalizeEvent, getPublicKey } from 'nostr-tools';
import { encrypt as nip04Encrypt, decrypt as nip04Decrypt } from 'nostr-tools/nip04';

const NWC_STORAGE_KEY = 'bies_nwc_uri';
const REQUEST_TIMEOUT_MS = 15_000;
const RELAY_CONNECT_TIMEOUT_MS = 5_000;

/**
 * Parse a nostr+walletconnect:// URI into its components.
 *
 * Format: nostr+walletconnect://<walletPubkey>?relay=<url>&secret=<hex>
 *
 * @param {string} uri
 * @returns {{ walletPubkey: string, relay: string, secret: Uint8Array, clientPubkey: string }}
 */
export function parseNwcUri(uri) {
    if (!uri || !uri.startsWith('nostr+walletconnect://')) {
        throw new Error('Invalid NWC URI: must start with nostr+walletconnect://');
    }

    // Extract pubkey and query string
    const withoutScheme = uri.replace('nostr+walletconnect://', '');
    const questionIdx = withoutScheme.indexOf('?');
    if (questionIdx === -1) {
        throw new Error('Invalid NWC URI: missing query parameters');
    }

    const walletPubkey = withoutScheme.slice(0, questionIdx);
    const params = new URLSearchParams(withoutScheme.slice(questionIdx + 1));

    const relay = params.get('relay');
    const secretHex = params.get('secret');

    if (!walletPubkey || walletPubkey.length !== 64) {
        throw new Error('Invalid NWC URI: wallet pubkey must be 64 hex chars');
    }
    if (!relay) {
        throw new Error('Invalid NWC URI: missing relay parameter');
    }
    if (!secretHex || secretHex.length !== 64) {
        throw new Error('Invalid NWC URI: secret must be 64 hex chars');
    }

    const secret = hexToBytes(secretHex);
    const clientPubkey = getPublicKey(secret);

    return { walletPubkey, relay, secret, clientPubkey };
}

/**
 * NWC Client — handles encrypted communication with a wallet service.
 */
class NwcClient {
    constructor() {
        this.pool = new SimplePool();
        this.connection = null; // { walletPubkey, relay, secret, clientPubkey }
    }

    /** @returns {boolean} Whether a wallet is currently connected */
    get connected() {
        return this.connection !== null;
    }

    /**
     * Connect to a wallet using an NWC URI.
     * @param {string} uri - nostr+walletconnect:// URI
     */
    connect(uri) {
        this.connection = parseNwcUri(uri);
        localStorage.setItem(NWC_STORAGE_KEY, uri);
    }

    /**
     * Disconnect from the current wallet.
     */
    disconnect() {
        this.connection = null;
        localStorage.removeItem(NWC_STORAGE_KEY);
    }

    /**
     * Restore connection from localStorage (if saved).
     * @returns {boolean} Whether a connection was restored
     */
    restore() {
        const uri = localStorage.getItem(NWC_STORAGE_KEY);
        if (!uri) return false;
        try {
            this.connection = parseNwcUri(uri);
            return true;
        } catch (err) {
            console.warn('[NWC] Failed to restore connection:', err.message);
            localStorage.removeItem(NWC_STORAGE_KEY);
            return false;
        }
    }

    /**
     * Pay a Lightning invoice via the connected wallet.
     *
     * Flow:
     * 1. Create NIP-47 request (kind:23194) with encrypted pay_invoice payload
     * 2. Publish to the NWC relay
     * 3. Subscribe for the kind:23195 response
     * 4. Return the result (preimage on success, error on failure)
     *
     * @param {string} bolt11 - Lightning invoice (BOLT-11)
     * @returns {Promise<{ preimage: string }>}
     */
    async payInvoice(bolt11) {
        if (!this.connection) {
            throw new Error('No wallet connected');
        }

        const { walletPubkey, relay, secret, clientPubkey } = this.connection;

        // Build the NIP-47 request payload
        const requestPayload = JSON.stringify({
            method: 'pay_invoice',
            params: { invoice: bolt11 },
        });

        // NIP-04 encrypt for the wallet service (NIP-47 spec)
        const encrypted = nip04Encrypt(secret, walletPubkey, requestPayload);

        // Create and sign the kind:23194 request event
        const requestEvent = finalizeEvent({
            kind: 23194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', walletPubkey]],
            content: encrypted,
        }, secret);

        // Subscribe for the response BEFORE publishing (to avoid race condition)
        const responsePromise = this._waitForResponse(relay, walletPubkey, clientPubkey, requestEvent.id, secret);

        // Publish to the NWC relay
        try {
            await Promise.any(this.pool.publish([relay], requestEvent));
        } catch (err) {
            // If publish fails, cancel the response subscription
            responsePromise.catch(() => {}); // prevent unhandled rejection
            throw new Error('Failed to send payment request to NWC relay');
        }

        // Wait for the wallet's response
        return responsePromise;
    }

    /**
     * Get the wallet balance (optional — not all wallets support this).
     * @returns {Promise<{ balance: number }>} Balance in msats
     */
    async getBalance() {
        if (!this.connection) {
            throw new Error('No wallet connected');
        }

        const { walletPubkey, relay, secret, clientPubkey } = this.connection;

        const requestPayload = JSON.stringify({
            method: 'get_balance',
        });

        const encrypted = nip04Encrypt(secret, walletPubkey, requestPayload);

        const requestEvent = finalizeEvent({
            kind: 23194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', walletPubkey]],
            content: encrypted,
        }, secret);

        const responsePromise = this._waitForResponse(relay, walletPubkey, clientPubkey, requestEvent.id, secret);

        await Promise.any(this.pool.publish([relay], requestEvent));

        return responsePromise;
    }

    /**
     * Subscribe to the NWC relay for a kind:23195 response matching our request.
     * @private
     */
    _waitForResponse(relay, walletPubkey, clientPubkey, requestEventId, secret) {
        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn, value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                try { sub?.close(); } catch {}
                fn(value);
            };

            const timeout = setTimeout(() => {
                settle(reject, new Error('Wallet did not respond in time. Check your NWC connection.'));
            }, REQUEST_TIMEOUT_MS);

            const sub = this.pool.subscribeMany(
                [relay],
                {
                    kinds: [23195],
                    authors: [walletPubkey],
                    '#p': [clientPubkey],
                    '#e': [requestEventId],
                    since: Math.floor(Date.now() / 1000) - 10,
                },
                {
                    onevent: async (event) => {
                        try {
                            const decrypted = nip04Decrypt(secret, walletPubkey, event.content);
                            const response = JSON.parse(decrypted);

                            if (response.error) {
                                settle(reject, new Error(response.error.message || 'Wallet returned an error'));
                            } else {
                                settle(resolve, response.result || response);
                            }
                        } catch (err) {
                            settle(reject, new Error('Failed to decrypt wallet response: ' + err.message));
                        }
                    },
                    onclose: (reasons) => {
                        const reason = Array.isArray(reasons) ? reasons.join(', ') : String(reasons);
                        settle(reject, new Error('NWC relay connection closed: ' + reason));
                    },
                }
            );
        });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// Singleton
export const nwcClient = new NwcClient();
