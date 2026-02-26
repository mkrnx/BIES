import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(config.encryptionSecret, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt a Nostr private key (hex string) using AES-256-GCM.
 * Returns a base64 string containing: salt + iv + tag + ciphertext
 */
export function encryptPrivateKey(privateKeyHex: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(salt);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(privateKeyHex, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Combine: salt(64) + iv(16) + tag(16) + ciphertext
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    return combined.toString('base64');
}

/**
 * Decrypt a Nostr private key from its encrypted base64 form.
 * Returns the hex private key string.
 */
export function decryptPrivateKey(encryptedBase64: string): string {
    const combined = Buffer.from(encryptedBase64, 'base64');

    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    const key = deriveKey(salt);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}
