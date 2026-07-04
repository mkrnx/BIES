/**
 * Points controller — gamification read API (§B5).
 *
 * All endpoints are mounted under /api/points behind `authenticate`.
 * UserScore.monthlyPoints is a lazily-reset bucket: rows whose currentMonth
 * is stale are normalized on read (presented as 0 / excluded from the
 * monthly leaderboard) — the ledger and rollover job own the actual reset.
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache, cacheKey, TTL } from '../services/redis.service';
import { monthOf, titleKeyFor, nextLevelAt } from '../services/points.service';
import { BADGES } from '../services/badges.catalog';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const LEADERBOARD_MAX = 100;
const RECENT_EVENTS_LIMIT = 20;

const badgeCatalogById = new Map(BADGES.map((b) => [b.id, b]));

// ─── Shapes ──────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
    rank: number;
    userId: string;
    pubkey: string;
    name: string;
    avatar: string;
    level: number;
    titleKey: string;
    points: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mergeBadge(row: {
    badgeId: string;
    month: string;
    awardedAt: Date;
    nostrAwardEventId: string | null;
}) {
    const def = badgeCatalogById.get(row.badgeId);
    return {
        badgeId: row.badgeId,
        month: row.month,
        awardedAt: row.awardedAt,
        nostrAwardEventId: row.nostrAwardEventId,
        rarity: def?.rarity ?? null,
        icon: def?.icon ?? null,
        monthly: def?.monthly ?? false,
    };
}

/**
 * Flatten a UserScore row (or null) into the API score shape, normalizing a
 * stale month on read: if the stored bucket belongs to a previous month the
 * caller sees monthlyPoints 0 for the current month.
 */
function presentScore(
    score: {
        monthlyPoints: number;
        lifetimePoints: number;
        level: number;
        currentMonth: string;
        streakDays: number;
        postCount: number;
        replyCount: number;
        reactionsGiven: number;
        reactionsReceived: number;
    } | null,
    currentMonth: string
) {
    const monthlyPoints =
        score && score.currentMonth === currentMonth ? score.monthlyPoints : 0;
    const level = score?.level ?? 0;
    return {
        monthlyPoints,
        lifetimePoints: score?.lifetimePoints ?? 0,
        level,
        titleKey: titleKeyFor(level),
        nextLevelAt: nextLevelAt(level),
        currentMonth,
        streakDays: score?.streakDays ?? 0,
        postCount: score?.postCount ?? 0,
        replyCount: score?.replyCount ?? 0,
        reactionsGiven: score?.reactionsGiven ?? 0,
        reactionsReceived: score?.reactionsReceived ?? 0,
    };
}

/** Ranked top-N for a scope. Cached (60s) independently of the caller. */
async function loadLeaderboard(
    scope: 'monthly' | 'lifetime',
    currentMonth: string
): Promise<LeaderboardEntry[]> {
    const cKey = cacheKey.leaderboard(scope);
    const cached = await cache.getJson<LeaderboardEntry[]>(cKey);
    if (cached) return cached;

    const where =
        scope === 'monthly'
            ? { currentMonth, monthlyPoints: { gt: 0 } } // stale rows are last month's bucket → excluded
            : { lifetimePoints: { gt: 0 } };
    const orderField = scope === 'monthly' ? 'monthlyPoints' : 'lifetimePoints';

    const rows = await prisma.userScore.findMany({
        where,
        orderBy: [{ [orderField]: 'desc' }, { updatedAt: 'asc' }],
        take: LEADERBOARD_MAX,
        include: {
            user: {
                select: {
                    nostrPubkey: true,
                    profile: { select: { name: true, avatar: true } },
                },
            },
        },
    });

    const entries: LeaderboardEntry[] = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId,
        pubkey: row.user.nostrPubkey,
        name: row.user.profile?.name || '',
        avatar: row.user.profile?.avatar || '',
        level: row.level,
        titleKey: titleKeyFor(row.level),
        points: scope === 'monthly' ? row.monthlyPoints : row.lifetimePoints,
    }));

    await cache.setJson(cKey, entries, TTL.LEADERBOARD);
    return entries;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /points/leaderboard?scope=monthly|lifetime&limit=50
 * Ranked list (cached 60s) plus the caller's own rank/points (computed per
 * request, never cached — it may fall outside the returned top N).
 */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
        const scope = req.query.scope === 'lifetime' ? 'lifetime' : 'monthly';
        const limit = Math.min(
            Math.max(parseInt(req.query.limit as string, 10) || 50, 1),
            LEADERBOARD_MAX
        );
        const currentMonth = monthOf(new Date());

        const entries = await loadLeaderboard(scope, currentMonth);

        // Caller's own standing (stale monthly bucket normalized to 0).
        const myScore = await prisma.userScore.findUnique({
            where: { userId: req.user!.id },
        });
        const myPoints =
            scope === 'monthly'
                ? myScore && myScore.currentMonth === currentMonth
                    ? myScore.monthlyPoints
                    : 0
                : myScore?.lifetimePoints ?? 0;

        let myRank: number | null = null;
        if (myPoints > 0) {
            const ahead = await prisma.userScore.count({
                where:
                    scope === 'monthly'
                        ? { currentMonth, monthlyPoints: { gt: myPoints } }
                        : { lifetimePoints: { gt: myPoints } },
            });
            myRank = ahead + 1;
        }

        const myLevel = myScore?.level ?? 0;
        res.json({
            scope,
            month: currentMonth,
            entries: entries.slice(0, limit),
            me: {
                userId: req.user!.id,
                pubkey: req.user!.nostrPubkey,
                rank: myRank,
                points: myPoints,
                level: myLevel,
                titleKey: titleKeyFor(myLevel),
            },
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
}

/**
 * GET /points/me
 * The caller's full score: normalized points, level/title progression,
 * badges (catalog-merged) and the last 20 ledger entries.
 */
export async function getMyPoints(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const currentMonth = monthOf(new Date());

        const [score, badges, recentEvents] = await Promise.all([
            prisma.userScore.findUnique({ where: { userId } }),
            prisma.userBadge.findMany({
                where: { userId },
                orderBy: { awardedAt: 'desc' },
                select: { badgeId: true, month: true, awardedAt: true, nostrAwardEventId: true },
            }),
            prisma.pointEvent.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: RECENT_EVENTS_LIMIT,
                select: { id: true, reason: true, points: true, month: true, createdAt: true },
            }),
        ]);

        res.json({
            userId,
            pubkey: req.user!.nostrPubkey,
            ...presentScore(score, currentMonth),
            badges: badges.map(mergeBadge),
            recentEvents,
        });
    } catch (error) {
        console.error('Get my points error:', error);
        res.status(500).json({ error: 'Failed to get points' });
    }
}

