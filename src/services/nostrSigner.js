/**
 * nostrSigner — unified signing abstraction for Nostr operations.
 *
 * When the user logs in via passkey/nsec/seed, the secret key is held in
 * memory and used for all Nostr operations (signing, NIP-44 encrypt/decrypt).
 * This avoids the browser extension (nos2x, Alby, etc.) interfering.
 *
 * When the user logs in via browser extension, operations delegate to
 * window.nostr as before.
 *
 * On session restore (page refresh), if a passkey credential exists the
 * signer can re-acquire the nsec via WebAuthn on the first operation that
 * needs it.
 */

import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';

const LOGIN_METHOD_KEY = 'bies_login_method'; // 'extension' | 'nsec' | 'bunker'
const SESSION_SK_KEY = 'bies_sk_session'; // sessionStorage — survives refresh, cleared on tab close

class NostrSigner {
    constructor() {
        this._sk = null;      // Uint8Array secret key (in-memory only)
        this._pubkey = null;   // hex public key
        this._mode = null;     // 'extension' | 'nsec' | 'bunker' | null
        this._reacquirePromise = null; // dedup concurrent _tryReacquire calls

        // Restore key from sessionStorage so page refreshes don't lose it.
        this._restoreFromSession();
    }

    /** Restore secret key from sessionStorage (page refresh recovery). */
    _restoreFromSession() {
        try {
            const hex = localStorage.getItem(SESSION_SK_KEY);
            if (!hex) return;
            const sk = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
            this._sk = sk;
            this._pubkey = getPublicKey(sk);
            this._mode = 'nsec';
        } catch {
            localStorage.removeItem(SESSION_SK_KEY);
        }
    }

    /** Persist secret key hex to sessionStorage. */
    _persistToSession(sk) {
        try {
            const hex = Array.from(sk).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(SESSION_SK_KEY, hex);
        } catch { /* quota exceeded or unavailable — silent fail */ }
    }

    // ─── Configuration ──────────────────────────────────────────────────────

    /**
     * Configure signer with an nsec (passkey/nsec/seed login).
     * The secret key is held in memory only — never persisted.
     */
    setNsec(nsecOrSk) {
        if (typeof nsecOrSk === 'string') {
            const decoded = nip19.decode(nsecOrSk.trim());
            if (decoded.type !== 'nsec') throw new Error('Invalid nsec');
            this._sk = decoded.data;
        } else {
            this._sk = nsecOrSk;
        }
        this._pubkey = getPublicKey(this._sk);
        this._mode = 'nsec';
        localStorage.setItem(LOGIN_METHOD_KEY, 'nsec');
        this._persistToSession(this._sk);
    }

    /** Configure signer to use browser extension */
    setExtensionMode() {
        this._sk = null;
        this._pubkey = null;
        this._mode = 'extension';
        localStorage.setItem(LOGIN_METHOD_KEY, 'extension');
    }

    /** Configure signer to use a NIP-46 remote signer (bunker) */
    setBunkerMode(pubkey) {
        this._sk = null;
        this._pubkey = pubkey;
        this._mode = 'bunker';
        localStorage.setItem(LOGIN_METHOD_KEY, 'bunker');
    }

    /** Clear stored key (logout). Zeros secret key bytes as defense-in-depth. */
    clear() {
        if (this._sk instanceof Uint8Array) {
            this._sk.fill(0);
        }
        this._sk = null;
        this._pubkey = null;
        this._mode = null;
        localStorage.removeItem(LOGIN_METHOD_KEY);
        try { localStorage.removeItem(SESSION_SK_KEY); } catch { /* ignore */ }
        // Disconnect bunker if active
        import('./nostrConnectService.js').then(({ nostrConnectService }) => {
            nostrConnectService.disconnect();
        }).catch(() => {});
    }

    /** Current mode: 'extension' | 'nsec' | null */
    get mode() { return this._mode; }

    /** Whether we have the nsec in memory */
    get hasKey() { return !!this._sk; }

