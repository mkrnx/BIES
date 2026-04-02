/**
 * Web Push service — sends push notifications to offline users via the Web Push API.
 * Gracefully no-ops if VAPID keys are not configured (dev environments).
 */

import webpush from 'web-push';
import prisma from '../lib/prisma';
import { config } from '../config';

let initialized = false;

/**
 * Initialize web-push with VAPID credentials.
 * Called once at server startup. No-ops if VAPID keys are not configured.
 */
export function initWebPush(): void {
    if (!config.vapid.publicKey || !config.vapid.privateKey) {
        console.log('[WebPush] VAPID keys not configured — push notifications disabled');
        return;
    }
    webpush.setVapidDetails(
        config.vapid.subject,
        config.vapid.publicKey,
        config.vapid.privateKey
    );
    initialized = true;
    console.log('[WebPush] Initialized with VAPID credentials');
}

export function isWebPushEnabled(): boolean {
    return initialized;
}

/**
 * Send a push notification to all of a user's subscribed devices.
 * Automatically cleans up expired/invalid subscriptions (410 Gone, 404).
 * Returns the number of successful pushes.
 */
export async function sendPushToUser(userId: string, payload: {
    title: string;
    body: string;
    tag?: string;
    url?: string;
    data?: Record<string, unknown>;
}): Promise<number> {
    if (!initialized) return 0;

    // Respect user's push notification preference
    const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { pushNotifications: true },
    });
    if (settings && !settings.pushNotifications) return 0;

    const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId },
    });
    if (subscriptions.length === 0) return 0;

    const jsonPayload = JSON.stringify(payload);
    let sent = 0;
    const staleIds: string[] = [];

    await Promise.allSettled(
        subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth },
                    },
                    jsonPayload,
                    { TTL: 86400 } // 24 hours
                );
                sent++;
            } catch (error: any) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    staleIds.push(sub.id);
                } else {
                    console.error(`[WebPush] Failed to push to ${sub.endpoint.slice(0, 50)}:`, error.statusCode || error.message);
                }
            }
        })
    );

    if (staleIds.length > 0) {
        await prisma.pushSubscription.deleteMany({
            where: { id: { in: staleIds } },
        });
        console.log(`[WebPush] Cleaned up ${staleIds.length} stale subscription(s) for user ${userId}`);
    }

    return sent;
}

/**
 * Clean up push subscriptions that haven't been refreshed in 90 days.
 * Called on server startup.
 */
export async function cleanupStaleSubscriptions(): Promise<number> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await prisma.pushSubscription.deleteMany({
        where: { updatedAt: { lt: cutoff } },
    });
    if (result.count > 0) {
        console.log(`[WebPush] Cleaned up ${result.count} stale subscriptions (>90 days)`);
    }
    return result.count;
}
