/**
 * nostrConnectService — NIP-46 remote signer (Nostr Connect) support.
 *
 * Manages the connection lifecycle to a remote signer (Amber, nsecBunker, etc.)
 * via the BunkerSigner from nostr-tools/nip46.
 *
 * The ephemeral client keypair and bunker pointer are stored in sessionStorage
 * so the connection can survive page refreshes within a tab session.
 */

import { generateSecretKey } from 'nostr-tools';
import { parseBunkerInput, BunkerSigner } from 'nostr-tools/nip46';

const CLIENT_SK_KEY = 'bies_nip46_client_sk';
const BUNKER_POINTER_KEY = 'bies_nip46_bunker';

const CONNECT_TIMEOUT_MS = 30_000;

function skToHex(sk) {
    return Array.from(sk, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToSk(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
}

export const nostrConnectService = {
    _bunkerSigner: null,

    /**
     * Connect to a remote signer via bunker:// URI or name@domain NIP-05.
     * Returns the connected BunkerSigner instance.
     */
    async connect(bunkerInput) {
        const bp = await parseBunkerInput(bunkerInput.trim());
        if (!bp) throw new Error('Invalid bunker URI or NIP-05 identifier.');

        const clientSk = generateSecretKey();

        // Persist for session reconnection
        sessionStorage.setItem(CLIENT_SK_KEY, skToHex(clientSk));
        sessionStorage.setItem(BUNKER_POINTER_KEY, JSON.stringify(bp));

        const signer = BunkerSigner.fromBunker(clientSk, bp, {
            onauth: (url) => {
                // nsecBunker may require web-based approval
                window.open(url, '_blank', 'noopener');
            },
        });

        // Race against timeout so the UI doesn't hang forever
        await Promise.race([
            signer.connect(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(
                    'Connection timed out. Make sure your signer app is open and connected to the internet.'
                )), CONNECT_TIMEOUT_MS)
            ),
        ]);

        this._bunkerSigner = signer;
        return signer;
    },

    /**
     * Reconnect using stored session data (page refresh scenario).
     * Returns the BunkerSigner or null if no stored connection exists.
     */
    async reconnect() {
        const skHex = sessionStorage.getItem(CLIENT_SK_KEY);
        const bpJson = sessionStorage.getItem(BUNKER_POINTER_KEY);
        if (!skHex || !bpJson) return null;

        try {
            const clientSk = hexToSk(skHex);
            const bp = JSON.parse(bpJson);

            const signer = BunkerSigner.fromBunker(clientSk, bp, {
                onauth: (url) => {
                    window.open(url, '_blank', 'noopener');
                },
            });

            await Promise.race([
                signer.connect(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Reconnection timed out.')), CONNECT_TIMEOUT_MS)
                ),
            ]);

            this._bunkerSigner = signer;
            return signer;
        } catch {
            this.clearSession();
            return null;
        }
    },

    /** Get the current connected BunkerSigner, or null. */
    getSigner() {
        return this._bunkerSigner;
    },

    /** Whether session data exists for reconnection. */
    hasStoredConnection() {
        return !!(sessionStorage.getItem(CLIENT_SK_KEY) && sessionStorage.getItem(BUNKER_POINTER_KEY));
    },

    /** Disconnect and clean up. */
    disconnect() {
        if (this._bunkerSigner) {
            this._bunkerSigner.close().catch(() => {});
            this._bunkerSigner = null;
        }
        this.clearSession();
    },

    clearSession() {
        sessionStorage.removeItem(CLIENT_SK_KEY);
        sessionStorage.removeItem(BUNKER_POINTER_KEY);
    },
};
