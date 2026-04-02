/**
 * Notification service — creates DB records and pushes real-time events.
 * All notification creation goes through here to keep logic centralised.
 */

import prisma from '../lib/prisma';
import { sendToUser, isUserOnline } from './websocket.service';
import { cache, cacheKey, TTL } from './redis.service';
import { sendPushToUser, isWebPushEnabled } from './webpush.service';

export type NotificationType =
    | 'NEW_MESSAGE'
    | 'INVESTMENT_INTEREST'
    | 'PROJECT_VIEW'
    | 'WATCHLIST_ADD'
    | 'FOLLOW'
    | 'PROJECT_UPDATE'
    | 'INVESTMENT_STATUS'
    | 'DECK_REQUEST'
    | 'DECK_APPROVED'
    | 'DECK_DENIED'
    | 'PROFILE_VIEW'
    | 'ZAP_RECEIVED'
    | 'EVENT_RSVP'
    | 'POST_COMMENT'
    | 'POST_LIKE'
    | 'COMMENT_LIKE'
    | 'COMMENT_REPLY'
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

        // If user is offline, try web push as fallback
        if (!isUserOnline(userId) && isWebPushEnabled()) {
            sendPushToUser(userId, {
                title,
                body,
                tag: `bies-${type.toLowerCase()}-${notification.id}`,
                url: getNotificationUrl(type, data),
                data: { notificationId: notification.id, type },
            }).catch((err) => {
                console.error('[Notification] Web push failed:', err);
            });
        }
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
    investmentId?: string;
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

export async function notifyDeckRequest(params: {
    builderId: string;
    investorName: string;
    projectTitle: string;
    projectId: string;
    requestId: string;
    message?: string;
}): Promise<void> {
    const defaultBody = `An investor wants to view the pitch deck for "${params.projectTitle}".`;
    const finalBody = params.message
        ? `${defaultBody} Message: "${params.message}"`
        : defaultBody;

    await createNotification({
        userId: params.builderId,
        type: 'DECK_REQUEST',
        title: `${params.investorName} requested your pitch deck`,
        body: finalBody,
        data: { projectId: params.projectId, requestId: params.requestId },
    });
}

export async function notifyDeckApproved(params: {
    investorId: string;
    projectTitle: string;
    projectId: string;
}): Promise<void> {
    await createNotification({
        userId: params.investorId,
        type: 'DECK_APPROVED',
        title: `Pitch deck access approved for "${params.projectTitle}"`,
        body: 'You can now download the pitch deck.',
        data: { projectId: params.projectId },
    });
}

export async function notifyDeckDenied(params: {
    investorId: string;
    projectTitle: string;
    projectId: string;
}): Promise<void> {
    await createNotification({
        userId: params.investorId,
        type: 'DECK_DENIED',
        title: `Pitch deck access denied for "${params.projectTitle}"`,
        body: 'The project builder declined your deck request.',
        data: { projectId: params.projectId },
    });
}

