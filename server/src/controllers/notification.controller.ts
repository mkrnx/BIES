/**
 * Notification controller — list, read, and manage user notifications.
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache, cacheKey } from '../services/redis.service';
import { notifyFeedInteraction } from '../services/notification.service';
import { config } from '../config';

/**
 * GET /notifications
 * List notifications for the current user (newest first, paginated).
 */
export async function listNotifications(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const page = parseInt(req.query.page as string || '1', 10);
        const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 50);
        const skip = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        const where: any = { userId };
        if (unreadOnly) where.isRead = false;

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { userId, isRead: false } }),
        ]);

        const parsed = notifications.map((n) => ({
            ...n,
            data: JSON.parse(n.data || '{}'),
        }));

        res.json({
            data: parsed,
            unreadCount,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Failed to list notifications' });
    }
}

/**
 * GET /notifications/count
 * Get unread notification count (fast, cached).
 */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const cKey = cacheKey.notificationCount(userId);

        const cached = await cache.get(cKey);
        if (cached !== null) {
            res.json({ count: parseInt(cached, 10) });
            return;
        }

        const count = await prisma.notification.count({
            where: { userId, isRead: false },
        });

        await cache.set(cKey, String(count), 30);
        res.json({ count });
    } catch (error) {
        console.error('Notification count error:', error);
        res.status(500).json({ error: 'Failed to get notification count' });
    }
}

/**
 * PUT /notifications/:id/read
 * Mark a single notification as read.
 */
export async function markRead(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id },
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }

        await prisma.notification.update({
            where: { id: req.params.id },
            data: { isRead: true, readAt: new Date() },
        });

        await cache.del(cacheKey.notificationCount(userId));

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
}

/**
 * PUT /notifications/read-all
 * Mark all notifications as read.
 */
export async function markAllRead(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;

        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });

        await cache.del(cacheKey.notificationCount(userId));

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
}

/**
 * DELETE /notifications/:id
 * Delete a specific notification.
 */
export async function deleteNotification(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const notification = await prisma.notification.findUnique({
            where: { id: req.params.id },
        });

        if (!notification || notification.userId !== userId) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }

        await prisma.notification.delete({ where: { id: req.params.id } });
        await cache.del(cacheKey.notificationCount(userId));

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
}

/**
 * POST /notifications/feed-interaction
 * Create a notification for a feed interaction (comment, like, reply).
 * The authenticated user is the actor; targetPubkey is the recipient.
 */
const VALID_FEED_TYPES = ['POST_COMMENT', 'POST_LIKE', 'COMMENT_LIKE', 'COMMENT_REPLY'] as const;

export async function feedInteraction(req: Request, res: Response): Promise<void> {
    try {
        const { type, targetPubkey, actorName, eventId, contentPreview } = req.body;
        const actorPubkey = req.user!.nostrPubkey;

        if (!type || !VALID_FEED_TYPES.includes(type)) {
            res.status(400).json({ error: 'Invalid interaction type' });
            return;
        }

        if (!targetPubkey || typeof targetPubkey !== 'string') {
            res.status(400).json({ error: 'targetPubkey is required' });
            return;
        }

        await notifyFeedInteraction({
            actorPubkey,
            targetPubkey,
            type,
            actorName: actorName || 'Someone',
            eventId,
            contentPreview,
        });

        res.json({ message: 'ok' });
    } catch (error) {
        console.error('Feed interaction notification error:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
}

// ─── Push subscription endpoints ─────────────────────────────────────────────

/**
 * GET /notifications/push/vapid-key
 * Return the public VAPID key (needed by PushManager.subscribe on the client).
 */
export async function getVapidPublicKey(req: Request, res: Response): Promise<void> {
    const key = config.vapid.publicKey;
    if (!key) {
        res.status(503).json({ error: 'Push notifications are not configured' });
        return;
    }
    res.json({ publicKey: key });
}

/**
 * POST /notifications/push/subscribe
 * Store a push subscription for the authenticated user.
 */
export async function subscribePush(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const { endpoint, keys } = req.body;

        if (!endpoint || !keys?.p256dh || !keys?.auth) {
            res.status(400).json({ error: 'endpoint and keys (p256dh, auth) are required' });
            return;
        }

        await prisma.pushSubscription.upsert({
            where: {
                userId_endpoint: { userId, endpoint },
            },
            update: {
                p256dh: keys.p256dh,
                auth: keys.auth,
                userAgent: req.headers['user-agent'] || null,
            },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
                userAgent: req.headers['user-agent'] || null,
            },
        });

        res.json({ message: 'Push subscription registered' });
    } catch (error) {
        console.error('Push subscribe error:', error);
        res.status(500).json({ error: 'Failed to register push subscription' });
    }
}

/**
 * DELETE /notifications/push/subscribe
 * Remove a push subscription (user disabled push or unsubscribed).
 */
export async function unsubscribePush(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const { endpoint } = req.body;

        if (!endpoint) {
            res.status(400).json({ error: 'endpoint is required' });
            return;
        }

        await prisma.pushSubscription.deleteMany({
            where: { userId, endpoint },
        });

        res.json({ message: 'Push subscription removed' });
    } catch (error) {
        console.error('Push unsubscribe error:', error);
        res.status(500).json({ error: 'Failed to remove push subscription' });
    }
}
