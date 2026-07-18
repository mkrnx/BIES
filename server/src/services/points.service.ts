/**
 * Points scoring core — classifies Nostr events (kinds 1, 7) from the private
 * relay into point ledger entries, applies them to UserScore, detects level
 * ups and awards badges.
 *
 * This module is deliberately relay-free: the indexer/backfill wiring
 * (`startPointsScorer`, subscription, maintenance loop) lives in
 * `points.indexer.ts` and feeds events into `processEvent`.
 *
 * The PointEvent ledger is authoritative; UserScore is a cache. Ledger rows
 * carry the *event* timestamp in `createdAt` so rate limits, daily caps and
 * monthly buckets are deterministic across live scoring and backfill.
 */

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { notifyLevelUp, notifyBadgeEarned } from './notification.service';
import { broadcast } from './websocket.service';
import { getQualityBonus } from './quality.service';
import { invalidateLeaderboardCache } from './redis.service';
import { BADGES, LEVEL_TITLES } from './badges.catalog';
import { publishBadgeAward } from './badges.publisher';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Minimal Nostr event shape (structural — no nostr-tools import needed). */
export interface NostrEventLike {
    id: string;
    pubkey: string;
    kind: number;
    content: string;
    tags: string[][];
    created_at: number; // unix seconds
}

export type PointReason =
    | 'POST'
    | 'REPLY'
    | 'REACTION_GIVEN'
    | 'REACTION_RECEIVED'
    | 'QUALITY_BONUS'
    | 'ADMIN_ADJUST'
    | 'COURSE_COMPLETED';

export type Classification =
    | { type: 'POST'; points: number }
    | { type: 'REPLY'; points: number }
    | {
          type: 'REACTION';
          given: number;
          received: number;
          targetEventId: string;
          targetPubkey: string;
      };

export interface PointEntry {
    nostrEventId: string | null;
    kind: number | null;
    reason: PointReason;
    points: number;
    month: string; // 'YYYY-MM' UTC from the event timestamp
    targetEventId?: string | null;
    meta?: Record<string, unknown>;
    /** Event timestamp — stored as PointEvent.createdAt (backfill-safe). */
    eventCreatedAt: Date;
}

