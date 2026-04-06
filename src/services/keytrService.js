/**
 * keytrService — adapter for @sovit.xyz/keytr passkey-encrypted nsec.
 *
 * Replaces the custom passkeyService with keytr's NIP-K1 implementation:
 *   KiH → HKDF-SHA256 → AES-256-GCM → kind:31777 event → relay
 *
 * Encrypted nsec lives on public Nostr relays (not localStorage).
 * A lightweight localStorage index tracks which pubkeys have credentials
 * so hasCredential() can answer synchronously.
 */

import {
    decodeNsec,
    encodeNsec,
    registerPasskey,
    encryptNsec,
    buildKeytrEvent,
    publishKeytrEvent,
    fetchKeytrEvents,
    loginWithKeytr,
    discover,
    nsecToPublicKey,
    KEYTR_VERSION,
    KEYTR_GATEWAYS,
} from '@sovit.xyz/keytr';
import { PUBLIC_RELAYS } from './nostrService.js';

// Override gateways: our domain first, then keytr.org and nostkey.org as backups
const BIES_GATEWAYS = ['app.buildinelsalvador.com', ...KEYTR_GATEWAYS.filter(g => g !== 'app.buildinelsalvador.com')];

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

// ─── Support detection cache ────────────────────────────────────────────────

let _webauthnAvailable = false;
let _checked = false;

async function ensureChecked() {
    if (_checked) return;
    _webauthnAvailable = typeof window !== 'undefined' && !!window.PublicKeyCredential;
    _checked = true;
}

// Kick off the check immediately on import (non-blocking).
ensureChecked();

// ─── Legacy migration ───────────────────────────────────────────────────────

(function migrateFromLegacy() {
    const old = localStorage.getItem('bies_passkey_credentials');
    if (old) {
        localStorage.removeItem('bies_passkey_credentials');
        localStorage.removeItem('bies_passkey_device_key');
    }
})();

// ─── Extension-interference detection ───────────────────────────────────────

/**
 * Detect whether a WebAuthn error was likely caused by a password manager
 * extension intercepting the credentials API without supporting Related
 * Origin Requests (cross-origin rpId like keytr.org / nostkey.org).
 */
export function isLikelyExtensionInterference(message) {
    if (typeof message !== 'string') return false;
    const lower = message.toLowerCase();
    return (
        lower.includes('relying party id') &&
        (lower.includes('registrable domain') || lower.includes('equal to the current domain'))
    );
}

// ─── Public API ─────────────────────────────────────────────────────────────

export const keytrService = {
    /** Whether WebAuthn passkeys are available. */
    isSupported() {
        return _webauthnAvailable;
    },

    /** Await the async support check (for useEffect-based detection). */
    async checkSupport() {
        await ensureChecked();
        return _webauthnAvailable;
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
        return this._registerOnGateway(nsec, pubkey, BIES_GATEWAYS[0]);
    },

    /**
     * Register on all backup gateways (keytr.org, nostkey.org) — one biometric prompt each.
     * Call after saveWithPasskey() to add redundancy.
     *
     * @returns {Promise<Array<{ gateway: string }>>}
     */
    async addBackupGateway(nsec, pubkey) {
        const backups = BIES_GATEWAYS.slice(1);
        if (backups.length === 0) throw new Error('No backup gateway configured.');
        const results = [];
        for (const gw of backups) {
            await this._registerOnGateway(nsec, pubkey, gw);
            results.push({ gateway: gw });
        }
        return results;
    },

    /**
     * @private Register a passkey + publish kind:31777 for a single gateway.
     */
    async _registerOnGateway(nsec, pubkey, rpId) {
        const nsecBytes = decodeNsec(nsec);
        const { nostrSigner } = await import('./nostrSigner.js');

        const { credential, keyMaterial } = await registerPasskey({
            rpId,
            rpName: rpId.split('.')[0],
            userName: pubkey.slice(0, 16),
            userDisplayName: 'BIES Account',
        });

        let encryptedBlob;
        try {
            encryptedBlob = encryptNsec({
                nsecBytes,
                prfOutput: keyMaterial,
                credentialId: credential.credentialId,
                aadVersion: KEYTR_VERSION,
            });
        } finally {
            keyMaterial.fill(0);
        }

        const eventTemplate = buildKeytrEvent({
            credential,
            encryptedBlob,
            clientName: 'bies',
            version: String(KEYTR_VERSION),
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
     * Tier 1: stored credentials — fetch events by pubkey, decrypt with
     * loginWithKeytr (targeted assertion, one prompt).
     *
     * Tier 2: cached BIES user — same as Tier 1 using cached pubkey.
     *
     * Tier 3: discoverable — browser shows available passkeys.
     *
     * @returns {Promise<string>} bech32-encoded nsec
     */
    async loginWithPasskey() {
        const creds = getStored();

        if (creds.length > 0) {
            // Tier 1 — we know which pubkey to look up
            for (const { pubkey } of creds) {
                const events = await fetchKeytrEvents(pubkey, PUBLIC_RELAYS);
                if (events.length === 0) continue;

                try {
                    const { nsecBytes } = await loginWithKeytr(events);
                    try { return encodeNsec(nsecBytes); } finally { nsecBytes.fill(0); }
                } catch {
                    // login failed — fall through to next tier
                }
            }
        }

        // Tier 2 — cached BIES user pubkey
        const raw = localStorage.getItem('bies_user');
        const cached = raw ? JSON.parse(raw) : null;
        if (cached?.nostrPubkey) {
            const events = await fetchKeytrEvents(cached.nostrPubkey, PUBLIC_RELAYS);
            if (events.length > 0) {
                try {
                    const { nsecBytes } = await loginWithKeytr(events);
                    const recoveredPk = nsecToPublicKey(nsecBytes);
                    try {
                        const nsec = encodeNsec(nsecBytes);
                        if (!this.hasCredential(recoveredPk)) {
                            const stored = getStored();
                            stored.push({ pubkey: recoveredPk, createdAt: new Date().toISOString() });
                            setStored(stored);
                        }
                        return nsec;
                    } finally {
                        nsecBytes.fill(0);
                    }
                } catch {
                    // login failed — fall through to discoverable
                }
            }
        }

        // Tier 3 — discoverable
        const { nsecBytes, pubkey } = await discover(PUBLIC_RELAYS);
        try {
            const nsec = encodeNsec(nsecBytes);
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
