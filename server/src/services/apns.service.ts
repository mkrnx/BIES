/**
 * APNs service — sends native push notifications to iOS devices via Apple's
 * HTTP/2 provider API (token-based auth with a .p8 key).
 *
 * This runs in parallel with the Web Push service (webpush.service.ts) and is
 * entirely additive: when APNS_KEY_ID / APNS_TEAM_ID / APNS_AUTH_KEY are not
 * configured it logs once at startup and every send is a no-op, so the server
 * boots and all existing notification paths work exactly as before.
 */

import http2 from 'http2';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { config } from '../config';

// Whether APNs is configured AND the .p8 key validated at startup.
let initialized = false;

// ─── Provider JWT (ES256) — cached; Apple throttles refresh < 20min and
//     expires tokens after 60min, so regenerate at most every ~50min. ────────
let cachedToken: string | null = null;
let cachedTokenAt = 0;
const TOKEN_TTL_MS = 50 * 60 * 1000;

// ─── Long-lived HTTP/2 session to Apple, lazily (re)created. ─────────────────
let session: http2.ClientHttp2Session | null = null;

function hasConfig(): boolean {
    return !!(config.apns.keyId && config.apns.teamId && config.apns.authKey);
}

export function isApnsEnabled(): boolean {
    return initialized;
}

/**
 * Build (or reuse) the APNs provider JWT. Throws if the .p8 key is malformed.
 */
function buildProviderToken(): string {
    const now = Date.now();
    if (cachedToken && now - cachedTokenAt < TOKEN_TTL_MS) {
        return cachedToken;
    }
    const token = jwt.sign(
        { iss: config.apns.teamId, iat: Math.floor(now / 1000) },
        config.apns.authKey,
        {
            algorithm: 'ES256',
            header: { alg: 'ES256', kid: config.apns.keyId },
        }
    );
    cachedToken = token;
    cachedTokenAt = now;
    return token;
}

/**
 * Initialize APNs. Called once at server startup. No-ops (single log line) when
 * unconfigured; validates the .p8 auth key and disables APNs on failure rather
 * than crashing the boot.
 */
export function initApns(): void {
    if (!hasConfig()) {
        console.log('[APNs] Not configured — native push disabled');
        return;
    }
    try {
        // Validate the .p8 by signing a token now; caches it for the first send.
        buildProviderToken();
        initialized = true;
        console.log(
            `[APNs] Initialized (${config.apns.production ? 'production' : 'sandbox'} host, topic ${config.apns.bundleId})`
        );
    } catch (error: any) {
        initialized = false;
        console.error('[APNs] Failed to initialize — native push disabled:', error?.message || error);
    }
}

/**
 * Get the shared HTTP/2 session to Apple, creating it if needed. Attaches
 * error/close/goaway handlers that null out the reference so the next send
 * reconnects. An unhandled 'error' on a session would crash the process.
 */
function getSession(): http2.ClientHttp2Session {
    if (session && !session.closed && !session.destroyed) {
        return session;
    }
    const host = config.apns.production
        ? 'https://api.push.apple.com'
        : 'https://api.sandbox.push.apple.com';
    const s = http2.connect(host);
    s.on('error', (err) => {
        console.error('[APNs] HTTP/2 session error:', (err as any)?.message || err);
        if (session === s) session = null;
    });
    s.on('close', () => {
        if (session === s) session = null;
    });
    s.on('goaway', () => {
        if (session === s) session = null;
    });
    session = s;
    return s;
}

interface ApnsResult {
    ok: boolean;
    stale: boolean;
}

/**
 * Send a single notification to one device token. Never rejects — resolves
 * with { ok, stale } so the caller can prune dead tokens.
 */
function sendOne(deviceToken: string, jsonBody: string, providerToken: string): Promise<ApnsResult> {
    return new Promise((resolve) => {
        let s: http2.ClientHttp2Session;
        try {
            s = getSession();
        } catch (err) {
            console.error('[APNs] Failed to open HTTP/2 session:', (err as any)?.message || err);
            resolve({ ok: false, stale: false });
            return;
        }

        const req = s.request({
            ':method': 'POST',
            ':path': `/3/device/${deviceToken}`,
            authorization: `bearer ${providerToken}`,
            'apns-topic': config.apns.bundleId,
            'apns-push-type': 'alert',
            'apns-priority': '10',
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(jsonBody),
        });

        let status = 0;
        let data = '';

        req.on('response', (headers) => {
            status = Number(headers[':status']) || 0;
        });
        req.setEncoding('utf8');
        req.on('data', (chunk) => { data += chunk; });
        req.on('end', () => {
            if (status === 200) {
                resolve({ ok: true, stale: false });
                return;
            }
            let reason = '';
            try { reason = JSON.parse(data || '{}').reason || ''; } catch { /* ignore */ }
            // Prune only on genuinely dead-token signals. 400/BadDeviceToken is
            // NOT one: Apple also returns it on an APNs environment mismatch
            // (e.g. production tokens hitting the sandbox host), so treating it
            // as stale would wipe every user's tokens on a misconfiguration.
            // Log those instead (handled by the !stale branch below).
            const stale = status === 410 || reason === 'Unregistered';
            if (!stale) {
                console.error(`[APNs] Push failed (${status} ${reason || ''}) for token ${deviceToken.slice(0, 12)}…`);
            }
            resolve({ ok: false, stale });
        });
        req.on('error', (err) => {
            console.error('[APNs] Request error:', (err as any)?.message || err);
            resolve({ ok: false, stale: false });
        });
        req.end(jsonBody);
    });
}

/**
 * Send a push notification to all of a user's registered iOS devices.
 * Automatically prunes stale tokens (HTTP 410 / Unregistered).
 * Returns the number of successful pushes.
 */
export async function sendApnsToUser(userId: string, payload: {
    title: string;
    body: string;
    url?: string;
    data?: Record<string, unknown>;
}): Promise<number> {
    if (!isApnsEnabled()) return 0;

    // Respect user's push notification preference (mirrors webpush.service).
    const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { pushNotifications: true },
    });
    if (settings && !settings.pushNotifications) return 0;

    // Only APNs tokens — a future Android/FCM token in this table must not be
    // sent to Apple.
    const tokens = await prisma.deviceToken.findMany({
        where: { userId, platform: 'ios' },
    });
    if (tokens.length === 0) return 0;

    const { title, body, url, data } = payload;
    const jsonBody = JSON.stringify({
        aps: { alert: { title, body }, sound: 'default' },
        ...(url ? { url } : {}),
        ...(data || {}),
    });

    let providerToken: string;
    try {
        providerToken = buildProviderToken();
    } catch (error: any) {
        console.error('[APNs] Failed to sign provider token:', error?.message || error);
        return 0;
    }

    let sent = 0;
    const staleIds: string[] = [];

    await Promise.allSettled(
        tokens.map(async (t) => {
            const result = await sendOne(t.token, jsonBody, providerToken);
            if (result.ok) sent++;
            else if (result.stale) staleIds.push(t.id);
        })
    );

    if (staleIds.length > 0) {
        await prisma.deviceToken.deleteMany({ where: { id: { in: staleIds } } });
        console.log(`[APNs] Cleaned up ${staleIds.length} stale device token(s) for user ${userId}`);
    }

    return sent;
}