export interface ScoreOpts {
    /** Suppress notifications/broadcasts (used during backfill). */
    silent?: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const POINTS_POST = 2;
const POINTS_REPLY = 3;
const POINTS_LENGTH_BONUS = 1;
const POINTS_REACTION = 1;
const MIN_STRIPPED_LENGTH = 10;
const LENGTH_BONUS_THRESHOLD = 120;
const NOTE_RATE_LIMIT_MS = 60_000; // 1 scored note per minute
const DAILY_POINT_CAP = 100;
const DAILY_REACTIONS_GIVEN_CAP = 20;

// ─── Levels ──────────────────────────────────────────────────────────────────

/** level = floor(sqrt(lifetimePoints / 10)) — L1=10, L5=250, L10=1000, L20=4000. */
export function levelFor(lifetimePoints: number): number {
    if (lifetimePoints <= 0) return 0;
    return Math.floor(Math.sqrt(lifetimePoints / 10));
}

/** Lifetime points required to reach the next level. */
export function nextLevelAt(level: number): number {
    return 10 * (level + 1) ** 2;
}

/** i18n title key for a level (highest threshold <= level). */
export function titleKeyFor(level: number): string {
    let key = LEVEL_TITLES[0].titleKey;
    for (const entry of LEVEL_TITLES) {
        if (level >= entry.level) key = entry.titleKey;
    }
    return key;
}

// ─── Ranking order (single source of truth) ──────────────────────────────────

/**
 * Canonical leaderboard ordering: points DESC, then `updatedAt` ASC (on a
 * points tie, whoever reached the score first ranks higher), then `userId`
 * ASC as a deterministic final tie-break. Used by BOTH the live leaderboard
 * query (points.controller.ts) and the monthly rollover snapshot
 * (points.indexer.ts) so a frozen rank always matches the live rank users
 * saw during the month.
 */
export function leaderboardOrderBy(
    field: 'monthlyPoints' | 'lifetimePoints'
): Prisma.UserScoreOrderByWithRelationInput[] {
    return field === 'monthlyPoints'
        ? [{ monthlyPoints: 'desc' }, { updatedAt: 'asc' }, { userId: 'asc' }]
        : [{ lifetimePoints: 'desc' }, { updatedAt: 'asc' }, { userId: 'asc' }];
}

// ─── Classification (pure) ───────────────────────────────────────────────────

/** Remove URLs and nostr: refs, collapse whitespace, trim. */
export function stripContent(content: string): string {
    return content
        .replace(/https?:\/\/\S+/g, '')
        .replace(/nostr:\S+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function firstTagValue(event: NostrEventLike, tagName: string): string | null {
    const tag = event.tags.find((t) => t[0] === tagName);
    return tag?.[1] || null;
}

/**
 * Classify a Nostr event into a scoring outcome. Pure — no DB access.
 * Returns null for events that never score (wrong kind, machine-generated,
 * too short, self-reply, self-reaction, downvote, malformed reaction).
 */
export function classifyEvent(event: NostrEventLike): Classification | null {
    if (event.kind === 1) {
        // Machine-generated content (mirrors Feed.jsx filtering).
        if (
            event.content.startsWith('{') ||
            event.content.startsWith('[') ||
            event.content.startsWith('xitchat-')
        ) {
            return null;
        }

        const strippedLen = stripContent(event.content).length;
        if (strippedLen < MIN_STRIPPED_LENGTH) return null;

        const lengthBonus = strippedLen >= LENGTH_BONUS_THRESHOLD ? POINTS_LENGTH_BONUS : 0;
        const isReply = event.tags.some((t) => t[0] === 'e');

        if (!isReply) {
            return { type: 'POST', points: POINTS_POST + lengthBonus };
        }

        // Self-reply never scores.
        const parentPubkey = firstTagValue(event, 'p');
        if (parentPubkey && parentPubkey === event.pubkey) return null;

        return { type: 'REPLY', points: POINTS_REPLY + lengthBonus };
    }

    if (event.kind === 7) {
        if (event.content === '-') return null; // downvote

        const targetEventId = firstTagValue(event, 'e');
        const targetPubkey = firstTagValue(event, 'p');
        if (!targetEventId || !targetPubkey) return null; // malformed reaction
        if (targetPubkey === event.pubkey) return null; // self-reaction

        return {
            type: 'REACTION',
            given: POINTS_REACTION,
            received: POINTS_REACTION,
            targetEventId,
            targetPubkey,
        };
    }

    return null;
}

// ─── Date helpers (all UTC, event-time based) ────────────────────────────────

export function monthOf(date: Date): string {
    return date.toISOString().slice(0, 7); // 'YYYY-MM'
}

function dayOf(date: Date): string {
    return date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function utcDayRange(date: Date): { start: Date; end: Date } {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    return { start, end };
}

/** Whether `day` (YYYY-MM-DD) is exactly the day after `prevDay`. */
function isNextUtcDay(prevDay: string, day: string): boolean {
    const prev = new Date(`${prevDay}T00:00:00.000Z`).getTime();
    const curr = new Date(`${day}T00:00:00.000Z`).getTime();
    return curr - prev === 86_400_000;
}

export function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: string }).code === 'P2002'
    );
}

// ─── Process a Nostr event ───────────────────────────────────────────────────

/**
 * Score a single Nostr event. Idempotent: replays are absorbed by the
 * (nostrEventId, userId, reason) unique constraint and the reaction dedup.
 */
