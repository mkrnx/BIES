/**
 * Leaderboard rollover & cache regression tests — run against a REAL scratch
 * SQLite database (created in a temp dir, schema via `prisma db push`) so the
 * unique-constraint claim, tie-break ordering and cache eviction are
 * exercised for real. WebSocket/notification/NIP-58 side effects are mocked.
 *
 * Covers the three defects found in the 2026-07-06 leaderboard analysis:
 *  1. Concurrent monthly rollovers must produce exactly ONE snapshot and ONE
 *     `monthly_winners` broadcast (atomic createMany claim).
 *  2. Snapshot ranking must use the SAME tie-break as the live leaderboard
 *     (points DESC, updatedAt ASC, userId ASC) so frozen ranks match live.
 *  3. Live scoring (applyPoints) must evict the leaderboard cache; a dedup
 *     replay must NOT touch it.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

vi.mock('../websocket.service', () => ({
    broadcast: vi.fn(),
}));
vi.mock('../notification.service', () => ({
    notifyLevelUp: vi.fn(async () => {}),
    notifyBadgeEarned: vi.fn(async () => {}),
}));
vi.mock('../badges.publisher', () => ({
    publishBadgeAward: vi.fn(async () => {}),
    publishPendingAwards: vi.fn(async () => {}),
}));

const SERVER_ROOT = path.resolve(__dirname, '../../..');
const scratchDir = mkdtempSync(path.join(tmpdir(), 'bies-leaderboard-test-'));
const dbFile = path.join(scratchDir, 'points.db');
// connection_limit=1 serializes queries on one connection: concurrent
// invocations still interleave at await points, but SQLite never sees two
// writers at once (deterministic — no busy timeouts).
process.env.DATABASE_URL = `file:${dbFile}?connection_limit=1`;

// Modules under test are imported dynamically AFTER DATABASE_URL is set so
// the PrismaClient singleton binds to the scratch DB.
let prisma: (typeof import('../../lib/prisma'))['default'];
let runMonthlyRollover: (typeof import('../points.indexer'))['runMonthlyRollover'];
let applyPoints: (typeof import('../points.service'))['applyPoints'];
let monthOf: (typeof import('../points.service'))['monthOf'];
let getLeaderboard: (typeof import('../../controllers/points.controller'))['getLeaderboard'];
let cache: (typeof import('../redis.service'))['cache'];
let cacheKey: (typeof import('../redis.service'))['cacheKey'];
let invalidateLeaderboardCache: (typeof import('../redis.service'))['invalidateLeaderboardCache'];
let broadcastMock: Mock;

/** 'YYYY-MM' immediately before the given 'YYYY-MM'. */
function monthBefore(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

async function seedUserWithScore(
    id: string,
    points: number,
    currentMonth: string
): Promise<void> {
    await prisma.user.create({ data: { id, nostrPubkey: `pk_${id}` } });
    await prisma.userScore.create({
        data: {
            userId: id,
            monthlyPoints: points,
            lifetimePoints: points,
            level: 1,
            currentMonth,
        },
    });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
    execSync('npx prisma db push --skip-generate', {
        cwd: SERVER_ROOT,
        env: { ...process.env, DATABASE_URL: `file:${dbFile}`, CHECKPOINT_DISABLE: '1' },
        stdio: 'pipe',
    });

    // Cast: TS (nodenext/CJS view) and vitest (ESM runtime) disagree on where
    // the default export of a CJS module lands under dynamic import.
    prisma = (
        (await import('../../lib/prisma.js')) as unknown as {
            default: (typeof import('../../lib/prisma'))['default'];
        }
    ).default;
    ({ runMonthlyRollover } = await import('../points.indexer.js'));
    ({ applyPoints, monthOf } = await import('../points.service.js'));
    ({ getLeaderboard } = await import('../../controllers/points.controller.js'));
    ({ cache, cacheKey, invalidateLeaderboardCache } = await import('../redis.service.js'));
    broadcastMock = (await import('../websocket.service.js')).broadcast as Mock;
}, 120_000);

afterAll(async () => {
    await prisma?.$disconnect();
    rmSync(scratchDir, { recursive: true, force: true });
});

beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.leaderboardSnapshot.deleteMany();
    await prisma.userBadge.deleteMany();
    await prisma.pointEvent.deleteMany();
    await prisma.userScore.deleteMany();
    await prisma.user.deleteMany();
    await invalidateLeaderboardCache();
});