export async function notifyProfileView(params: {
    profileOwnerId: string;
    viewerName: string;
    viewerId: string;
}): Promise<void> {
    await createNotification({
        userId: params.profileOwnerId,
        type: 'PROFILE_VIEW',
        title: `${params.viewerName} viewed your profile`,
        body: 'Someone checked out your BIES profile.',
        data: { viewerId: params.viewerId },
    });
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

export async function notifyEventRsvp(params: {
    hostId: string;
    attendeeName: string;
    attendeeId: string;
    eventTitle: string;
    eventId: string;
    status: string;
}): Promise<void> {
    const statusText = params.status === 'GOING' ? 'is going to' : 'is interested in';
    await createNotification({
        userId: params.hostId,
        type: 'EVENT_RSVP',
        title: `${params.attendeeName} ${statusText} "${params.eventTitle}"`,
        body: `Someone RSVPed to your event.`,
        data: { eventId: params.eventId, attendeeId: params.attendeeId, status: params.status },
    });
}

export async function notifyZapReceived(params: {
    recipientUserId: string;
    senderPubkey: string;
    amountSats: number;
    comment?: string;
    projectId?: string;
    projectTitle?: string;
}): Promise<void> {
    const title = params.projectTitle
        ? `${params.amountSats} sats zapped to "${params.projectTitle}"`
        : `You received ${params.amountSats} sats`;

    await createNotification({
        userId: params.recipientUserId,
        type: 'ZAP_RECEIVED',
        title,
        body: params.comment || 'You received a Lightning zap!',
        data: {
            senderPubkey: params.senderPubkey,
            amountSats: params.amountSats,
            ...(params.projectId ? { projectId: params.projectId } : {}),
        },
    });
}

/**
 * Create a notification for a feed interaction (comment, like, reply, zap).
 * Looks up the target Nostr pubkey to find the BIES user. Silently skips if
 * the target is not a BIES user or if actor === target.
 */
export async function notifyFeedInteraction(params: {
    actorPubkey: string;
    targetPubkey: string;
    type: 'POST_COMMENT' | 'POST_LIKE' | 'COMMENT_LIKE' | 'COMMENT_REPLY';
    actorName: string;
    eventId?: string;
    contentPreview?: string;
}): Promise<void> {
    // Don't notify yourself
    if (params.actorPubkey === params.targetPubkey) return;

    // Look up target user by Nostr pubkey
    const targetUser = await prisma.user.findUnique({
        where: { nostrPubkey: params.targetPubkey },
        select: { id: true },
    });
    if (!targetUser) return; // Not a BIES user

    const typeConfig: Record<string, { title: string; body: string }> = {
        POST_COMMENT: {
            title: `${params.actorName} commented on your post`,
            body: params.contentPreview
                ? params.contentPreview.substring(0, 120)
                : 'Someone left a comment on your post.',
        },
        POST_LIKE: {
            title: `${params.actorName} liked your post`,
            body: 'Your post received a like.',
        },
        COMMENT_LIKE: {
            title: `${params.actorName} liked your comment`,
            body: 'Your comment received a like.',
        },
        COMMENT_REPLY: {
            title: `${params.actorName} replied to your comment`,
            body: params.contentPreview
                ? params.contentPreview.substring(0, 120)
                : 'Someone replied to your comment.',
        },
    };

    const cfg = typeConfig[params.type];
    if (!cfg) return;

    await createNotification({
        userId: targetUser.id,
        type: params.type,
        title: cfg.title,
        body: cfg.body,
        data: {
            actorPubkey: params.actorPubkey,
            eventId: params.eventId,
        },
    });
}

// ─── URL helper for push notification click-through ──────────────────────────

function getNotificationUrl(type: string, data: Record<string, unknown>): string {
    switch (type) {
        case 'NEW_MESSAGE':
            return '/messages';
        case 'INVESTMENT_INTEREST':
        case 'PROJECT_VIEW':
        case 'WATCHLIST_ADD':
        case 'PROJECT_UPDATE':
        case 'DECK_REQUEST':
        case 'DECK_APPROVED':
        case 'DECK_DENIED':
            return data.projectId ? `/projects/${data.projectId}` : '/projects';
        case 'FOLLOW':
        case 'PROFILE_VIEW':
            return data.followerId ? `/profile/${data.followerId}` :
                   data.viewerId ? `/profile/${data.viewerId}` : '/';
        case 'INVESTMENT_STATUS':
            return data.projectId ? `/projects/${data.projectId}` : '/notifications';
        case 'ZAP_RECEIVED':
            return data.projectId ? `/projects/${data.projectId}` : '/notifications';
        case 'EVENT_RSVP':
            return data.eventId ? `/events/${data.eventId}` : '/events';
        case 'POST_COMMENT':
        case 'POST_LIKE':
        case 'COMMENT_LIKE':
        case 'COMMENT_REPLY':
            return '/feed';
        default:
            return '/notifications';
    }
}