export async function processEvent(
    event: NostrEventLike,
    opts: ScoreOpts = {}
): Promise<void> {
    const classification = classifyEvent(event);
    if (!classification) return;

    const user = await prisma.user.findUnique({
        where: { nostrPubkey: event.pubkey },
        select: { id: true, isBanned: true, deletedAt: true },
    });
    if (!user || user.isBanned || user.deletedAt) return;

    const eventDate = new Date(event.created_at * 1000);
    const month = monthOf(eventDate);

    if (classification.type === 'POST' || classification.type === 'REPLY') {
        const entry: PointEntry = {
            nostrEventId: event.id,
            kind: event.kind,
            reason: classification.type,
            points: classification.points,
            month,
            eventCreatedAt: eventDate,
        };

        // Anti-gaming: 1 scored note/min, compared against *event* created_at.
        const score = await prisma.userScore.findUnique({
            where: { userId: user.id },
            select: { lastScoredNoteAt: true },
        });
        if (
            score?.lastScoredNoteAt &&
            eventDate.getTime() - score.lastScoredNoteAt.getTime() < NOTE_RATE_LIMIT_MS
        ) {
            await writeAuditRow(user.id, entry, { rateLimited: true });
            return;
        }

        // Daily cap: 100 points per UTC day (event-time based).
        const used = await dailyPointsUsed(user.id, eventDate);
        if (used + entry.points > DAILY_POINT_CAP) {
            await writeAuditRow(user.id, entry, { dailyCapped: true });
            return;
        }

        await applyPoints(user.id, entry, opts);

        // Quality bonus hook — no-op stub today (returns null); see quality.service.ts.
        const bonus = await getQualityBonus(event.content);
        if (bonus !== null && bonus > 0) {
            const bonusEntry: PointEntry = {
                nostrEventId: event.id,
                kind: event.kind,
                reason: 'QUALITY_BONUS',
                points: bonus,
                month,
                meta: { aiScore: bonus },
                eventCreatedAt: eventDate,
            };
            const usedAfter = await dailyPointsUsed(user.id, eventDate);
            if (usedAfter + bonus > DAILY_POINT_CAP) {
                await writeAuditRow(user.id, bonusEntry, { dailyCapped: true, aiScore: bonus });
            } else {
                await applyPoints(user.id, bonusEntry, opts);
            }
        }
        return;
    }

    // ── Reaction ─────────────────────────────────────────────────────────
    const { targetEventId, targetPubkey } = classification;

    const givenEntry: PointEntry = {
        nostrEventId: event.id,
        kind: event.kind,
        reason: 'REACTION_GIVEN',
        points: classification.given,
        month,
        targetEventId,
        eventCreatedAt: eventDate,
    };

    // Dedup: only the first reaction by this user to a given target scores —
    // a repeat reaction (different event id, same target) is skipped entirely.
    const existing = await prisma.pointEvent.findFirst({
        where: { userId: user.id, targetEventId, reason: 'REACTION_GIVEN' },
        select: { id: true },
    });
    if (existing) return;

    // Daily cap: 20 scored reactions given per UTC day. When capped, the
    // received side is skipped too (no farming points for a friend).
    const { start, end } = utcDayRange(eventDate);
    const givenToday = await prisma.pointEvent.count({
        where: {
            userId: user.id,
            reason: 'REACTION_GIVEN',
            points: { gt: 0 },
            createdAt: { gte: start, lt: end },
        },
    });
    if (givenToday >= DAILY_REACTIONS_GIVEN_CAP) {
        await writeAuditRow(user.id, givenEntry, { dailyCapped: true });
        return;
    }

    await applyPoints(user.id, givenEntry, opts);

    // Received side: target author must be a different, active BIES user.
    const targetUser = await prisma.user.findUnique({
        where: { nostrPubkey: targetPubkey },
        select: { id: true, isBanned: true, deletedAt: true },
    });
    if (!targetUser || targetUser.isBanned || targetUser.deletedAt) return;
    if (targetUser.id === user.id) return;

    await applyPoints(
        targetUser.id,
        {
            nostrEventId: event.id,
            kind: event.kind,
            reason: 'REACTION_RECEIVED',
            points: classification.received,
            month,
            targetEventId,
            eventCreatedAt: eventDate,
        },
        opts
    );
}

/**
 * Sum of points already awarded on the event's UTC day. Bounty rows live on
 * the separate spendable rail (mirroring recomputeUserScore): an escrow debit
 * must not raise the cap headroom, an award credit must not consume it.
 */
async function dailyPointsUsed(userId: string, eventDate: Date): Promise<number> {
    const { start, end } = utcDayRange(eventDate);
    const result = await prisma.pointEvent.aggregate({
        where: {
            userId,
            reason: { notIn: [...BOUNTY_REASONS] },
            createdAt: { gte: start, lt: end },
        },
        _sum: { points: true },
    });
    return result._sum.points || 0;
}

