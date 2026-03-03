const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');
const fs = require('fs');
const { verifyEvent } = require('nostr-tools/pure');

// ─── Configuration ───────────────────────────────────────────────────────────
const LISTEN_PORT    = parseInt(process.env.PROXY_PORT || '7778', 10);
const UPSTREAM_URL   = process.env.UPSTREAM_RELAY || 'ws://bies-relay:7777';
const WHITELIST_PATH = process.env.WHITELIST_PATH || '/app/data/whitelist.txt';
const RELAY_URL      = process.env.RELAY_URL || 'wss://bies.sovit.xyz/relay';
const AUTH_TIMEOUT   = parseInt(process.env.AUTH_TIMEOUT_MS || '30000', 10);

// ─── Whitelist check ─────────────────────────────────────────────────────────
function isWhitelisted(pubkey) {
    try {
        if (!fs.existsSync(WHITELIST_PATH)) return false;
        const content = fs.readFileSync(WHITELIST_PATH, 'utf8');
        return content.split('\n').map(l => l.trim()).filter(Boolean).includes(pubkey);
    } catch (err) {
        console.error('[Proxy] Whitelist read error:', err.message);
        return false;
    }
}

// ─── NIP-42 AUTH verification ────────────────────────────────────────────────
function verifyAuthEvent(event, challenge) {
    // Must be kind 22242
    if (event.kind !== 22242) return 'invalid event kind';

    // Verify signature
    if (!verifyEvent(event)) return 'invalid signature';

    // Check challenge tag
    const challengeTag = event.tags.find(t => t[0] === 'challenge');
    if (!challengeTag || challengeTag[1] !== challenge) return 'challenge mismatch';

    // Check relay tag
    const relayTag = event.tags.find(t => t[0] === 'relay');
    if (!relayTag || relayTag[1] !== RELAY_URL) return 'relay URL mismatch';

    // Check created_at is within 10 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - event.created_at) > 600) return 'timestamp too far off';

    // Check pubkey is whitelisted
    if (!isWhitelisted(event.pubkey)) return 'pubkey not whitelisted';

    return null; // success
}

// ─── WebSocket proxy server ──────────────────────────────────────────────────
const wss = new WebSocketServer({ port: LISTEN_PORT });

console.log(`[Proxy] NIP-42 auth proxy listening on :${LISTEN_PORT}`);
console.log(`[Proxy] Upstream relay: ${UPSTREAM_URL}`);
console.log(`[Proxy] Relay URL for auth: ${RELAY_URL}`);

wss.on('connection', (clientWs) => {
    let authenticated = false;
    let upstream = null;
    let authTimer = null;

    // Generate random challenge
    const challenge = crypto.randomBytes(32).toString('hex');

    // Open upstream connection to strfry
    upstream = new WebSocket(UPSTREAM_URL);

    upstream.on('error', (err) => {
        console.error('[Proxy] Upstream error:', err.message);
        clientWs.close(1011, 'upstream error');
    });

    upstream.on('close', () => {
        clientWs.close();
    });

    upstream.on('open', () => {
        // Send NIP-42 AUTH challenge to client
        clientWs.send(JSON.stringify(['AUTH', challenge]));
    });

    upstream.on('message', (data) => {
        // Forward upstream messages to client (only if authenticated)
        if (authenticated && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });

    // Set auth timeout
    authTimer = setTimeout(() => {
        if (!authenticated) {
            clientWs.send(JSON.stringify([
                'NOTICE',
                'auth-required: authentication timeout',
            ]));
            clientWs.close(4001, 'auth timeout');
            if (upstream && upstream.readyState === WebSocket.OPEN) {
                upstream.close();
            }
        }
    }, AUTH_TIMEOUT);

    clientWs.on('message', (data) => {
        let msg;
        try {
            msg = JSON.parse(data.toString());
        } catch {
            return; // ignore malformed messages
        }

        if (!Array.isArray(msg) || msg.length < 2) return;

        // Handle AUTH response
        if (msg[0] === 'AUTH' && !authenticated) {
            const event = msg[1];
            const error = verifyAuthEvent(event, challenge);

            if (error) {
                console.log(`[Proxy] Auth failed: ${error} (pubkey: ${event.pubkey?.substring(0, 8)}...)`);
                clientWs.send(JSON.stringify([
                    'OK', event.id || '', false, `auth-required: ${error}`,
                ]));
                clientWs.close(4001, 'auth failed');
                if (upstream && upstream.readyState === WebSocket.OPEN) {
                    upstream.close();
                }
                return;
            }

            // Auth success
            authenticated = true;
            clearTimeout(authTimer);
            console.log(`[Proxy] Authenticated: ${event.pubkey.substring(0, 8)}...`);
            clientWs.send(JSON.stringify(['OK', event.id, true, '']));
            return;
        }

        // Before auth, reject all other messages
        if (!authenticated) {
            clientWs.send(JSON.stringify([
                'NOTICE',
                'auth-required: please authenticate first',
            ]));
            return;
        }

        // After auth: transparent forwarding to upstream
        if (upstream && upstream.readyState === WebSocket.OPEN) {
            upstream.send(data);
        }
    });

    clientWs.on('close', () => {
        clearTimeout(authTimer);
        if (upstream && upstream.readyState === WebSocket.OPEN) {
            upstream.close();
        }
    });

    clientWs.on('error', (err) => {
        console.error('[Proxy] Client error:', err.message);
        clearTimeout(authTimer);
        if (upstream && upstream.readyState === WebSocket.OPEN) {
            upstream.close();
        }
    });
});