afterEach(() => {
    vi.useRealTimers();
});

// ─── Defect 1: concurrent rollover ───────────────────────────────────────────

describe('runMonthlyRollover — concurrent invocations', () => {
    it('two concurrent rollovers produce exactly one snapshot set, one badge set and one broadcast', async () => {
        const currentMonth = monthOf(new Date());
        const prevMonth = monthBefore(currentMonth);

        await seedUserWithScore('u_r1', 40, prevMonth);
        await seedUserWithScore('u_r2', 30, prevMonth);
        await seedUserWithScore('u_r3', 20, prevMonth);
        await seedUserWithScore('u_r4', 10, prevMonth);

        // Prime the leaderboard cache so we can assert the rollover evicts it.
        await cache.setJson(cacheKey.leaderboard('monthly'), [{ sentinel: true }], 60);

        // Both invocations start before either writes: each runs synchronously
        // to its first await (the guard reads), so BOTH pass the
        // staleCount/existingSnapshot fast path and race on the atomic claim.
        const results = await Promise.allSettled([runMonthlyRollover(), runMonthlyRollover()]);
        expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);

        // Exactly one full snapshot, ranks 1..4 in points order.
        const snaps = await prisma.leaderboardSnapshot.findMany({
            where: { month: prevMonth },
            orderBy: { rank: 'asc' },
        });
        expect(snaps.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
        expect(snaps.map((s) => s.userId)).toEqual(['u_r1', 'u_r2', 'u_r3', 'u_r4']);

        // Badges awarded once, not per invocation.
        const top3 = await prisma.userBadge.findMany({ where: { badgeId: 'monthly-top3' } });
        const first = await prisma.userBadge.findMany({ where: { badgeId: 'monthly-first' } });
        expect(top3).toHaveLength(3);
        expect(first).toHaveLength(1);
        expect(first[0].userId).toBe('u_r1');

        // Exactly ONE monthly_winners broadcast (the claim winner's).
        const winnerCalls = broadcastMock.mock.calls.filter(
            (c) => (c[0] as { event?: string })?.event === 'monthly_winners'
        );
        expect(winnerCalls).toHaveLength(1);
        const payload = winnerCalls[0][0] as {
            month: string;
            winners: { rank: number; points: number }[];
        };
        expect(payload.month).toBe(prevMonth);
        expect(payload.winners.map((w) => w.rank)).toEqual([1, 2, 3]);
        expect(payload.winners.map((w) => w.points)).toEqual([40, 30, 20]);

        // Buckets reset and cache evicted.
        const scores = await prisma.userScore.findMany();
        for (const s of scores) {
            expect(s.currentMonth).toBe(currentMonth);
            expect(s.monthlyPoints).toBe(0);
        }
        expect(await cache.getJson(cacheKey.leaderboard('monthly'))).toBeNull();
    }, 30_000);

    it('a later re-run after a completed rollover stays quiet (no second broadcast)', async () => {
        const currentMonth = monthOf(new Date());
        const prevMonth = monthBefore(currentMonth);
        await seedUserWithScore('u_q1', 15, prevMonth);

        await runMonthlyRollover();
        broadcastMock.mockClear();

        await runMonthlyRollover(); // snapshot exists → fast path → sync only
        const winnerCalls = broadcastMock.mock.calls.filter(
            (c) => (c[0] as { event?: string })?.event === 'monthly_winners'
        );
        expect(winnerCalls).toHaveLength(0);
        expect(
            await prisma.leaderboardSnapshot.count({ where: { month: prevMonth } })
        ).toBe(1);
    }, 30_000);
});

// ─── Defect 2: tie-break parity between live and snapshot ranking ────────────