/**
 * Write a 0-point audit row (rate-limited / daily-capped events). Does not
 * touch UserScore. Idempotent via the unique constraint.
 */
async function writeAuditRow(
    userId: string,
    entry: PointEntry,
    meta: Record<string, unknown>
): Promise<void> {
    try {
        await prisma.pointEvent.create({
            data: {
                userId,
                nostrEventId: entry.nostrEventId,
                kind: entry.kind,
                reason: entry.reason,
                points: 0,
                month: entry.month,
                targetEventId: entry.targetEventId ?? null,
                meta: JSON.stringify(meta),
                createdAt: entry.eventCreatedAt,
            },
        });
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
    }
}

// ─── Apply points ────────────────────────────────────────────────────────────

/**
 * Atomically record a ledger entry and roll it into UserScore, then handle
 * level-up notification/broadcast and badge checks.
 */
export async function applyPoints(
    userId: string,
    entry: PointEntry,
    opts: ScoreOpts = {}
): Promise<void> {
    const eventDay = dayOf(entry.eventCreatedAt);
    const isScoredNote =
        entry.points > 0 && (entry.reason === 'POST' || entry.reason === 'REPLY');

    let levelBefore = 0;
    let levelAfter = 0;

    try {
        await prisma.$transaction(async (tx) => {
            await tx.pointEvent.create({
                data: {
                    userId,
                    nostrEventId: entry.nostrEventId,
                    kind: entry.kind,
                    reason: entry.reason,
                    points: entry.points,
                    month: entry.month,
                    targetEventId: entry.targetEventId ?? null,
                    meta: JSON.stringify(entry.meta ?? {}),
                    createdAt: entry.eventCreatedAt,
                },
            });

            const score = await tx.userScore.findUnique({ where: { userId } });

            const prevLifetime = score?.lifetimePoints ?? 0;
            // Monthly bucket resets lazily when the entry's month moves on.
            const prevMonthly =
                score && score.currentMonth === entry.month ? score.monthlyPoints : 0;

            // Streak: consecutive UTC day → +1, same day → unchanged, gap → 1.
            let streakDays = score?.streakDays ?? 0;
            if (entry.points > 0) {
                if (!score?.lastActiveDay) {
                    streakDays = 1;
                } else if (score.lastActiveDay === eventDay) {
                    streakDays = score.streakDays;
                } else if (isNextUtcDay(score.lastActiveDay, eventDay)) {
                    streakDays = score.streakDays + 1;
                } else {
                    streakDays = 1;
                }
            }

            levelBefore = levelFor(prevLifetime);
            levelAfter = levelFor(prevLifetime + entry.points);

            const counterIncrement = {
                postCount: entry.reason === 'POST' && entry.points > 0 ? 1 : 0,
                replyCount: entry.reason === 'REPLY' && entry.points > 0 ? 1 : 0,
                reactionsGiven: entry.reason === 'REACTION_GIVEN' && entry.points > 0 ? 1 : 0,
                reactionsReceived:
                    entry.reason === 'REACTION_RECEIVED' && entry.points > 0 ? 1 : 0,
            };

            await tx.userScore.upsert({
                where: { userId },
                create: {
                    userId,
                    monthlyPoints: entry.points,
                    lifetimePoints: entry.points,
                    level: levelAfter,
                    currentMonth: entry.month,
                    lastScoredNoteAt: isScoredNote ? entry.eventCreatedAt : null,
                    streakDays,
                    lastActiveDay: entry.points > 0 ? eventDay : null,
                    postCount: counterIncrement.postCount,
                    replyCount: counterIncrement.replyCount,
                    reactionsGiven: counterIncrement.reactionsGiven,
                    reactionsReceived: counterIncrement.reactionsReceived,
                },
                update: {
                    monthlyPoints: prevMonthly + entry.points,
                    lifetimePoints: prevLifetime + entry.points,
                    level: levelAfter,
                    currentMonth: entry.month,
                    ...(isScoredNote ? { lastScoredNoteAt: entry.eventCreatedAt } : {}),
                    streakDays,
                    ...(entry.points > 0 ? { lastActiveDay: eventDay } : {}),
                    postCount: { increment: counterIncrement.postCount },
                    replyCount: { increment: counterIncrement.replyCount },
                    reactionsGiven: { increment: counterIncrement.reactionsGiven },
                    reactionsReceived: { increment: counterIncrement.reactionsReceived },
                },
            });
        });
    } catch (error) {
        if (isUniqueViolation(error)) return; // already scored — dedup replay
        throw error;
    }

    // Ranked totals just changed — evict the cached leaderboards so live
    // scoring surfaces immediately instead of after the 60s TTL (previously
    // only admin adjust/recompute invalidated). Skipped on the dedup-replay
    // early return above: a no-op apply leaves the cache untouched.
    if (entry.points !== 0) {
        await invalidateLeaderboardCache();
    }

    if (levelAfter > levelBefore && !opts.silent) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { nostrPubkey: true, profile: { select: { name: true } } },
            });
            if (user) {
                await notifyLevelUp(userId, levelAfter);
                broadcast({
                    type: 'gamification',
                    event: 'level_up',
                    pubkey: user.nostrPubkey,
                    name: user.profile?.name || undefined,
                    level: levelAfter,
                    titleKey: titleKeyFor(levelAfter),
                });
            }
        } catch (error) {
            console.error('[Points] Level-up notify failed:', error);
        }
    }

    await checkBadges(userId, opts);
}