/**
 * GET /points/user/:pubkey
 * Another member's score + badges (no ledger entries). 404 for unknown pubkey.
 */
export async function getUserPoints(req: Request, res: Response): Promise<void> {
    try {
        const { pubkey } = req.params;
        const currentMonth = monthOf(new Date());

        const user = await prisma.user.findUnique({
            where: { nostrPubkey: pubkey },
            select: {
                id: true,
                nostrPubkey: true,
                profile: { select: { name: true, avatar: true } },
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const [score, badges] = await Promise.all([
            prisma.userScore.findUnique({ where: { userId: user.id } }),
            prisma.userBadge.findMany({
                where: { userId: user.id },
                orderBy: { awardedAt: 'desc' },
                select: { badgeId: true, month: true, awardedAt: true, nostrAwardEventId: true },
            }),
        ]);

        res.json({
            userId: user.id,
            pubkey: user.nostrPubkey,
            name: user.profile?.name || '',
            avatar: user.profile?.avatar || '',
            ...presentScore(score, currentMonth),
            badges: badges.map(mergeBadge),
        });
    } catch (error) {
        console.error('Get user points error:', error);
        res.status(500).json({ error: 'Failed to get user points' });
    }
}

/**
 * GET /points/badges
 * The code-defined badge catalog. Names/descriptions resolve client-side
 * via the i18n `points.badges.*` namespace.
 */
export async function getBadgeCatalog(_req: Request, res: Response): Promise<void> {
    res.json({
        badges: BADGES.map((b) => ({
            id: b.id,
            rarity: b.rarity,
            icon: b.icon,
            monthly: b.monthly ?? false,
        })),
    });
}

/**
 * GET /points/months/:month  (month = 'YYYY-MM')
 * Frozen leaderboard snapshot written by the monthly rollover. Empty entries
 * when no snapshot exists for that month.
 */
export async function getMonthSnapshot(req: Request, res: Response): Promise<void> {
    try {
        const { month } = req.params;
        if (!MONTH_RE.test(month)) {
            res.status(400).json({ error: 'Invalid month — expected YYYY-MM' });
            return;
        }

        const rows = await prisma.leaderboardSnapshot.findMany({
            where: { month },
            orderBy: { rank: 'asc' },
            include: {
                user: {
                    select: {
                        nostrPubkey: true,
                        profile: { select: { name: true, avatar: true } },
                    },
                },
            },
        });

        res.json({
            month,
            entries: rows.map((row) => ({
                rank: row.rank,
                userId: row.userId,
                pubkey: row.user.nostrPubkey,
                name: row.user.profile?.name || '',
                avatar: row.user.profile?.avatar || '',
                points: row.points,
            })),
        });
    } catch (error) {
        console.error('Get month snapshot error:', error);
        res.status(500).json({ error: 'Failed to get month snapshot' });
    }
}
