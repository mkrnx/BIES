/**
 * passkeyService — encrypts/decrypts Nostr private keys using WebAuthn PRF extension.
 *
 * Uses the WebAuthn PRF (Pseudo-Random Function) extension to derive
 * an AES-256-GCM encryption key from a passkey (biometric/PIN).
 * The encrypted nsec is stored in localStorage — only decryptable
 * with the same passkey that created it.
 *
 * No server interaction needed — everything happens client-side.
 */

const STORAGE_KEY = 'bies_passkey_credentials';
const PRF_INPUT = new TextEncoder().encode('bies-nostr-key-encryption');

// ─── Binary helpers ──────────────────────────────────────────────────────────

function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

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

// ─── Crypto helpers ──────────────────────────────────────────────────────────

async function deriveAesKey(prfOutput, salt) {
    const keyMaterial = await crypto.subtle.importKey(
        'raw', prfOutput, 'HKDF', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('bies-nsec-v1') },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptData(plaintext, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext)
    );
    return { ciphertext, iv };
}

async function decryptData(ciphertext, iv, key) {
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );
    return new TextDecoder().decode(plaintext);
}

// ─── PRF helpers ─────────────────────────────────────────────────────────────

async function getPrfFromCreate(credential) {
    const ext = credential.getClientExtensionResults();

    // PRF worked during create()
    if (ext.prf?.results?.first) {
        return new Uint8Array(ext.prf.results.first);
    }

    // PRF didn't return results during create — try get() as fallback.
    // Some authenticators only support PRF during authentication, not registration.
    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rpId: window.location.hostname,
                allowCredentials: [{ type: 'public-key', id: credential.rawId }],
                userVerification: 'required',
                extensions: { prf: { eval: { first: PRF_INPUT } } }
            }
        });
        const assertExt = assertion.getClientExtensionResults();
        if (assertExt.prf?.results?.first) {
            return new Uint8Array(assertExt.prf.results.first);
        }
    } catch {
        // get() also failed — PRF not supported
    }

    return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const passkeyService = {
    /** Check if WebAuthn is available in this browser */
    isSupported() {
        return typeof window !== 'undefined' &&
            !!window.PublicKeyCredential &&
            typeof navigator.credentials?.create === 'function';
    },

    /** Check if a passkey credential exists (optionally for a specific pubkey) */
    hasCredential(pubkey) {
        const creds = getStored();
        if (pubkey) return creds.some(c => c.pubkey === pubkey);
        return creds.length > 0;
    },

    /** Get all stored credential metadata */
    getCredentials() {
        return getStored().map(({ credentialId, pubkey, createdAt }) => ({
            credentialId, pubkey, createdAt
        }));
    },

    /**
     * Create a passkey and encrypt the nsec with it.
     * Shows the native WebAuthn dialog (biometric/PIN prompt).
     * @param {string} nsec - bech32-encoded nsec key
     * @param {string} pubkey - hex-encoded public key
     * @returns {Promise<boolean>} true if saved successfully
     */
    async saveWithPasskey(nsec, pubkey) {
        if (!this.isSupported()) {
            throw new Error('Passkeys are not supported on this device.');
        }

        let credential;
        try {
            credential = await navigator.credentials.create({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: { name: 'BIES', id: window.location.hostname },
                    user: {
                        id: new TextEncoder().encode(pubkey.slice(0, 32)),
                        name: 'BIES Account',
                        displayName: 'BIES Nostr Key',
                    },
                    pubKeyCredParams: [
                        { type: 'public-key', alg: -7 },   // ES256
                        { type: 'public-key', alg: -257 },  // RS256
                    ],
                    authenticatorSelection: {
                        residentKey: 'preferred',
                        userVerification: 'required',
                    },
                    extensions: {
                        prf: { eval: { first: PRF_INPUT } }
                    }
                }
            });
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw Object.assign(new Error('Cancelled'), { cancelled: true });
            }
            throw err;
        }

        const prfOutput = await getPrfFromCreate(credential);
        if (!prfOutput) {
            throw new Error(
                'Your passkey provider doesn\'t support key encryption (PRF). ' +
                'Password managers like Bitwarden don\'t support this yet. ' +
                'Use your device\'s built-in authenticator (Touch ID, Windows Hello, or a security key) instead.'
            );
        }

        // Encrypt nsec
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const aesKey = await deriveAesKey(prfOutput, salt);
        const { ciphertext, iv } = await encryptData(nsec, aesKey);

        // Store credential + encrypted data (replace existing for same pubkey)
        const creds = getStored().filter(c => c.pubkey !== pubkey);
        creds.push({
            credentialId: toBase64(credential.rawId),
            pubkey,
            encryptedNsec: toBase64(ciphertext),
            iv: toBase64(iv),
            salt: toBase64(salt),
            createdAt: new Date().toISOString(),
        });
        setStored(creds);

        return true;
    },

    /**
     * Authenticate with a saved passkey and decrypt the nsec.
     * Shows the native WebAuthn dialog (biometric/PIN prompt).
     * @returns {Promise<string>} decrypted nsec (bech32)
     */
    async loginWithPasskey() {
        if (!this.isSupported()) {
            throw new Error('Passkeys are not supported on this device.');
        }

        const creds = getStored();
        if (creds.length === 0) {
            throw new Error('No saved passkeys found. Log in with your key first and save a passkey.');
        }

        const allowCredentials = creds.map(c => ({
            type: 'public-key',
            id: fromBase64(c.credentialId),
        }));

        let assertion;
        try {
            assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: window.location.hostname,
                    allowCredentials,
                    userVerification: 'required',
                    extensions: { prf: { eval: { first: PRF_INPUT } } }
                }
            });
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw Object.assign(new Error('Cancelled'), { cancelled: true });
            }
            throw err;
        }

        const ext = assertion.getClientExtensionResults();
        if (!ext.prf?.results?.first) {
            throw new Error('Could not derive decryption key from passkey.');
        }

        // Find matching stored credential
        const usedId = toBase64(assertion.rawId);
        const stored = creds.find(c => c.credentialId === usedId);
        if (!stored) {
            throw new Error('Passkey not recognized. It may have been removed.');
        }

        // Decrypt
        const prfOutput = new Uint8Array(ext.prf.results.first);
        const aesKey = await deriveAesKey(prfOutput, fromBase64(stored.salt));

        try {
            return await decryptData(
                fromBase64(stored.encryptedNsec),
                fromBase64(stored.iv),
                aesKey
            );
        } catch {
            throw new Error('Failed to decrypt key. The passkey may not match the saved credential.');
        }
    },

    /** Remove credential for a specific pubkey */
    removeCredential(pubkey) {
        setStored(getStored().filter(c => c.pubkey !== pubkey));
    },

    /** Remove all stored credentials */
    removeAll() {
        localStorage.removeItem(STORAGE_KEY);
    },
};
