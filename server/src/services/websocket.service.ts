/**
 * WebSocket service — real-time notifications and presence.
 *
 * Supports:
 *   - Authenticated connections via JWT query param
 *   - Per-user notification push
 *   - Typing indicators for DMs
 *   - Online presence tracking
 *   - Heartbeat / keepalive (prevents proxy timeouts)
 *
 * Scales to 500+ concurrent connections on a single Node process.
 * For multi-instance horizontal scaling, swap the in-process Map for
 * a Redis Pub/Sub adapter (e.g. socket.io-redis or ioredis pub/sub).
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    isAlive?: boolean;
}

interface WsMessage {
    type: string;
    [key: string]: unknown;
}

// ─── Connection store ─────────────────────────────────────────────────────────

// userId → Set of open WebSocket connections (one user can have multiple tabs)
const connections = new Map<string, Set<AuthenticatedWebSocket>>();

// ─── JWT validation helper ────────────────────────────────────────────────────

function extractTokenFromRequest(req: IncomingMessage): string | null {
    try {
        const url = new URL(req.url || '', `http://localhost`);
        return url.searchParams.get('token');
    } catch {
        return null;
    }
}

function verifyToken(token: string): { userId: string; role: string } | null {
    try {
        const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { userId: string; role: string };
        return decoded;
    } catch {
        return null;
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

let wss: WebSocketServer | null = null;

/**
 * Attach a WebSocket server to the existing HTTP server.
 * Call this once from index.ts after creating the http.Server.
 */
export function attachWebSocketServer(httpServer: Server): void {
    wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 64 * 1024 });

    wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        const token = extractTokenFromRequest(req);

        if (!token) {
            ws.close(4001, 'Authentication required');
            return;
        }

        const payload = verifyToken(token);
        if (!payload) {
            ws.close(4001, 'Invalid token');
            return;
        }

        const { userId } = payload;
        ws.userId = userId;
        ws.isAlive = true;

        // Track connection
        if (!connections.has(userId)) connections.set(userId, new Set());
        connections.get(userId)!.add(ws);

        console.log(`[WS] User ${userId} connected (total: ${countConnections()})`);

        // Send a welcome ping
        sendToSocket(ws, { type: 'connected', userId });

        // Pong handler for keepalive
        ws.on('pong', () => { ws.isAlive = true; });

        // Incoming messages from client
        ws.on('message', (data: Buffer) => {
            try {
                const msg: WsMessage = JSON.parse(data.toString());
                handleClientMessage(ws, userId, msg);
            } catch {
                // Ignore malformed messages
            }
        });

        ws.on('close', () => {
            connections.get(userId)?.delete(ws);
            if (connections.get(userId)?.size === 0) connections.delete(userId);
            console.log(`[WS] User ${userId} disconnected (total: ${countConnections()})`);
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error for user ${userId}:`, err.message);
        });
    });

    // Heartbeat: ping all connections every 30s to detect dead sockets
    const heartbeat = setInterval(() => {
        wss!.clients.forEach((ws) => {
            const socket = ws as AuthenticatedWebSocket;
            if (!socket.isAlive) {
                socket.terminate();
                return;
            }
            socket.isAlive = false;
            socket.ping();
        });
    }, 30_000);

    wss.on('close', () => clearInterval(heartbeat));

    console.log(`[WS] WebSocket server ready at ws://localhost:${config.port}/ws`);
}

// ─── Client message handling ──────────────────────────────────────────────────

function handleClientMessage(
    ws: AuthenticatedWebSocket,
    userId: string,
    msg: WsMessage
): void {
    switch (msg.type) {
        case 'ping':
            sendToSocket(ws, { type: 'pong' });
            break;

        case 'typing_start':
        case 'typing_stop':
            // Relay typing indicator to recipient
            if (msg.recipientId && typeof msg.recipientId === 'string') {
                sendToUser(msg.recipientId as string, {
                    type: msg.type,
                    fromUserId: userId,
                });
            }
            break;

        case 'mark_read':
            // Client acknowledges reading messages — handled via REST but we can relay here too
            break;

        default:
            break;
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendToSocket(ws: WebSocket, data: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function countConnections(): number {
    let count = 0;
    for (const sockets of connections.values()) count += sockets.size;
    return count;
}

// ─── Exported helpers for use throughout the app ─────────────────────────────

/**
 * Push a message to all open sockets for a user.
 * Returns the number of sockets the message was sent to.
 */
export function sendToUser(userId: string, data: unknown): number {
    const sockets = connections.get(userId);
    if (!sockets || sockets.size === 0) return 0;

    let sent = 0;
    for (const ws of sockets) {
        sendToSocket(ws, data);
        sent++;
    }
    return sent;
}

/**
 * Broadcast to all connected users (e.g. system announcements).
 * Use sparingly.
 */
export function broadcast(data: unknown): void {
    if (!wss) return;
    wss.clients.forEach((ws) => sendToSocket(ws, data));
}

/**
 * Check if a user has at least one open WebSocket connection (is online).
 */
export function isUserOnline(userId: string): boolean {
    return (connections.get(userId)?.size ?? 0) > 0;
}

/**
 * Get all online user IDs.
 */
export function getOnlineUserIds(): string[] {
    return Array.from(connections.keys());
}
