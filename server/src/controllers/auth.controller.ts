import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// nostr-tools is ESM-only (@noble/curves has no CJS build);
// use dynamic import() so the compiled CJS output doesn't call require().
import prisma from '../lib/prisma';
import { generateToken, isAdminPubkey } from '../middleware/auth';
import { encryptPrivateKey, decryptPrivateKey } from '../services/crypto.service';
import { publishRelayList } from '../services/nostr.service';
import { cache } from '../services/redis.service';
import { config } from '../config';
import { z } from 'zod';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// ─── Relay whitelist helper ───

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/;

const WHITELIST_PATH = process.env.RELAY_WHITELIST_PATH || '/app/relay-whitelist/whitelist.txt';

/**
 * Add a pubkey to the Nostr relay whitelist file.
 * The strfry write-policy plugin reads this file to authorize publishers.
 */
export function addToRelayWhitelist(pubkey: string): void {
    try {
        // Validate pubkey format to prevent injection into whitelist file
        if (!HEX_PUBKEY_RE.test(pubkey)) {
            console.error('[Relay] Invalid pubkey format, refusing to whitelist');
            return;
        }

        const dir = path.dirname(WHITELIST_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Read existing whitelist
        let existing = '';
        if (fs.existsSync(WHITELIST_PATH)) {
            existing = fs.readFileSync(WHITELIST_PATH, 'utf8');
        }

        // Only add if not already present
        if (!existing.split('\n').includes(pubkey)) {
            fs.appendFileSync(WHITELIST_PATH, pubkey + '\n');
            console.log(`[Relay] Added ${pubkey.substring(0, 8)}... to whitelist`);
        }
    } catch (err) {
        console.error('[Relay] Failed to update whitelist:', err);
    }
}

/**
 * Remove a pubkey from the Nostr relay whitelist file.
 * Called when a user is banned to revoke relay access.
 */
export function removeFromRelayWhitelist(pubkey: string): void {
    try {
        if (!fs.existsSync(WHITELIST_PATH)) return;

        const existing = fs.readFileSync(WHITELIST_PATH, 'utf8');
        const lines = existing.split('\n').filter((line) => line !== pubkey && line.trim() !== '');
        fs.writeFileSync(WHITELIST_PATH, lines.join('\n') + (lines.length ? '\n' : ''));
        console.log(`[Relay] Removed ${pubkey.substring(0, 8)}... from whitelist`);
    } catch (err) {
        console.error('[Relay] Failed to remove from whitelist:', err);
    }
}

// ─── Fingerprint helpers (ban evasion detection) ───

/**
 * Store a browser fingerprint for a user.
 * Called on every login/signup so we build a fingerprint history.
 */
async function storeFingerprint(
    userId: string,
    fingerprintHash: string | null | undefined,
    req: Request,
): Promise<void> {
    if (!fingerprintHash || typeof fingerprintHash !== 'string' || fingerprintHash.length < 16) return;

    try {
        // Avoid duplicates: only store if this exact user+fingerprint combo doesn't exist
        const existing = await prisma.browserFingerprint.findFirst({
            where: { userId, fingerprintHash },
        });
        if (existing) return;

        await prisma.browserFingerprint.create({
            data: {
                userId,
                fingerprintHash,
                ipAddress: req.ip || null,
                userAgent: req.headers['user-agent'] || null,
            },
        });
    } catch (err) {
        console.error('[Fingerprint] Failed to store:', err);
    }
}

/**
 * Check if a fingerprint hash matches any banned user's fingerprints.
 * Returns the banned user IDs if a match is found.
 */
async function checkBanEvasion(
    fingerprintHash: string | null | undefined,
): Promise<string[]> {
    if (!fingerprintHash || typeof fingerprintHash !== 'string' || fingerprintHash.length < 16) return [];

    try {
        const matches = await prisma.browserFingerprint.findMany({
            where: {
                fingerprintHash,
                user: { isBanned: true },
            },
            select: { userId: true },
        });
        return [...new Set(matches.map((m) => m.userId))];
    } catch (err) {
        console.error('[Fingerprint] Ban evasion check failed:', err);
        return [];
    }
}

// ─── Validation Schemas ───

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(1).optional(),
});

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const nostrLoginSchema = z.object({
    pubkey: z.string().min(64).max(64),
    sig: z.string(),
    challenge: z.string(),
});

