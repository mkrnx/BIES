/**
 * passkeyService — encrypts/decrypts Nostr private keys using WebAuthn.
 *
 * When the passkey provider supports PRF (Pseudo-Random Function), derives
 * an AES-256-GCM encryption key directly from the authenticator.
 *
 * When PRF is not available (e.g. Bitwarden, some password managers),
 * falls back to a device-bound random key stored in localStorage.
 * The passkey authentication (biometric/PIN) gates access to the key.
 *
 * No server interaction needed — everything happens client-side.
 */

const STORAGE_KEY = 'bies_passkey_credentials';
const DEVICE_KEY_STORAGE = 'bies_passkey_device_key';
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

// ─── Device key helpers (fallback when PRF is unavailable) ──────────────────

async function getOrCreateDeviceKey() {
    const stored = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (stored) {
        const raw = fromBase64(stored);
        return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(DEVICE_KEY_STORAGE, toBase64(exported));
    return key;
}

// ─── largeBlob envelope helpers ──────────────────────────────────────────────
// Binary format for storing encrypted nsec on the authenticator:
//   [0]     version    = 0x01
//   [1]     method     = 0x01 (prf) | 0x02 (device)
//   [2-17]  salt       = 16 bytes (zeroed if method=device)
//   [18-29] iv         = 12 bytes
//   [30+]   ciphertext = variable length

const BLOB_VERSION = 0x01;
const BLOB_METHOD_PRF = 0x01;
const BLOB_METHOD_DEVICE = 0x02;

function encodeBlobEnvelope({ method, salt, iv, ciphertext }) {
    const methodByte = method === 'prf' ? BLOB_METHOD_PRF : BLOB_METHOD_DEVICE;
    const saltBytes = method === 'prf' ? new Uint8Array(salt) : new Uint8Array(16);
    const ivArr = new Uint8Array(iv);
    const ctArr = new Uint8Array(ciphertext);

    const blob = new Uint8Array(1 + 1 + 16 + 12 + ctArr.length);
    let off = 0;
    blob[off++] = BLOB_VERSION;
    blob[off++] = methodByte;
    blob.set(saltBytes, off); off += 16;
    blob.set(ivArr, off); off += 12;
    blob.set(ctArr, off);
    return blob;
}

function decodeBlobEnvelope(blob) {
    const arr = new Uint8Array(blob);
    if (arr.length < 30) throw new Error('Invalid largeBlob envelope: too short');
    if (arr[0] !== BLOB_VERSION) throw new Error('Unsupported largeBlob version');

    return {
        method: arr[1] === BLOB_METHOD_PRF ? 'prf' : 'device',
        salt: arr.slice(2, 18),
        iv: arr.slice(18, 30),
        ciphertext: arr.slice(30),
    };
}

// ─── WebAuthn assertion helper ──────────────────────────────────────────────

/**
 * Perform a get() assertion, optionally requesting PRF and/or writing a largeBlob.
 * Combines multiple extension requests into a single biometric prompt.
 */
async function getAssertionWithExtensions({ credentialId, requestPrf = true, blobToWrite = null }) {
    const extensions = {};
    if (requestPrf) extensions.prf = { eval: { first: PRF_INPUT } };
    if (blobToWrite) extensions.largeBlob = { write: blobToWrite };

    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rpId: window.location.hostname,
            allowCredentials: [{ type: 'public-key', id: credentialId }],
            userVerification: 'required',
            extensions,
        }
    });

    const ext = assertion.getClientExtensionResults();
    return {
        assertion,
        prfOutput: ext.prf?.results?.first ? new Uint8Array(ext.prf.results.first) : null,
        blobWritten: blobToWrite ? (ext.largeBlob?.written === true) : false,
    };
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
     * Uses PRF when available, falls back to device-bound key otherwise.
     * When the authenticator supports largeBlob, stores the encrypted nsec
     * on the authenticator itself for cross-device portability.
     * @param {string} nsec - bech32-encoded nsec key
     * @param {string} pubkey - hex-encoded public key
     * @returns {Promise<{largeBlobStored: boolean}>}
     */
    async saveWithPasskey(nsec, pubkey) {
        if (!this.isSupported()) {
            throw new Error('Passkeys are not supported on this device.');
        }

        // ── Prompt 1: create credential ─────────────────────────────────
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
                        residentKey: 'required',
                        userVerification: 'required',
                    },
                    extensions: {
                        prf: { eval: { first: PRF_INPUT } },
                        largeBlob: { support: 'preferred' },
                    }
                }
            });
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw Object.assign(new Error('Cancelled'), { cancelled: true });
            }
            throw err;
        }

        const createExt = credential.getClientExtensionResults();
        const largeBlobCapable = createExt.largeBlob?.supported === true;
        const prfFromCreate = createExt.prf?.results?.first
            ? new Uint8Array(createExt.prf.results.first)
            : null;

        // ── Determine encryption key + write largeBlob ──────────────────
        let aesKey, encryptionMethod;
        const salt = crypto.getRandomValues(new Uint8Array(16));
        let largeBlobStored = false;

        if (prfFromCreate) {
            // PRF available from create — encrypt now
            aesKey = await deriveAesKey(prfFromCreate, salt);
            encryptionMethod = 'prf';

            if (largeBlobCapable) {
                // Prompt 2: write encrypted blob to authenticator
                const { ciphertext, iv } = await encryptData(nsec, aesKey);
                const blob = encodeBlobEnvelope({ method: 'prf', salt, iv, ciphertext });
                try {
                    const result = await getAssertionWithExtensions({
                        credentialId: credential.rawId,
                        requestPrf: false,
                        blobToWrite: blob,
                    });
                    largeBlobStored = result.blobWritten;
                } catch {
                    // largeBlob write failed — localStorage fallback still works
                }
            }
        } else {
            // PRF not available from create — need get() for PRF retry
            // If largeBlob is also supported, we can't combine PRF retry + blob write
            // because we need the PRF output to encrypt before writing the blob.
            try {
                const result = await getAssertionWithExtensions({
                    credentialId: credential.rawId,
                    requestPrf: true,
                    blobToWrite: null,
                });

                if (result.prfOutput) {
                    aesKey = await deriveAesKey(result.prfOutput, salt);
                    encryptionMethod = 'prf';

                    if (largeBlobCapable) {
                        // Prompt 3 (rare): write blob now that we have the key
                        const { ciphertext, iv } = await encryptData(nsec, aesKey);
                        const blob = encodeBlobEnvelope({ method: 'prf', salt, iv, ciphertext });
                        try {
                            const writeResult = await getAssertionWithExtensions({
                                credentialId: credential.rawId,
                                requestPrf: false,
                                blobToWrite: blob,
                            });
                            largeBlobStored = writeResult.blobWritten;
                        } catch {
                            // blob write failed, localStorage fallback
                        }
                    }
                }
            } catch {
                // PRF retry failed — fall through to device key
            }

            if (!aesKey) {
                // No PRF at all — use device-bound key
                aesKey = await getOrCreateDeviceKey();
                encryptionMethod = 'device';

                if (largeBlobCapable) {
                    const { ciphertext, iv } = await encryptData(nsec, aesKey);
                    const blob = encodeBlobEnvelope({ method: 'device', salt, iv, ciphertext });
                    try {
                        const writeResult = await getAssertionWithExtensions({
                            credentialId: credential.rawId,
                            requestPrf: false,
                            blobToWrite: blob,
                        });
                        largeBlobStored = writeResult.blobWritten;
                    } catch {
                        // blob write failed, localStorage fallback
                    }
                }
            }
        }

        // ── Always store in localStorage as fallback ────────────────────
        const { ciphertext, iv } = await encryptData(nsec, aesKey);
        const creds = getStored().filter(c => c.pubkey !== pubkey);
        creds.push({
            credentialId: toBase64(credential.rawId),
            pubkey,
            encryptedNsec: toBase64(ciphertext),
            iv: toBase64(iv),
            salt: toBase64(salt),
            encryptionMethod,
            largeBlobSupported: largeBlobCapable,
            createdAt: new Date().toISOString(),
        });
        setStored(creds);

        return { largeBlobStored };
    },

    /**
     * Authenticate with a saved passkey and decrypt the nsec.
     * Shows the native WebAuthn dialog (biometric/PIN prompt).
     * Tries to read encrypted nsec from the authenticator's largeBlob first,
     * falls back to localStorage if unavailable.
     * @returns {Promise<string>} decrypted nsec (bech32)
     */
    async loginWithPasskey() {
        if (!this.isSupported()) {
            throw new Error('Passkeys are not supported on this device.');
        }

        const storedCreds = getStored();
        const hasLocal = storedCreds.length > 0;

        // Build allowCredentials — omit for discoverable flow when no localStorage
        const allowCredentials = hasLocal
            ? storedCreds.map(c => ({ type: 'public-key', id: fromBase64(c.credentialId) }))
            : [];

        // Request largeBlob read if any credential supports it, or if no localStorage
        const tryLargeBlob = !hasLocal || storedCreds.some(c => c.largeBlobSupported);

        const extensions = { prf: { eval: { first: PRF_INPUT } } };
        if (tryLargeBlob) extensions.largeBlob = { read: true };

        let assertion;
        try {
            assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rpId: window.location.hostname,
                    ...(allowCredentials.length > 0 && { allowCredentials }),
                    userVerification: 'required',
                    extensions,
                }
            });
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                throw Object.assign(new Error('Cancelled'), { cancelled: true });
            }
            throw err;
        }

        const ext = assertion.getClientExtensionResults();

        // ── Path 1: decrypt from largeBlob on authenticator ─────────────
        if (ext.largeBlob?.blob) {
            try {
                const { method, salt, iv, ciphertext } = decodeBlobEnvelope(ext.largeBlob.blob);
                let aesKey;

                if (method === 'prf') {
                    if (!ext.prf?.results?.first) {
                        throw new Error('PRF output required but not returned.');
                    }
                    aesKey = await deriveAesKey(new Uint8Array(ext.prf.results.first), salt);
                } else {
                    const deviceKeyRaw = localStorage.getItem(DEVICE_KEY_STORAGE);
                    if (!deviceKeyRaw) {
                        throw new Error('Device encryption key not found.');
                    }
                    aesKey = await crypto.subtle.importKey(
                        'raw', fromBase64(deviceKeyRaw), { name: 'AES-GCM' }, false, ['decrypt']
                    );
                }

                return await decryptData(ciphertext, iv, aesKey);
            } catch (blobErr) {
                // Blob decryption failed — fall through to localStorage
                console.warn('[passkeyService] largeBlob decryption failed, trying localStorage:', blobErr.message);
            }
        }

        // ── Path 2: decrypt from localStorage ──────────────────────────
        const usedId = toBase64(assertion.rawId);
        const stored = storedCreds.find(c => c.credentialId === usedId);
        if (!stored) {
            throw new Error('No passkey data found. Log in with your nsec key first and save a passkey.');
        }

        let aesKey;

        if (stored.encryptionMethod === 'device') {
            const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE);
            if (!deviceKey) {
                throw new Error('Device encryption key not found. This passkey can only be used on the device where it was created.');
            }
            aesKey = await crypto.subtle.importKey(
                'raw', fromBase64(deviceKey), { name: 'AES-GCM' }, false, ['decrypt']
            );
        } else {
            if (!ext.prf?.results?.first) {
                throw new Error('Could not derive decryption key from passkey.');
            }
            aesKey = await deriveAesKey(new Uint8Array(ext.prf.results.first), fromBase64(stored.salt));
        }

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
        localStorage.removeItem(DEVICE_KEY_STORAGE);
    },
};