describe('tie-break parity — live leaderboard vs frozen snapshot', () => {
    it('tied users freeze in the SAME order the live monthly leaderboard showed', async () => {
        const liveMonth = monthOf(new Date());

        // Four users: one clear leader (80) and three tied at 50. Points are
        // applied through the real scoring path in the order big → c → a → b,
        // so updatedAt ASC = [c, a, b] while userId ASC = [a, b, c] — the two
        // orderings disagree, which is exactly what this test pins down.
        const order = ['u_tie_big', 'u_tie_c', 'u_tie_a', 'u_tie_b'] as const;
        const pointsFor: Record<(typeof order)[number], number> = {
            u_tie_big: 80,
            u_tie_c: 50,
            u_tie_a: 50,
            u_tie_b: 50,
        };
        for (const id of order) {
            await prisma.user.create({ data: { id, nostrPubkey: `pk_${id}` } });
        }
        for (const id of order) {
            await applyPoints(
                id,
                {
                    nostrEventId: `evt_${id}`,
                    kind: 1,
                    reason: 'POST',
                    points: pointsFor[id],
                    month: liveMonth,
                    eventCreatedAt: new Date(),
                },
                { silent: true }
            );
            await sleep(10); // distinct updatedAt stamps
        }

        // Live ranking as users saw it during the month.
        const req = {
            query: { scope: 'monthly', limit: '50' },
            user: { id: 'u_tie_a', nostrPubkey: 'pk_u_tie_a' },
        };
        const jsonMock = vi.fn();
        const res = { json: jsonMock, status: vi.fn().mockReturnThis() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await getLeaderboard(req as any, res as any);
        expect(jsonMock).toHaveBeenCalledTimes(1);
        const live = jsonMock.mock.calls[0][0] as {
            entries: { userId: string; rank: number }[];
        };
        const liveOrder = live.entries.map((e) => e.userId);
        expect(liveOrder).toEqual(['u_tie_big', 'u_tie_c', 'u_tie_a', 'u_tie_b']);

        // Cross the month boundary (Date only — DB/timers stay real).
        const now = new Date();
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(
            new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 30))
        );
        await runMonthlyRollover();
        vi.useRealTimers();

        const snaps = await prisma.leaderboardSnapshot.findMany({
            where: { month: liveMonth },
            orderBy: { rank: 'asc' },
        });
        const frozenOrder = snaps.map((s) => s.userId);

        // The frozen ranking must be exactly the live ranking — including the
        // three-way tie, which the old userId-ASC tie-break reordered.
        expect(frozenOrder).toEqual(liveOrder);
        for (const snap of snaps) {
            const liveEntry = live.entries.find((e) => e.userId === snap.userId);
            expect(liveEntry?.rank).toBe(snap.rank);
        }
    }, 30_000);
});

// ─── Defect 3: leaderboard cache eviction on live scoring ────────────────────

describe('leaderboard cache — live scoring invalidation', () => {
    it('applyPoints evicts both leaderboard scopes', async () => {
        const currentMonth = monthOf(new Date());
        await prisma.user.create({ data: { id: 'u_c1', nostrPubkey: 'pk_u_c1' } });

        const sentinel = [{ rank: 1, userId: 'stale-sentinel' }];
        await cache.setJson(cacheKey.leaderboard('monthly'), sentinel, 60);
        await cache.setJson(cacheKey.leaderboard('lifetime'), sentinel, 60);

        await applyPoints(
            'u_c1',
            {
                nostrEventId: 'evt_cache_1',
                kind: 1,
                reason: 'POST',
                points: 5,
                month: currentMonth,
                eventCreatedAt: new Date(),
            },
            { silent: true }
        );

        expect(await cache.getJson(cacheKey.leaderboard('monthly'))).toBeNull();
        expect(await cache.getJson(cacheKey.leaderboard('lifetime'))).toBeNull();
    }, 30_000);

    it('a dedup replay (same event) leaves the cache untouched', async () => {
        const currentMonth = monthOf(new Date());
        await prisma.user.create({ data: { id: 'u_c2', nostrPubkey: 'pk_u_c2' } });

        const entry = {
            nostrEventId: 'evt_cache_2',
            kind: 1,
            reason: 'POST' as const,
            points: 5,
            month: currentMonth,
            eventCreatedAt: new Date(),
        };
        await applyPoints('u_c2', entry, { silent: true });

        // Re-prime AFTER the first apply, then replay the identical event:
        // the unique-constraint dedup returns early and must not evict.
        const sentinel = [{ rank: 1, userId: 'fresh-sentinel' }];
        await cache.setJson(cacheKey.leaderboard('monthly'), sentinel, 60);
        await cache.setJson(cacheKey.leaderboard('lifetime'), sentinel, 60);

        await applyPoints('u_c2', entry, { silent: true });

        expect(await cache.getJson(cacheKey.leaderboard('monthly'))).toEqual(sentinel);
        expect(await cache.getJson(cacheKey.leaderboard('lifetime'))).toEqual(sentinel);
    }, 30_000);
});