    /** Current public key (hex). Null if not yet signed in or key not in memory. */
    get pubkey() { return this._pubkey; }

    /**
     * Return the bech32 nsec if the secret key is currently in memory.
     * Returns null if the key is not available (extension/bunker mode or post-refresh).
     */
    getNsec() {
        if (!this._sk) return null;
        return nip19.nsecEncode(this._sk);
    }

    /** What login method was used (persists across refreshes) */
    get storedMethod() {
        return localStorage.getItem(LOGIN_METHOD_KEY);
    }

    /**
     * Whether we can sign right now without triggering a passkey/WebAuthn prompt.
     * Used by background operations (relay AUTH) to avoid surprise prompts.
     */
    get canSignSilently() {
        if (this._sk) return true;
        if (this._mode === 'bunker' || this.storedMethod === 'bunker') return true;
        if (this._mode === 'extension' && window.nostr) return true;
        if (window.nostr) return true;
        return false;
    }

    // ─── Core operations ────────────────────────────────────────────────────

    async getPublicKey() {
        // Prefer in-memory key
        if (this._sk) return this._pubkey;

        // Bunker mode — delegate to remote signer
        if (this._mode === 'bunker' || this.storedMethod === 'bunker') {
            const signer = await this._getBunkerSigner();
            return signer.getPublicKey();
        }

        // Extension mode
        if (this._mode === 'extension' && window.nostr) {
            return window.nostr.getPublicKey();
        }

        // Try to re-acquire from passkey (session restore scenario)
        if (await this._tryReacquire()) return this._pubkey;

        // Last resort: extension (if user's method was unknown but extension exists)
        if (window.nostr) return window.nostr.getPublicKey();

        throw new Error('No signing method available. Please log in again.');
    }

    async signEvent(event) {
        // Prefer in-memory key
        if (this._sk) return finalizeEvent(event, this._sk);

        // Bunker mode — delegate to remote signer
        if (this._mode === 'bunker' || this.storedMethod === 'bunker') {
            const signer = await this._getBunkerSigner();
            return signer.signEvent(event);
        }

        // Extension mode
        if (this._mode === 'extension' && window.nostr) {
            return window.nostr.signEvent(event);
        }

        // Try to re-acquire from passkey
        if (await this._tryReacquire()) return finalizeEvent(event, this._sk);

        // Last resort: extension
        if (window.nostr) return window.nostr.signEvent(event);

        throw new Error('No signing method available. Please log in again.');
    }

    /** NIP-44 encrypt/decrypt interface (matches window.nostr.nip44 shape) */
    get nip44() {
        return {
            encrypt: (pubkey, plaintext) => this._nip44Encrypt(pubkey, plaintext),
            decrypt: (pubkey, ciphertext) => this._nip44Decrypt(pubkey, ciphertext),
        };
    }

    /** Whether NIP-44 operations are available */
    get hasNip44() {
        if (this._sk) return true;
        if (this._mode === 'bunker' || this.storedMethod === 'bunker') return true;
        if (this._mode === 'extension' && window.nostr?.nip44) return true;
        if (this.storedMethod === 'nsec') return true; // can re-acquire
        return !!window.nostr?.nip44;
    }

    // ─── Internal NIP-44 ────────────────────────────────────────────────────

    async _nip44Encrypt(pubkey, plaintext) {
        if (this._sk) {
            const ck = nip44.v2.utils.getConversationKey(this._sk, pubkey);
            return nip44.v2.encrypt(plaintext, ck);
        }

        if (this._mode === 'bunker' || this.storedMethod === 'bunker') {
            const signer = await this._getBunkerSigner();
            return signer.nip44Encrypt(pubkey, plaintext);
        }

        if (this._mode === 'extension' && window.nostr?.nip44) {
            return window.nostr.nip44.encrypt(pubkey, plaintext);
        }

        if (await this._tryReacquire()) {
            const ck = nip44.v2.utils.getConversationKey(this._sk, pubkey);
            return nip44.v2.encrypt(plaintext, ck);
        }

        if (window.nostr?.nip44) return window.nostr.nip44.encrypt(pubkey, plaintext);

        throw new Error('NIP-44 encryption not available. Please log in again.');
    }