// In-memory challenge store (use Redis in production)
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

// ─── NIP-05 auto-generation ───

async function generateNip05Name(baseName: string): Promise<string | null> {
    let name = baseName.toLowerCase().replace(/[^a-z0-9._-]/g, '').substring(0, 30);
    if (name.length < 3) name = `user${name}`;
    if (name.length < 3) return null;

    const existing = await prisma.profile.findFirst({ where: { nip05Name: name } });
    if (!existing) return name;

    for (let i = 1; i <= 99; i++) {
        const candidate = `${name.substring(0, 27)}${i}`;
        const taken = await prisma.profile.findFirst({ where: { nip05Name: candidate } });
        if (!taken) return candidate;
    }
    return null;
}

// ─── Controllers ───

/**
 * POST /auth/register
 * Register with email/password. Generates a custodial Nostr keypair.
 */
export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, name, fingerprint } = req.body;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }

        // Check for ban evasion via browser fingerprint
        const bannedUserIds = await checkBanEvasion(fingerprint);

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate Nostr keypair for this email user (dynamic import — ESM-only package)
        const nostrPure = await import('nostr-tools/pure');
        const secretKey = nostrPure.generateSecretKey();
        const nostrPubkey = nostrPure.getPublicKey(secretKey);
        const privateKeyHex = Buffer.from(secretKey).toString('hex');
        const encryptedPrivkey = encryptPrivateKey(privateKeyHex);

        // Create user + profile in a transaction
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                nostrPubkey,
                encryptedPrivkey,
                role: 'MEMBER',
                isBanned: bannedUserIds.length > 0,
                profile: {
                    create: {
                        name: name || email.split('@')[0],
                    },
                },
            },
            include: {
                profile: true,
            },
        });

        // Store fingerprint for this new account
        await storeFingerprint(user.id, fingerprint, req);

        // If ban evasion detected, log it and block
        if (bannedUserIds.length > 0) {
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'BAN_EVASION_DETECTED',
                    resource: `user:${user.id}`,
                    ipAddress: req.ip || null,
                    userAgent: req.headers['user-agent'] || null,
                    metadata: JSON.stringify({
                        matchedBannedUsers: bannedUserIds,
                        fingerprintHash: fingerprint,
                    }),
                },
            });
            console.log(`[Auth] Ban evasion detected: new user ${user.id} matches banned users ${bannedUserIds.join(', ')}`);
            res.status(403).json({ error: 'Your account has been suspended' });
            return;
        }

        // Add custodial pubkey to relay whitelist so email users can access the private relay
        addToRelayWhitelist(nostrPubkey);

        // Publish NIP-65 relay list for the new custodial user
        publishRelayList(user.id).catch((err) =>
            console.error('[Nostr] Relay list publish failed:', err)
        );

        // Auto-generate NIP-05 name from email prefix
        const nip05Name = await generateNip05Name(email.split('@')[0]);
        if (nip05Name && user.profile) {
            await prisma.profile.update({
                where: { id: user.profile.id },
                data: { nip05Name },
            });
        }

        // Generate JWT
        const token = generateToken(user.id, user.role, user.isAdmin);

        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                nostrPubkey: user.nostrPubkey,
                role: user.role,
                profile: user.profile,
            },
            token,
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}

/**
 * POST /auth/login
 * Login with email/password.
 */
export async function login(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, fingerprint } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            include: { profile: true },
        });

        if (!user || !user.passwordHash) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }

        // Store fingerprint (even for banned users — builds the fingerprint database)
        await storeFingerprint(user.id, fingerprint, req);

        if (user.isBanned) {
            res.status(403).json({ error: 'Your account has been suspended' });
            return;
        }

        const token = generateToken(user.id, user.role, user.isAdmin);

        // Decrypt the custodial nostr private key so the client can sign
        // NIP-42 AUTH challenges for the private relay.
        let nostrNsec: string | undefined;
        if (user.encryptedPrivkey) {
            try {
                const hexKey = decryptPrivateKey(user.encryptedPrivkey);
                const { nip19 } = await import('nostr-tools');
                const skBytes = Buffer.from(hexKey, 'hex');
                nostrNsec = nip19.nsecEncode(new Uint8Array(skBytes));
            } catch (err) {
                console.error('Failed to decrypt custodial key for login:', err);
            }
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nostrPubkey: user.nostrPubkey,
                role: user.role,
                profile: user.profile,
            },
            token,
            ...(nostrNsec ? { nostrNsec } : {}),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
}

