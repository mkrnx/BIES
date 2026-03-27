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
    PrfNotSupportedError,
    WebAuthnError,
} from '@sovit.xyz/keytr';
import { PUBLIC_RELAYS } from './nostrService.js';

const STORAGE_KEY = 'bies_keytr_credentials';

// Passkey gateways — each rpId produces a separate kind:30079 event.
// Users get one biometric prompt per gateway during setup.
// keytr.org is the primary gateway; nostkey.org is the fallback.
const KEYTR_GATEWAYS = [
    { rpId: 'keytr.org', rpName: 'keytr', primary: true },
    { rpId: 'nostkey.org', rpName: 'nostkey' },
];

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
        const gateway = KEYTR_GATEWAYS.find(g => g.primary);
        await this._registerOnGateway(nsec, pubkey, gateway);
    },

    /**
     * Register on a backup gateway (nostkey.org) — one additional biometric prompt.
     * Call after saveWithPasskey() to add redundancy.
     */
    async addBackupGateway(nsec, pubkey) {
        const gateway = KEYTR_GATEWAYS.find(g => !g.primary);
        if (!gateway) throw new Error('No backup gateway configured.');
        await this._registerOnGateway(nsec, pubkey, gateway);
    },

    /** @private Register a passkey + publish kind:30079 for a single gateway. */
    async _registerOnGateway(nsec, pubkey, { rpId, rpName }) {
        const nsecBytes = decodeNsec(nsec);
        const { nostrSigner } = await import('./nostrSigner.js');

        const { credential, prfOutput } = await registerPasskey({
            userName: pubkey.slice(0, 16),
            userDisplayName: 'BIES Account',
            rpId,
            rpName,
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
     * Fetch keytr event from relays and decrypt nsec with passkey.
     *
     * @returns {Promise<string>} bech32-encoded nsec
     */
    async loginWithPasskey() {
        // Read the stored pubkey so we know what to fetch
        const creds = getStored();
        if (creds.length === 0) {
            throw new Error('No passkey credential found. Log in with your nsec first and save a passkey.');
        }

        // Fetch kind:30079 events for all stored pubkeys, use the first match
        let events = [];
        for (const { pubkey } of creds) {
            const fetched = await fetchKeytrEvents(pubkey, PUBLIC_RELAYS);
            if (fetched.length > 0) {
                events = fetched;
                break;
            }
        }

        if (events.length === 0) {
            throw new Error('Could not find your encrypted key on Nostr relays. You may need to log in with your nsec and re-save the passkey.');
        }

        // Sort so primary gateway (keytr.org) events are tried first.
        const primaryRpId = KEYTR_GATEWAYS.find(g => g.primary)?.rpId;
        events.sort((a, b) => {
            const aRp = a.tags?.find(t => t[0] === 'rp')?.[1];
            const bRp = b.tags?.find(t => t[0] === 'rp')?.[1];
            return (aRp === primaryRpId ? -1 : 0) - (bRp === primaryRpId ? -1 : 0);
        });

        // Try each event (one per gateway) until a passkey matches.
        // The browser only offers passkeys whose rpId matches the event's gateway.
        let lastError;
        for (const event of events) {
            try {
                const { nsecBytes } = await loginWithKeytr(event);
                try {
                    return encodeNsec(nsecBytes);
                } finally {
                    nsecBytes.fill(0);
                }
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError;
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