// ─── Bounty transfers (spendable rail) ───────────────────────────────────────

export const BOUNTY_REASONS = ['BOUNTY_ESCROW', 'BOUNTY_AWARD', 'BOUNTY_REFUND'] as const;

export type BountyReason = (typeof BOUNTY_REASONS)[number];

/** Thrown when a debit would push lifetimePoints + bountyPoints below zero. */
export class InsufficientBountyBalanceError extends Error {
    constructor() {
        super('Insufficient spendable points balance');
        this.name = 'InsufficientBountyBalanceError';
    }
}

/**
 * Move bounty points inside the CALLER'S transaction (unlike applyPoints,
 * which owns its own). The ledger row is written first so a replay hits the
 * (nostrEventId, userId, reason) unique and returns {applied: false} without
 * double-applying the score. Bounty flows never touch monthlyPoints /
 * lifetimePoints / level / streaks — only UserScore.bountyPoints. A debit
 * that overdraws the spendable balance (lifetimePoints + bountyPoints)
 * throws InsufficientBountyBalanceError so the caller's tx rolls back.
 *
 * NOTE: the {applied:false} branch is last-resort armor, not the primary
 * replay guard — on PostgreSQL (the documented prod DB) a failed INSERT
 * poisons the surrounding interactive tx (25P02), unlike SQLite. Callers
 * must keep gating the transfer behind a status-preconditioned updateMany
 * in the same tx (all current callers do); that gate is what actually
 * makes replays clean no-ops.
 */
export async function applyBountyTransfer(
    tx: Prisma.TransactionClient,
    {
        userId,
        delta,
        reason,
        bountyId,
    }: { userId: string; delta: number; reason: BountyReason; bountyId: string }
): Promise<{ applied: boolean }> {
    const month = monthOf(new Date());

    try {
        await tx.pointEvent.create({
            data: {
                userId,
                nostrEventId: `bounty:${bountyId}`,
                kind: null,
                reason,
                points: delta,
                month,
                meta: '{}',
            },
        });
    } catch (error) {
        if (isUniqueViolation(error)) return { applied: false }; // already applied — replay
        throw error;
    }

    await tx.userScore.upsert({
        where: { userId },
        create: { userId, bountyPoints: delta, currentMonth: month },
        update: { bountyPoints: { increment: delta } },
    });

    if (delta < 0) {
        const score = await tx.userScore.findUnique({
            where: { userId },
            select: { lifetimePoints: true, bountyPoints: true },
        });
        if (!score || score.lifetimePoints + score.bountyPoints < 0) {
            throw new InsufficientBountyBalanceError();
        }
    }

    return { applied: true };
}

// ─── Badges ──────────────────────────────────────────────────────────────────

/**
 * Award any newly earned (non-monthly) badges. Idempotent — the
 * (userId, badgeId, month) unique constraint absorbs repeats.
 */
