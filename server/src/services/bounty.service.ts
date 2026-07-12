/**
 * Bounty core — Stacker News model: sats pay-on-award, points escrow-at-post.
 *
 * Points rail: creating a POINTS bounty debits the poster's spendable
 * bountyPoints inside the create transaction; award settles instantly
 * (OPEN → PAID) crediting the winner; cancel/expire refunds the poster.
 * Every flow is a PointEvent ledger row via applyBountyTransfer, so replays
 * are absorbed by the (nostrEventId, userId, reason) unique constraint.
 *
 * Sats rail: no escrow. OPEN → AWARDED (pick winner) → PAID (poster marks
 * paid, or a matching zap receipt auto-settles it). The receipt verifies
 * payment, it doesn't enforce it.
 *
 * All state transitions are status-preconditioned updateMany calls so
 * concurrent award/cancel/double-pay lose the race cleanly (409).
 */

import type { ZapReceipt } from '@prisma/client';
import prisma from '../lib/prisma';
import { config } from '../config';
import {
    applyBountyTransfer,
    InsufficientBountyBalanceError,
    isUniqueViolation,
} from './points.service';
import {
    notifyBountySubmission,
    notifyBountyAwarded,
    notifyBountyPaid,
    notifyBountyRefunded,
    notifyBountyCancelled,
} from './notification.service';
import { publishEvent, fetchEventById } from './nostr.service';

// ─── Types & constants ───────────────────────────────────────────────────────

export type BountyRewardType = 'SATS' | 'POINTS';
export type BountyPaidVia = 'WALLET' | 'MANUAL';

export class BountyError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'BountyError';
    }
}

export { InsufficientBountyBalanceError };

const AMOUNT_LIMITS: Record<BountyRewardType, { min: number; max: number }> = {
    POINTS: { min: 5, max: 10_000 },
    SATS: { min: 100, max: 1_000_000 },
};

const HEX64_RE = /^[0-9a-f]{64}$/;

const MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const MAINTENANCE_BOOT_DELAY_MS = 15_000;

// ─── Shared selects ──────────────────────────────────────────────────────────

const posterSelect = {
    select: {
        id: true, nostrPubkey: true,
        profile: { select: { name: true, avatar: true } },
    },
};

// Submission authors expose lightningAddress so the poster can pay a sats
// winner directly (same shape the directory ZapButton consumes).
const submissionUserSelect = {
    select: {
        id: true, nostrPubkey: true,
        profile: { select: { name: true, avatar: true, lightningAddress: true } },
    },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** authenticate() doesn't check ban/deletion — money-moving ops must. */
async function requireActiveUser(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, encryptedPrivkey: true, isBanned: true, deletedAt: true },
    });
    if (!user || user.isBanned || user.deletedAt) {
        throw new BountyError(403, 'Account is not allowed to use bounties');
    }
    return user;
}

async function displayName(userId: string): Promise<string> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { name: true },
    });
    return profile?.name || 'Someone';
}

function logNotifyError(err: unknown): void {
    console.error('[Bounties] Notify failed:', err);
}

// ─── Create / list / read ────────────────────────────────────────────────────

export interface CreateBountyData {
    title: string;
    description?: string;
    rewardType: BountyRewardType;
    amount: number;
    deadline?: string | null;
}

export async function createBounty(userId: string, data: CreateBountyData) {
    const user = await requireActiveUser(userId);

    const { min, max } = AMOUNT_LIMITS[data.rewardType];
    if (!Number.isInteger(data.amount) || data.amount < min || data.amount > max) {
        throw new BountyError(
            400,
            `${data.rewardType} bounty amount must be between ${min} and ${max}`
        );
    }

    const deadline = data.deadline ? new Date(data.deadline) : null;
    if (deadline && (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now())) {
        throw new BountyError(400, 'Deadline must be in the future');
    }

    const bounty = await prisma.$transaction(async (tx) => {
        const created = await tx.bounty.create({
            data: {
                posterId: userId,
                title: data.title,
                description: data.description ?? '',
                rewardType: data.rewardType,
                amount: data.amount,
                deadline,
            },
            include: { poster: posterSelect },
        });
        // Escrow-at-post: overdraw throws and rolls the create back.
        if (data.rewardType === 'POINTS') {
            await applyBountyTransfer(tx, {
                userId,
                delta: -data.amount,
                reason: 'BOUNTY_ESCROW',
                bountyId: created.id,
            });
        }
        return created;
    });

    // Custodial posters get a server-published kind-1 mirror; Nostr-native
    // posters publish client-side and attach via POST /:id/mirror.
    if (user.encryptedPrivkey) {
        mirrorBountyNote(bounty.id, userId).catch((err) =>
            console.error('[Bounties] Mirror publish failed:', err)
        );
    }

    return bounty;
}

