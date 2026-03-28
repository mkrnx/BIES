/**
 * keytrService — adapter for @sovit.xyz/keytr passkey-encrypted nsec.
 *
 * Replaces the custom passkeyService with keytr's NIP-K1 implementation:
 *   PRF → HKDF-SHA256 → AES-256-GCM → kind:30079 event → relay
 *
 * Encrypted nsec lives on public Nostr relays (not localStorage).
 * A lightweight localStorage index tracks which pubkeys have credentials
 * so hasCredential() can answer synchronously.
 */

import {
    checkPrfSupport,
    registerPasskey,
    encryptNsec,
    decodeNsec,
    encodeNsec,
    buildKeytrEvent,
    publishKeytrEvent,
    fetchKeytrEvents,
    loginWithKeytr,
    discoverAndLogin,
    KEYTR_GATEWAYS,
} from '@sovit.xyz/keytr';
import { PUBLIC_RELAYS } from './nostrService.js';

const STORAGE_KEY = 'bies_keytr_credentials';

// ─── localStorage credential index ─────────────────────────────────────────

function getStored() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function setStored(creds) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

// ─── PRF support cache ──────────────────────────────────────────────────────

let _prfSupported = false;
let _prfChecked = false;

async function ensurePrfChecked() {
    if (_prfChecked) return;
    try {
        const info = await checkPrfSupport();
        _prfSupported = info.supported;
    } catch {
        _prfSupported = false;
    }
    _prfChecked = true;
}

// Kick off the check immediately on import (non-blocking).
ensurePrfChecked();

// ─── Legacy migration ───────────────────────────────────────────────────────

(function migrateFromLegacy() {
    const old = localStorage.getItem('bies_passkey_credentials');
    if (old) {
        localStorage.removeItem('bies_passkey_credentials');
        localStorage.removeItem('bies_passkey_device_key');
    }
})();

// ─── Public API ─────────────────────────────────────────────────────────────

export const keytrService = {
    /** Whether WebAuthn + PRF is available. Sync after first check completes. */
    isSupported() {
        return _prfSupported;
    },

    /** Await the async PRF check (for useEffect-based detection). */
    async checkSupport() {
        await ensurePrfChecked();
        return _prfSupported;
    },

    /** Whether a keytr credential exists for the given pubkey (or any). */
    hasCredential(pubkey) {
        const creds = getStored();
        if (pubkey) return creds.some(c => c.pubkey === pubkey);
        return creds.length > 0;
    },

    /** Get stored credential metadata. */
    getCredentials() {
        return getStored();
    },

    /**
     * Register on the primary gateway (keytr.org) only — one biometric prompt.
     * Use addBackupGateway() afterwards to add nostkey.org as a fallback.
     *
     * @param {string} nsec - bech32-encoded nsec
     * @param {string} pubkey - hex-encoded public key
     */
    async saveWithPasskey(nsec, pubkey) {
        await this._registerOnGateway(nsec, pubkey, KEYTR_GATEWAYS[0]);
    },

    /**
     * Register on a backup gateway (nostkey.org) — one additional biometric prompt.
     * Call after saveWithPasskey() to add redundancy.
     */
    async addBackupGateway(nsec, pubkey) {
        if (KEYTR_GATEWAYS.length < 2) throw new Error('No backup gateway configured.');
        await this._registerOnGateway(nsec, pubkey, KEYTR_GATEWAYS[1]);
    },

    /** @private Register a passkey + publish kind:30079 for a single gateway. */
    async _registerOnGateway(nsec, pubkey, rpId) {
        const nsecBytes = decodeNsec(nsec);
        const { nostrSigner } = await import('./nostrSigner.js');

        const { credential, prfOutput } = await registerPasskey({
            userName: pubkey.slice(0, 16),
            userDisplayName: 'BIES Account',
            pubkey,
            rpId,
            rpName: rpId.split('.')[0],
        });

        let encryptedBlob;
        try {
            encryptedBlob = encryptNsec({
                nsecBytes,
                prfOutput,
                credentialId: credential.credentialId,
            });
        } finally {
            prfOutput.fill(0);
        }

        const eventTemplate = buildKeytrEvent({
            credential,
            encryptedBlob,
            clientName: 'bies',
        });

        const signedEvent = await nostrSigner.signEvent({
            ...eventTemplate,
            pubkey,
        });

        await publishKeytrEvent(signedEvent, PUBLIC_RELAYS);

        const creds = getStored().filter(c => c.pubkey !== pubkey);
        creds.push({ pubkey, createdAt: new Date().toISOString() });
        setStored(creds);
    },

    /**
     * Login with passkey.
     *
     * Fast path: if stored credentials exist, fetch events by pubkey and
     * authenticate with explicit allowCredentials (one prompt).
     *
     * Discoverable path: if no stored credentials, the browser shows all
     * available passkeys for the gateway rpId. The user picks one and we
     * recover the pubkey from userHandle, fetch events, and decrypt.
     *
     * @returns {Promise<string>} bech32-encoded nsec
     */
    async loginWithPasskey() {
        const creds = getStored();

        if (creds.length > 0) {
            // Fast path — we know which pubkey to look up
            for (const { pubkey } of creds) {
                const events = await fetchKeytrEvents(pubkey, PUBLIC_RELAYS);
                if (events.length > 0) {
                    const { nsecBytes } = await loginWithKeytr(events);
                    try {
                        return encodeNsec(nsecBytes);
                    } finally {
                        nsecBytes.fill(0);
                    }
                }
            }
            throw new Error('Could not find your encrypted key on Nostr relays. You may need to re-save your passkey.');
        }

        // Discoverable — browser shows available passkeys, no pubkey needed
        const { nsecBytes, pubkey } = await discoverAndLogin(PUBLIC_RELAYS);
        try {
            const nsec = encodeNsec(nsecBytes);
            // Index credential locally for fast path next time
            if (pubkey && !this.hasCredential(pubkey)) {
                const stored = getStored();
                stored.push({ pubkey, createdAt: new Date().toISOString() });
                setStored(stored);
            }
            return nsec;
        } finally {
            nsecBytes.fill(0);
        }
    },

    /** Remove credential metadata for a specific pubkey. */
    removeCredential(pubkey) {
        setStored(getStored().filter(c => c.pubkey !== pubkey));
    },

    /** Remove all stored credential metadata. */
    removeAll() {
        localStorage.removeItem(STORAGE_KEY);
    },
};