/**
 * GET /auth/nostr-challenge
 * Get a challenge for Nostr login (step 1 of challenge-response).
 */
export async function getNostrChallenge(req: Request, res: Response): Promise<void> {
    const challenge = crypto.randomBytes(32).toString('hex');
    const pubkey = req.query.pubkey as string;

    if (!pubkey || !HEX_PUBKEY_RE.test(pubkey)) {
        res.status(400).json({ error: 'Valid hex pubkey required' });
        return;
    }

    challenges.set(pubkey, {
        challenge,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    res.json({ challenge });
}

/**
 * POST /auth/nostr-login
 * Verify a signed challenge from a Nostr extension (step 2).
 * Client sends pubkey + signedEvent (kind:27235 with challenge as content).
 */
export async function nostrLogin(req: Request, res: Response): Promise<void> {
    try {
        const { pubkey, signedEvent, fingerprint } = req.body;

        if (!pubkey || !HEX_PUBKEY_RE.test(pubkey)) {
            res.status(400).json({ error: 'Valid hex pubkey required' });
            return;
        }

        // Verify challenge-response
        const stored = challenges.get(pubkey);
        if (!stored) {
            res.status(400).json({ error: 'No challenge found. Request a new one.' });
            return;
        }

        if (Date.now() > stored.expiresAt) {
            challenges.delete(pubkey);
            res.status(400).json({ error: 'Challenge expired. Request a new one.' });
            return;
        }

        if (!signedEvent || !signedEvent.sig || !signedEvent.id) {
            res.status(400).json({ error: 'Signed event required' });
            return;
        }

        if (signedEvent.pubkey !== pubkey) {
            res.status(400).json({ error: 'Pubkey mismatch in signed event' });
            return;
        }

        if (signedEvent.content !== stored.challenge) {
            res.status(400).json({ error: 'Challenge mismatch' });
            return;
        }

        // Verify event kind (NIP-98 HTTP auth)
        if (signedEvent.kind !== 27235) {
            res.status(400).json({ error: 'Signed event must be kind 27235' });
            return;
        }

        // Verify event timestamp is recent (within 5 minutes)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - signedEvent.created_at) > 300) {
            res.status(400).json({ error: 'Signed event timestamp is too old or too far in the future' });
            return;
        }

        // Verify signature using nostr-tools (dynamic import — ESM-only package)
        const { verifyEvent } = await import('nostr-tools/pure');
        if (!verifyEvent(signedEvent)) {
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }

        // Challenge verified — clean up
        challenges.delete(pubkey);

        // Find or create the user
        let user = await prisma.user.findUnique({
            where: { nostrPubkey: pubkey },
            include: { profile: true },
        });

        const isEnvAdmin = isAdminPubkey(pubkey);

        if (!user) {
            // Check for ban evasion before creating the new account
            const bannedUserIds = await checkBanEvasion(fingerprint);

            // Auto-create user for Nostr login (no custodial key needed — they manage their own)
            user = await prisma.user.create({
                data: {
                    nostrPubkey: pubkey,
                    role: 'MEMBER',
                    isAdmin: isEnvAdmin,
                    isBanned: bannedUserIds.length > 0,
                    profile: {
                        create: {
                            name: `nostr:${pubkey.substring(0, 8)}`,
                        },
                    },
                },
                include: { profile: true },
            });

            // Store fingerprint for the new account
            await storeFingerprint(user.id, fingerprint, req);

            // If ban evasion detected, log it and block
            if (bannedUserIds.length > 0) {
                await prisma.auditLog.create({
                    data: {
                        userId: user.id,
                        action: 'BAN_EVASION_DETECTED',
                        resource: `user:${user.id}`,
                        ipAddress: req.ip || null,
                        userAgent: req.headers['user-agent'] || null,
                        metadata: JSON.stringify({
                            matchedBannedUsers: bannedUserIds,
                            fingerprintHash: fingerprint,
                        }),
                    },
                });
                console.log(`[Auth] Ban evasion detected: new user ${user.id} matches banned users ${bannedUserIds.join(', ')}`);
                res.status(403).json({ error: 'Your account has been suspended' });
                return;
            }

            // Publish NIP-65 relay list for the new user
            publishRelayList(user.id).catch((err) =>
                console.error('[Nostr] Relay list publish failed:', err)
            );

            // Auto-generate NIP-05 name for new Nostr users
            const nip05Name = await generateNip05Name(`nostr-${pubkey.substring(0, 8)}`);
            if (nip05Name && user.profile) {
                await prisma.profile.update({
                    where: { id: user.profile.id },
                    data: { nip05Name },
                });
            }

        } else if (isEnvAdmin && !user.isAdmin) {
            // Grant admin flag without changing their existing role
            user = await prisma.user.update({
                where: { id: user.id },
                data: { isAdmin: true },
                include: { profile: true },
            });
        } else if (!isEnvAdmin && user.isAdmin) {
            // Revoke admin flag if pubkey was removed from ADMIN_PUBKEYS
            user = await prisma.user.update({
                where: { id: user.id },
                data: { isAdmin: false },
                include: { profile: true },
            });
        }
        // Store fingerprint for existing users (builds fingerprint database)
        await storeFingerprint(user.id, fingerprint, req);

        // Block banned users from logging in and re-whitelisting
        if (user.isBanned) {
            res.status(403).json({ error: 'Your account has been suspended' });
            return;
        }

        const token = generateToken(user.id, user.role, user.isAdmin);

        // Add pubkey to relay whitelist so user can publish to the BIES relay
        addToRelayWhitelist(pubkey);

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nostrPubkey: user.nostrPubkey,
                role: user.role,
                isAdmin: user.isAdmin,
                profile: user.profile,
            },
            token,
        });
    } catch (error) {
        console.error('Nostr login error:', error);
        res.status(500).json({ error: 'Nostr login failed' });
    }
}