export interface BountyListFilters {
    status?: string;
    rewardType?: string;
    featured?: boolean;
    posterId?: string;
    /** Bounties the user posted OR submitted to (the "mine" tab). */
    participantId?: string;
    page?: number;
    limit?: number;
}

export async function listBounties(filters: BountyListFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 20));

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.rewardType) where.rewardType = filters.rewardType;
    if (filters.featured) where.featured = true;
    if (filters.posterId) where.posterId = filters.posterId;
    if (filters.participantId) {
        where.OR = [
            { posterId: filters.participantId },
            { submissions: { some: { userId: filters.participantId } } },
        ];
    }

    const [data, total] = await Promise.all([
        prisma.bounty.findMany({
            where,
            include: {
                poster: posterSelect,
                _count: { select: { submissions: true } },
            },
            orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.bounty.count({ where }),
    ]);

    return {
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

export async function getBounty(id: string) {
    const bounty = await prisma.bounty.findUnique({
        where: { id },
        include: {
            poster: posterSelect,
            submissions: {
                include: { user: submissionUserSelect },
                orderBy: { createdAt: 'asc' },
            },
            winnerSubmission: { include: { user: submissionUserSelect } },
        },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    return bounty;
}

// ─── Submissions ─────────────────────────────────────────────────────────────

export async function submitToBounty(userId: string, bountyId: string, content: string) {
    await requireActiveUser(userId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, posterId: true, status: true, title: true, deadline: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId === userId) {
        throw new BountyError(400, 'You cannot submit to your own bounty');
    }
    if (bounty.status !== 'OPEN') {
        throw new BountyError(409, 'Bounty is not open for submissions');
    }
    if (bounty.deadline && bounty.deadline.getTime() <= Date.now()) {
        throw new BountyError(409, 'Bounty deadline has passed');
    }

    let submission;
    try {
        submission = await prisma.bountySubmission.create({
            data: { bountyId, userId, content },
            include: { user: submissionUserSelect },
        });
    } catch (error) {
        if (isUniqueViolation(error)) {
            throw new BountyError(409, 'You have already submitted to this bounty');
        }
        throw error;
    }

    (async () => {
        await notifyBountySubmission({
            posterId: bounty.posterId,
            submitterName: await displayName(userId),
            bountyTitle: bounty.title,
            bountyId,
        });
    })().catch(logNotifyError);

    return submission;
}

export async function updateSubmission(userId: string, bountyId: string, content: string) {
    await requireActiveUser(userId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, status: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.status !== 'OPEN') {
        throw new BountyError(409, 'Submissions can only be edited while the bounty is open');
    }

    // The bounty-status condition rides inside the update itself so a racing
    // award/cancel can't let content change after the submission was judged.
    const updated = await prisma.bountySubmission.updateMany({
        where: { bountyId, userId, bounty: { status: 'OPEN' } },
        data: { content },
    });
    if (updated.count !== 1) {
        const exists = await prisma.bountySubmission.findUnique({
            where: { bountyId_userId: { bountyId, userId } },
            select: { id: true },
        });
        if (exists) {
            throw new BountyError(409, 'Submissions can only be edited while the bounty is open');
        }
        throw new BountyError(404, 'Submission not found');
    }

    return prisma.bountySubmission.findUnique({
        where: { bountyId_userId: { bountyId, userId } },
        include: { user: submissionUserSelect },
    });
}

// ─── Award / pay / cancel ────────────────────────────────────────────────────

export async function awardBounty(posterId: string, bountyId: string, submissionId: string) {
    await requireActiveUser(posterId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, posterId: true, title: true, rewardType: true, amount: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can award this bounty');
    }

    const submission = await prisma.bountySubmission.findUnique({
        where: { id: submissionId },
        select: {
            id: true, bountyId: true, userId: true,
            user: { select: { isBanned: true, deletedAt: true } },
        },
    });
    if (!submission || submission.bountyId !== bountyId) {
        throw new BountyError(404, 'Submission not found');
    }
    if (submission.user.isBanned || submission.user.deletedAt) {
        throw new BountyError(400, 'Winner account is not active');
    }

    const now = new Date();

    if (bounty.rewardType === 'POINTS') {
        // Instant settle: escrowed points move to the winner, OPEN → PAID.
        await prisma.$transaction(async (tx) => {
            const updated = await tx.bounty.updateMany({
                where: { id: bountyId, status: 'OPEN' },
                data: {
                    status: 'PAID',
                    winnerSubmissionId: submissionId,
                    awardedAt: now,
                    paidAt: now,
                    paidVia: 'POINTS',
                },
            });
            if (updated.count !== 1) throw new BountyError(409, 'Bounty is not open');
            await applyBountyTransfer(tx, {
                userId: submission.userId,
                delta: bounty.amount,
                reason: 'BOUNTY_AWARD',
                bountyId,
            });
        });

        notifyBountyPaid({
            winnerId: submission.userId,
            bountyTitle: bounty.title,
            bountyId,
            rewardType: bounty.rewardType,
            amount: bounty.amount,
        }).catch(logNotifyError);
    } else {
        const updated = await prisma.bounty.updateMany({
            where: { id: bountyId, status: 'OPEN' },
            data: { status: 'AWARDED', winnerSubmissionId: submissionId, awardedAt: now },
        });
        if (updated.count !== 1) throw new BountyError(409, 'Bounty is not open');

        notifyBountyAwarded({
            winnerId: submission.userId,
            bountyTitle: bounty.title,
            bountyId,
            rewardType: bounty.rewardType,
            amount: bounty.amount,
        }).catch(logNotifyError);
    }

    return getBounty(bountyId);
}

export async function unawardBounty(posterId: string, bountyId: string) {
    await requireActiveUser(posterId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, posterId: true, rewardType: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can un-award this bounty');
    }
    if (bounty.rewardType !== 'SATS') {
        throw new BountyError(400, 'Only sats bounties can be un-awarded');
    }

    const updated = await prisma.bounty.updateMany({
        where: { id: bountyId, status: 'AWARDED' },
        data: { status: 'OPEN', winnerSubmissionId: null, awardedAt: null },
    });
    if (updated.count !== 1) throw new BountyError(409, 'Bounty is not awarded');

    return getBounty(bountyId);
}

export async function markPaid(posterId: string, bountyId: string, via: BountyPaidVia) {
    await requireActiveUser(posterId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: {
            id: true, posterId: true, title: true, rewardType: true, amount: true,
            winnerSubmission: { select: { userId: true } },
        },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can mark this bounty paid');
    }

    const updated = await prisma.bounty.updateMany({
        where: { id: bountyId, status: 'AWARDED' },
        data: { status: 'PAID', paidAt: new Date(), paidVia: via },
    });
    if (updated.count !== 1) throw new BountyError(409, 'Bounty is not awarded');

    if (bounty.winnerSubmission) {
        notifyBountyPaid({
            winnerId: bounty.winnerSubmission.userId,
            bountyTitle: bounty.title,
            bountyId,
            rewardType: bounty.rewardType,
            amount: bounty.amount,
        }).catch(logNotifyError);
    }

    return getBounty(bountyId);
}

export async function cancelBounty(posterId: string, bountyId: string) {
    // Deliberately NO requireActiveUser: a banned poster cancelling an OPEN
    // POINTS bounty just reclaims their own escrow — blocking that would
    // strand the points. Every other poster-side mutation checks it.
    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, posterId: true, title: true, rewardType: true, amount: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can cancel this bounty');
    }

    await prisma.$transaction(async (tx) => {
        const updated = await tx.bounty.updateMany({
            where: { id: bountyId, status: 'OPEN' },
            data: { status: 'CANCELLED' },
        });
        if (updated.count !== 1) {
            throw new BountyError(409, 'Only open bounties can be cancelled');
        }
        if (bounty.rewardType === 'POINTS') {
            await applyBountyTransfer(tx, {
                userId: bounty.posterId,
                delta: bounty.amount,
                reason: 'BOUNTY_REFUND',
                bountyId,
            });
        }
    });

    (async () => {
        if (bounty.rewardType === 'POINTS') {
            await notifyBountyRefunded({
                posterId: bounty.posterId,
                bountyTitle: bounty.title,
                bountyId,
                amount: bounty.amount,
            });
        }
        const submitters = await prisma.bountySubmission.findMany({
            where: { bountyId },
            select: { userId: true },
        });
        if (submitters.length > 0) {
            await notifyBountyCancelled({
                submitterIds: submitters.map((s) => s.userId),
                bountyTitle: bounty.title,
                bountyId,
            });
        }
    })().catch(logNotifyError);

    return getBounty(bountyId);
}

// ─── Deadline expiry ─────────────────────────────────────────────────────────

/**
 * Expire OPEN bounties past their deadline, refunding points escrow.
 * Idempotent: the status precondition loses races with award/cancel, and the
 * ledger unique constraint absorbs a replayed refund.
 */
export async function expireBounties(): Promise<number> {
    const due = await prisma.bounty.findMany({
        where: { status: 'OPEN', deadline: { lt: new Date() } },
        select: { id: true, posterId: true, title: true, rewardType: true, amount: true },
    });

    let expired = 0;
    for (const bounty of due) {
        let didExpire = false;
        await prisma.$transaction(async (tx) => {
            const updated = await tx.bounty.updateMany({
                where: { id: bounty.id, status: 'OPEN' },
                data: { status: 'EXPIRED' },
            });
            if (updated.count !== 1) return; // raced with award/cancel
            if (bounty.rewardType === 'POINTS') {
                await applyBountyTransfer(tx, {
                    userId: bounty.posterId,
                    delta: bounty.amount,
                    reason: 'BOUNTY_REFUND',
                    bountyId: bounty.id,
                });
            }
            didExpire = true;
        });

        if (didExpire) {
            expired += 1;
            if (bounty.rewardType === 'POINTS') {
                notifyBountyRefunded({
                    posterId: bounty.posterId,
                    bountyTitle: bounty.title,
                    bountyId: bounty.id,
                    amount: bounty.amount,
                }).catch(logNotifyError);
            }
        }
    }

    if (expired > 0) console.log(`[Bounties] Expired ${expired} bounties`);
    return expired;
}

let maintenanceStarted = false;

/**
 * Start the maintenance loop: one run shortly after boot, then every 15
 * minutes (points.indexer.ts pattern). Each tick sweeps expired deadlines.
 */
export function startBountyMaintenanceLoop(): void {
    if (maintenanceStarted) return;
    maintenanceStarted = true;

    const tick = () => {
        expireBounties().catch((error) =>
            console.error('[Bounties] Expiry sweep failed:', error)
        );
    };

    setTimeout(tick, MAINTENANCE_BOOT_DELAY_MS);
    setInterval(tick, MAINTENANCE_INTERVAL_MS);
    console.log(
        `[Bounties] Maintenance loop scheduled every ${MAINTENANCE_INTERVAL_MS / 60000} min`
    );
}

// ─── Nostr mirror ────────────────────────────────────────────────────────────

/**
 * Publish a kind-1 mirror note for a custodial poster and persist its id.
 * Returns null when server-side publish isn't possible (Nostr-native user —
 * publishEvent skips) or a concurrent attach won the nostrEventId slot.
 */
export async function mirrorBountyNote(bountyId: string, posterId: string): Promise<string | null> {
    await requireActiveUser(posterId);

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: { id: true, posterId: true, title: true, rewardType: true, amount: true, nostrEventId: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can mirror this bounty');
    }
    if (bounty.nostrEventId) throw new BountyError(409, 'Bounty already mirrored to Nostr');

    const unit = bounty.rewardType === 'SATS' ? 'sats' : 'points';
    const eventId = await publishEvent(posterId, {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: `🎯 New bounty: ${bounty.title} — ${bounty.amount} ${unit}\n\n${config.appPublicUrl}/bounties/${bounty.id}`,
    });
    if (!eventId) return null;

    // First writer wins — never overwrite an already-attached mirror.
    const updated = await prisma.bounty.updateMany({
        where: { id: bountyId, nostrEventId: null },
        data: { nostrEventId: eventId },
    });
    return updated.count === 1 ? eventId : null;
}

/** Attach a client-published mirror note id (Nostr-native posters). */
export async function attachMirrorEvent(bountyId: string, posterId: string, eventId: string) {
    await requireActiveUser(posterId);

    if (!HEX64_RE.test(eventId)) {
        throw new BountyError(400, 'eventId must be 64 lowercase hex characters');
    }

    const bounty = await prisma.bounty.findUnique({
        where: { id: bountyId },
        select: {
            id: true, posterId: true, nostrEventId: true,
            poster: { select: { nostrPubkey: true } },
        },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');
    if (bounty.posterId !== posterId) {
        throw new BountyError(403, 'Only the poster can mirror this bounty');
    }
    if (bounty.nostrEventId) throw new BountyError(409, 'Bounty already mirrored to Nostr');

    // The mirror id is a settlement input (matchBountyPayout treats zaps of
    // this note as bounty payments), so never trust a client-supplied id:
    // the note must actually exist on our relays and be a kind-1 authored by
    // the poster. Blocks binding someone else's popular note as the mirror.
    const event = await fetchEventById(eventId);
    if (!event) {
        throw new BountyError(400, 'Mirror note not found on the configured relays');
    }
    if (event.kind !== 1 || !bounty.poster.nostrPubkey || event.pubkey !== bounty.poster.nostrPubkey) {
        throw new BountyError(403, 'Mirror note must be a kind-1 note authored by the bounty poster');
    }

    const updated = await prisma.bounty.updateMany({
        where: { id: bountyId, nostrEventId: null },
        data: { nostrEventId: eventId },
    });
    if (updated.count !== 1) throw new BountyError(409, 'Bounty already mirrored to Nostr');

    return prisma.bounty.findUnique({
        where: { id: bountyId },
        include: { poster: posterSelect },
    });
}

// ─── Zap receipt auto-match ──────────────────────────────────────────────────

/**
 * Settle AWARDED sats bounties from an incoming zap receipt. A receipt
 * matches when it pays the winner at least the bounty amount, after the
 * award (per the zap event's own timestamp, not our insert time), AND
 * either zaps the bounty's mirror note or comes from the poster. One
 * receipt settles at most one bounty (oldest award first).
 * Trust model: the receipt verifies payment, it doesn't enforce it.
 */
export async function matchBountyPayout(receipt: ZapReceipt): Promise<void> {
    const candidates = await prisma.bounty.findMany({
        where: {
            status: 'AWARDED',
            rewardType: 'SATS',
            winnerSubmission: { user: { nostrPubkey: receipt.recipientPubkey } },
        },
        select: {
            id: true, title: true, rewardType: true, amount: true,
            awardedAt: true, nostrEventId: true, winnerSubmissionId: true,
            poster: { select: { nostrPubkey: true } },
            winnerSubmission: { select: { userId: true } },
        },
        orderBy: { awardedAt: 'asc' },
    });

    for (const bounty of candidates) {
        // Pre-award zaps (e.g. indexed late after downtime) never settle;
        // legacy receipts without eventCreatedAt are ignored too.
        const paidAfterAward =
            !!bounty.awardedAt &&
            !!receipt.eventCreatedAt &&
            receipt.eventCreatedAt > bounty.awardedAt;
        const coversAmount = receipt.amountSats >= bounty.amount;
        const matchesMirror =
            !!receipt.zappedEventId && receipt.zappedEventId === bounty.nostrEventId;
        const matchesDirect = receipt.senderPubkey === bounty.poster.nostrPubkey;
        if (!paidAfterAward || !coversAmount || (!matchesMirror && !matchesDirect)) {
            continue;
        }

        // Pin the winner/award snapshot the match was decided on, so an
        // un-award + re-award racing us can't get PAID with the old receipt.
        const updated = await prisma.bounty.updateMany({
            where: {
                id: bounty.id,
                status: 'AWARDED',
                winnerSubmissionId: bounty.winnerSubmissionId,
                awardedAt: bounty.awardedAt,
            },
            data: {
                status: 'PAID',
                paidAt: new Date(),
                paidVia: 'ZAP_RECEIPT',
                zapReceiptId: receipt.eventId,
            },
        });
        if (updated.count !== 1) continue; // raced with mark-paid/un-award

        console.log(`[Bounties] Zap receipt ${receipt.eventId} settled bounty ${bounty.id}`);
        if (bounty.winnerSubmission) {
            notifyBountyPaid({
                winnerId: bounty.winnerSubmission.userId,
                bountyTitle: bounty.title,
                bountyId: bounty.id,
                rewardType: bounty.rewardType,
                amount: bounty.amount,
            }).catch(logNotifyError);
        }
        return; // one payment settles one bounty
    }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminBountyListFilters {
    status?: string;
    rewardType?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export async function adminListBounties(filters: AdminBountyListFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 30));

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.rewardType) where.rewardType = filters.rewardType;
    if (filters.search) {
        where.OR = [
            { title: { contains: filters.search } },
            { description: { contains: filters.search } },
        ];
    }

    const [data, total] = await Promise.all([
        prisma.bounty.findMany({
            where,
            include: {
                poster: {
                    select: {
                        id: true, email: true, nostrPubkey: true,
                        profile: { select: { name: true, avatar: true } },
                    },
                },
                _count: { select: { submissions: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.bounty.count({ where }),
    ]);

    return {
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/** Delete a bounty, refunding points escrow if it is still held (OPEN). */
export async function adminDeleteBounty(id: string): Promise<{ refunded: boolean }> {
    const bounty = await prisma.bounty.findUnique({
        where: { id },
        select: { id: true, posterId: true, title: true, rewardType: true, amount: true },
    });
    if (!bounty) throw new BountyError(404, 'Bounty not found');

    let refunded = false;
    await prisma.$transaction(async (tx) => {
        if (bounty.rewardType === 'POINTS') {
            // Status precondition stops a double refund if an award races the
            // delete — refund only while the escrow is still held (OPEN).
            const guarded = await tx.bounty.updateMany({
                where: { id, status: 'OPEN' },
                data: { status: 'CANCELLED' },
            });
            if (guarded.count === 1) {
                await applyBountyTransfer(tx, {
                    userId: bounty.posterId,
                    delta: bounty.amount,
                    reason: 'BOUNTY_REFUND',
                    bountyId: id,
                });
                refunded = true;
            }
        }
        await tx.bounty.delete({ where: { id } });
    });

    if (refunded) {
        // No bountyId: the row was just hard-deleted, so a deep-link would 404.
        notifyBountyRefunded({
            posterId: bounty.posterId,
            bountyTitle: bounty.title,
            amount: bounty.amount,
        }).catch(logNotifyError);
    }

    return { refunded };
}

export async function adminSetFeatured(id: string, featured: boolean) {
    const bounty = await prisma.bounty.findUnique({ where: { id }, select: { id: true } });
    if (!bounty) throw new BountyError(404, 'Bounty not found');

    return prisma.bounty.update({
        where: { id },
        data: { featured },
        include: { poster: posterSelect },
    });
}
