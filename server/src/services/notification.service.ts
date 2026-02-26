/**
 * Notification service — creates DB records and pushes real-time events.
 * All notification creation goes through here to keep logic centralised.
 */

import prisma from '../lib/prisma';
import { sendToUser } from './websocket.service';
import { cache, cacheKey, TTL } from './redis.service';

export type NotificationType =
    | 'NEW_MESSAGE'
    | 'INVESTMENT_INTEREST'
    | 'PROJECT_VIEW'
    | 'WATCHLIST_ADD'
    | 'FOLLOW'
    | 'PROJECT_UPDATE'
    | 'INVESTMENT_STATUS'
    | 'SYSTEM';

interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}

/**
 * Create a notification and push it via WebSocket (if user is online).
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
    const { userId, type, title, body, data = {} } = params;

    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                body,
                data: JSON.stringify(data),
            },
        });

        // Invalidate notification count cache for this user
        await cache.del(cacheKey.notificationCount(userId));

        // Push to WebSocket if user is connected
        sendToUser(userId, {
            type: 'notification',
            notification: {
                id: notification.id,
                type,
                title,
                body,
                data,
                isRead: false,
                createdAt: notification.createdAt,
            },
        });
    } catch (error) {
        console.error('[Notification] Failed to create notification:', error);
    }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export async function notifyNewMessage(params: {
    recipientId: string;
    senderName: string;
    preview: string;
    senderId: string;
}): Promise<void> {
    await createNotification({
        userId: params.recipientId,
        type: 'NEW_MESSAGE',
        title: `New message from ${params.senderName}`,
        body: params.preview.substring(0, 100),
        data: { senderId: params.senderId },
    });
}

export async function notifyInvestmentInterest(params: {
    builderId: string;
    investorName: string;
    projectTitle: string;
    projectId: string;
    investmentId: string;
}): Promise<void> {
    await createNotification({
        userId: params.builderId,
        type: 'INVESTMENT_INTEREST',
        title: `${params.investorName} is interested in "${params.projectTitle}"`,
        body: 'An investor has expressed interest in your project.',
        data: { projectId: params.projectId, investmentId: params.investmentId },
    });
}

export async function notifyWatchlistAdd(params: {
    builderId: string;
    investorName: string;
    projectTitle: string;
    projectId: string;
}): Promise<void> {
    await createNotification({
        userId: params.builderId,
        type: 'WATCHLIST_ADD',
        title: `"${params.projectTitle}" was saved to a watchlist`,
        body: `${params.investorName} added your project to their watchlist.`,
        data: { projectId: params.projectId },
    });
}

export async function notifyFollow(params: {
    followedId: string;
    followerName: string;
    followerId: string;
}): Promise<void> {
    await createNotification({
        userId: params.followedId,
        type: 'FOLLOW',
        title: `${params.followerName} started following you`,
        body: 'You have a new follower on BIES.',
        data: { followerId: params.followerId },
    });
}

export async function notifyProjectUpdate(params: {
    projectId: string;
    projectTitle: string;
    updateTitle: string;
    watcherIds: string[];
}): Promise<void> {
    // Fan out to all watchers
    const promises = params.watcherIds.map((userId) =>
        createNotification({
            userId,
            type: 'PROJECT_UPDATE',
            title: `Update: "${params.projectTitle}"`,
            body: params.updateTitle,
            data: { projectId: params.projectId },
        })
    );
    await Promise.allSettled(promises);
}

export async function notifyInvestmentStatus(params: {
    investorId: string;
    projectTitle: string;
    status: string;
    projectId: string;
}): Promise<void> {
    await createNotification({
        userId: params.investorId,
        type: 'INVESTMENT_STATUS',
        title: `Investment update for "${params.projectTitle}"`,
        body: `Your investment status changed to: ${params.status}`,
        data: { projectId: params.projectId, status: params.status },
    });
}