/**
 * GET /auth/me
 * Get current user from JWT.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            include: { profile: true },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Include nsec for custodial users so the client can sign NIP-42 AUTH
        let nostrNsec: string | undefined;
        if (user.encryptedPrivkey) {
            try {
                const hexKey = decryptPrivateKey(user.encryptedPrivkey);
                const { nip19 } = await import('nostr-tools');
                const skBytes = Buffer.from(hexKey, 'hex');
                nostrNsec = nip19.nsecEncode(new Uint8Array(skBytes));
            } catch (err) {
                console.error('Failed to decrypt custodial key for /me:', err);
            }
        }

        // Strip sensitive Coinos token from profile before sending to client
        const profileData = user.profile ? { ...user.profile, coinosToken: undefined } : null;

        res.json({
            id: user.id,
            email: user.email,
            nostrPubkey: user.nostrPubkey,
            role: user.role,
            isAdmin: user.isAdmin,
            profile: profileData,
            ...(nostrNsec ? { nostrNsec } : {}),
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
}

/**
 * POST /auth/logout
 * Blacklist the current token in Redis so it cannot be reused.
 */
export async function logout(req: Request, res: Response): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(400).json({ error: 'No token provided' });
            return;
        }

        const token = authHeader.split(' ')[1];

        // Decode without verifying to get the expiry time
        const decoded = jwt.decode(token) as { exp?: number } | null;
        if (decoded?.exp) {
            const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
            if (remainingSeconds > 0) {
                await cache.set(`blacklist:${token}`, '1', remainingSeconds);
            }
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
}



/**
 * POST /auth/demo-login
 * Temporary demo login — bypasses auth for mobile testing.
 * TODO: Remove before production.
 */
export async function demoLogin(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.findFirst({
            where: { email: 'demo@bies.dev' },
            include: { profile: true },
        });

        if (!user) {
            res.status(404).json({ error: 'Demo account not found' });
            return;
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, isAdmin: user.isAdmin },
            config.jwtSecret,
            { expiresIn: '7d' },
        );

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nostrPubkey: user.nostrPubkey,
                role: user.role,
                isAdmin: user.isAdmin,
                profile: user.profile,
            },
            token,
        });
    } catch (error) {
        console.error('Demo login error:', error);
        res.status(500).json({ error: 'Demo login failed' });
    }
}