    async _nip44Decrypt(pubkey, ciphertext) {
        if (this._sk) {
            const ck = nip44.v2.utils.getConversationKey(this._sk, pubkey);
            return nip44.v2.decrypt(ciphertext, ck);
        }

        if (this._mode === 'bunker' || this.storedMethod === 'bunker') {
            const signer = await this._getBunkerSigner();
            return signer.nip44Decrypt(pubkey, ciphertext);
        }

        if (this._mode === 'extension' && window.nostr?.nip44) {
            return window.nostr.nip44.decrypt(pubkey, ciphertext);
        }

        if (await this._tryReacquire()) {
            const ck = nip44.v2.utils.getConversationKey(this._sk, pubkey);
            return nip44.v2.decrypt(ciphertext, ck);
        }

        if (window.nostr?.nip44) return window.nostr.nip44.decrypt(pubkey, ciphertext);

        throw new Error('NIP-44 decryption not available. Please log in again.');
    }

    // ─── Bunker reconnection ─────────────────────────────────────────────────

    /**
     * Get the active BunkerSigner, reconnecting if needed (page refresh).
     * Throws if the signer can't be reached.
     */
    async _getBunkerSigner() {
        const { nostrConnectService } = await import('./nostrConnectService.js');
        const existing = nostrConnectService.getSigner();
        if (existing) return existing;

        if (nostrConnectService.hasStoredConnection()) {
            const signer = await nostrConnectService.reconnect();
            if (signer) {
                this._mode = 'bunker';
                return signer;
            }
        }

        throw new Error('Remote signer disconnected. Please log in again.');
    }

    // ─── Session restoration ─────────────────────────────────────────────────

    /**
     * Public method to attempt session restoration after page refresh.
     * Returns true if signing ability was restored, false otherwise.
     * Callers can use this to check if the user needs to re-login.
     */
    async tryRestore() {
        if (this._sk) return true;
        if (this._mode === 'extension' && window.nostr) return true;
        if (this._mode === 'bunker' || this.storedMethod === 'bunker') {
            try {
                await this._getBunkerSigner();
                return true;
            } catch { return false; }
        }
        return this._tryReacquire();
    }

    /**
     * Attempt to re-acquire nsec from keytr passkey.
     * Called lazily when an operation needs signing but no key is in memory.
     * Only tries if the stored login method was 'nsec' (passkey/nsec/seed)
     * and a keytr credential exists.
     */
    async _tryReacquire() {
        if (this._sk) return true; // already have it
        if (this.storedMethod !== 'nsec') return false;

        // Dedup: if a reacquire is already in flight, piggyback on it
        // instead of triggering a second WebAuthn prompt.
        if (this._reacquirePromise) return this._reacquirePromise;

        this._reacquirePromise = this._doReacquire();
        try {
            return await this._reacquirePromise;
        } finally {
            this._reacquirePromise = null;
        }
    }

    async _doReacquire() {
        const { PASSKEY_ENABLED } = await import('../config/featureFlags.js');
        if (!PASSKEY_ENABLED) return false;

        try {
            const { keytrService } = await import('./keytrService.js');
            if (!keytrService.hasCredential()) return false;

            const nsec = await keytrService.loginWithPasskey();
            this.setNsec(nsec);
            return true;
        } catch {
            return false;
        }
    }
}

export const nostrSigner = new NostrSigner();

// E2E test hook: allow injecting a secret key via window global.
// This runs at module load time so the singleton picks up the key
// before any React component checks nostrSigner.hasKey.
if (typeof window !== 'undefined' && window.__TEST_NSEC_HEX) {
    try {
        const hex = window.__TEST_NSEC_HEX;
        const sk = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        nostrSigner.setNsec(sk);
    } catch { /* ignore in production */ }
}