export async function checkBadges(userId: string, opts: ScoreOpts = {}): Promise<void> {
    const score = await prisma.userScore.findUnique({ where: { userId } });
    if (!score) return;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true },
    });
    if (!user) return;

    for (const badge of BADGES) {
        if (badge.monthly) continue;
        if (!badge.check(score, user)) continue;

        try {
            const userBadge = await prisma.userBadge.create({
                data: { userId, badgeId: badge.id, month: '' },
            });
            if (!opts.silent) {
                await notifyBadgeEarned(userId, badge.id);
                // NIP-58 kind-8 award — no-op when BIES_ISSUER_PRIVKEY is
                // unset; a null nostrAwardEventId is retried by the pending
                // sweep (badges.publisher.ts). During backfill (silent) the
                // publish is suppressed and bulk-published afterwards.
                await publishBadgeAward(userBadge);
            }
        } catch (error) {
            if (!isUniqueViolation(error)) throw error; // already awarded
        }
    }
}

// ─── Recompute (ledger is authoritative) ─────────────────────────────────────

/**
 * Rebuild UserScore counters, points and level from the PointEvent ledger.
 * Streak fields (streakDays, lastActiveDay) are preserved, not re-derived.
 */
export async function recomputeUserScore(userId: string): Promise<void> {
    const currentMonth = monthOf(new Date());

    // Bounty rows live on a separate spendable rail: excluded from lifetime /
    // monthly (they never feed levels or leaderboards), summed into bountyPoints.
    const [lifetime, monthly, bounty, byReason, lastScoredNote, existing] = await Promise.all([
        prisma.pointEvent.aggregate({
            where: { userId, reason: { notIn: [...BOUNTY_REASONS] } },
            _sum: { points: true },
        }),
        prisma.pointEvent.aggregate({
            where: { userId, month: currentMonth, reason: { notIn: [...BOUNTY_REASONS] } },
            _sum: { points: true },
        }),
        prisma.pointEvent.aggregate({
            where: { userId, reason: { in: [...BOUNTY_REASONS] } },
            _sum: { points: true },
        }),
        prisma.pointEvent.groupBy({
            by: ['reason'],
            where: { userId, points: { gt: 0 } },
            _count: { _all: true },
        }),
        prisma.pointEvent.findFirst({
            where: { userId, points: { gt: 0 }, reason: { in: ['POST', 'REPLY'] } },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
        prisma.userScore.findUnique({
            where: { userId },
            select: { streakDays: true, lastActiveDay: true },
        }),
    ]);

    const counts: Record<string, number> = {};
    for (const row of byReason) {
        counts[row.reason] = row._count._all;
    }

    const lifetimePoints = lifetime._sum.points || 0;
    const monthlyPoints = monthly._sum.points || 0;
    const bountyPoints = bounty._sum.points || 0;

    const data = {
        monthlyPoints,
        lifetimePoints,
        bountyPoints,
        level: levelFor(lifetimePoints),
        currentMonth,
        lastScoredNoteAt: lastScoredNote?.createdAt ?? null,
        postCount: counts.POST || 0,
        replyCount: counts.REPLY || 0,
        reactionsGiven: counts.REACTION_GIVEN || 0,
        reactionsReceived: counts.REACTION_RECEIVED || 0,
    };

    await prisma.userScore.upsert({
        where: { userId },
        create: {
            userId,
            ...data,
            streakDays: existing?.streakDays ?? 0,
            lastActiveDay: existing?.lastActiveDay ?? null,
        },
        // Streak fields intentionally omitted from update — preserved as-is.
        update: data,
    });
}

/** Recompute every user that has ledger rows or an existing score. */
export async function recomputeAllScores(): Promise<void> {
    const [ledgerUsers, scoreUsers] = await Promise.all([
        prisma.pointEvent.findMany({
            distinct: ['userId'],
            select: { userId: true },
        }),
        prisma.userScore.findMany({ select: { userId: true } }),
    ]);

    const userIds = new Set<string>([
        ...ledgerUsers.map((r) => r.userId),
        ...scoreUsers.map((r) => r.userId),
    ]);

    for (const userId of userIds) {
        await recomputeUserScore(userId);
    }

    console.log(`[Points] Recomputed scores for ${userIds.size} users`);
}
