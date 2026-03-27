/**
 * Coinos Service — server-side wrapper for the Coinos custodial wallet API.
 *
 * Handles account creation, balance checks, invoice generation, and payments.
 * Tokens are stored encrypted in the Profile table.
 */

import crypto from 'crypto';
import { config } from '../config';
import prisma from '../lib/prisma';

const API = config.coinosApiUrl;
const ALGO = 'aes-256-gcm';

// ─── Token encryption helpers ────────────────────────────────────────────────

function deriveKey(): Buffer {
    return crypto.scryptSync(config.encryptionSecret, 'coinos-token-salt', 32);
}

export function encryptToken(token: string): string {
    const key = deriveKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decryptToken(blob: string): string {
    const [ivHex, tagHex, dataHex] = blob.split(':');
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(dataHex, 'hex')) + decipher.final('utf8');
}

// ─── Coinos API helpers ──────────────────────────────────────────────────────

async function coinosFetch(path: string, opts: RequestInit = {}): Promise<any> {
    const res = await fetch(`${API}${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...opts.headers,
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Coinos API ${res.status}: ${body}`);
    }
    return res.json();
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register a new Coinos account and persist the encrypted token.
 * Returns the Coinos username and Lightning address.
 */
export async function createWallet(userId: string, username: string): Promise<{
    coinosUsername: string;
    lightningAddress: string;
}> {
    const data = await coinosFetch('/users', {
        method: 'POST',
        body: JSON.stringify({ user: { username } }),
    });

    const token = data.token;
    if (!token) throw new Error('Coinos did not return a token');

    const encrypted = encryptToken(token);

    await prisma.profile.update({
        where: { userId },
        data: {
            coinosUsername: username,
            coinosToken: encrypted,
            lightningAddress: `${username}@coinos.io`,
        },
    });

    return {
        coinosUsername: username,
        lightningAddress: `${username}@coinos.io`,
    };
}

/**
 * Connect an existing Coinos account by logging in with username + password.
 */
export async function connectWallet(userId: string, username: string, password: string): Promise<{
    coinosUsername: string;
    lightningAddress: string;
}> {
    const data = await coinosFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });

    const token = data.token;
    if (!token) throw new Error('Invalid Coinos credentials');

    const encrypted = encryptToken(token);

    await prisma.profile.update({
        where: { userId },
        data: {
            coinosUsername: username,
            coinosToken: encrypted,
            lightningAddress: `${username}@coinos.io`,
        },
    });

    return {
        coinosUsername: username,
        lightningAddress: `${username}@coinos.io`,
    };
}

/**
 * Disconnect the Coinos wallet from the user's profile.
 */
export async function disconnectWallet(userId: string): Promise<void> {
    await prisma.profile.update({
        where: { userId },
        data: {
            coinosUsername: null,
            coinosToken: null,
        },
    });
}

/**
 * Get the decrypted Coinos JWT for a user. Returns null if not connected.
 */
async function getToken(userId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { coinosToken: true },
    });
    if (!profile?.coinosToken) return null;
    return decryptToken(profile.coinosToken);
}

/**
 * Get wallet balance in sats.
 */
export async function getBalance(userId: string): Promise<number> {
    const token = await getToken(userId);
    if (!token) throw new Error('No Coinos wallet connected');

    const data = await coinosFetch('/me', {
        headers: authHeaders(token),
    });

    return Math.floor((data.balance ?? 0) / 1000); // msats → sats
}

/**
 * Pay a BOLT-11 Lightning invoice from the user's Coinos wallet.
 */
export async function payInvoice(userId: string, bolt11: string): Promise<{ hash: string }> {
    const token = await getToken(userId);
    if (!token) throw new Error('No Coinos wallet connected');

    const data = await coinosFetch('/payments', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ payreq: bolt11 }),
    });

    return { hash: data.hash };
}

/**
 * Create a Lightning invoice on the user's Coinos wallet.
 */
export async function createInvoice(userId: string, amountSats: number, memo?: string): Promise<{ pr: string }> {
    const token = await getToken(userId);
    if (!token) throw new Error('No Coinos wallet connected');

    const data = await coinosFetch('/invoice', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
            invoice: {
                amount: amountSats,
                type: 'lightning',
                ...(memo ? { memo } : {}),
            },
        }),
    });

    return { pr: data.text || data.hash };
}

/**
 * Check if a user has a Coinos wallet connected.
 */
export async function hasWallet(userId: string): Promise<boolean> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { coinosUsername: true },
    });
    return !!profile?.coinosUsername;
}
