import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import prisma from '../lib/prisma';
import { generateToken } from '../middleware/auth';
import { encryptPrivateKey } from '../services/crypto.service';
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

// ─── Validation Schemas ───

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['BUILDER', 'INVESTOR']).default('BUILDER'),
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

// ─── Controllers ───

/**
 * POST /auth/register
 * Register with email/password. Generates a custodial Nostr keypair.
 */
export async function register(req: Request, res: Response): Promise<void> {
    try {
        const { email, password, role, name } = req.body;

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Generate Nostr keypair for this email user
        const secretKey = generateSecretKey();
        const nostrPubkey = getPublicKey(secretKey);
        const privateKeyHex = Buffer.from(secretKey).toString('hex');
        const encryptedPrivkey = encryptPrivateKey(privateKeyHex);

        // Create user + profile in a transaction
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                nostrPubkey,
                encryptedPrivkey,
                role,
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

        // Add custodial pubkey to relay whitelist so email users can access the private relay
        addToRelayWhitelist(nostrPubkey);

        // Generate JWT
        const token = generateToken(user.id, user.role);

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
        const { email, password } = req.body;

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

        if (user.isBanned) {
            res.status(403).json({ error: 'Your account has been suspended' });
            return;
        }

        const token = generateToken(user.id, user.role);

        res.json({
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
        const { pubkey, signedEvent } = req.body;

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

        // Verify signature using nostr-tools
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

        const isAdminPubkey = config.adminPubkeys.includes(pubkey);

        if (!user) {
            // Auto-create user for Nostr login (no custodial key needed — they manage their own)
            user = await prisma.user.create({
                data: {
                    nostrPubkey: pubkey,
                    role: isAdminPubkey ? 'ADMIN' : 'BUILDER',
                    profile: {
                        create: {
                            name: `nostr:${pubkey.substring(0, 8)}`,
                        },
                    },
                },
                include: { profile: true },
            });
        } else if (isAdminPubkey && user.role !== 'ADMIN') {
            // Promote existing user to admin if their pubkey is in the admin list
            user = await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' },
                include: { profile: true },
            });
        }

        // Block banned users from logging in and re-whitelisting
        if (user.isBanned) {
            res.status(403).json({ error: 'Your account has been suspended' });
            return;
        }

        const token = generateToken(user.id, user.role);

        // Add pubkey to relay whitelist so user can publish to the BIES relay
        addToRelayWhitelist(pubkey);

        res.json({
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

        res.json({
            id: user.id,
            email: user.email,
            nostrPubkey: user.nostrPubkey,
            role: user.role,
            profile: user.profile,
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
 * PUT /auth/role
 * Update own role (BUILDER <-> INVESTOR).
 */
export async function updateRole(req: Request, res: Response): Promise<void> {
    try {
        const { role } = req.body;
        if (!['BUILDER', 'INVESTOR'].includes(role)) {
            res.status(400).json({ error: 'Role must be BUILDER or INVESTOR' });
            return;
        }

        const user = await prisma.user.update({
            where: { id: req.user!.id },
            data: { role },
        });

        res.json({ id: user.id, role: user.role });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
}
