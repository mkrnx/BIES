/**
 * Points indexer & jobs — relay wiring for the points scoring core.
 *
 * Subscribes to kinds 1/7 on the private relay (`config.nostrPrivateRelay`)
 * and feeds every event into `processEvent` (points.service.ts). On an empty
 * ledger it first backfills the relay's full history (silent — no
 * notifications/broadcasts), then recomputes scores and sweeps badges.
 * Restarts resume from the last ledger row minus a one-hour overlap; the
 * (nostrEventId, userId, reason) unique constraint absorbs the replays.
 *
 * Also owns the monthly rollover job: snapshot the previous month's
 * leaderboard, award monthly badges, announce winners and zero the monthly
 * buckets. Idempotent — the (month, userId) snapshot unique constraint is the
 * concurrency guard.
 */

// nostr-tools is ESM-only (@noble/curves has no CJS build);
// use dynamic import() so the compiled CJS output doesn't call require().
import type { Filter } from 'nostr-tools/filter';
import type { Event } from 'nostr-tools/pure';
import { config } from '../config';
import prisma from '../lib/prisma';
import {
    processEvent,
    checkBadges,
    recomputeAllScores,
    monthOf,
    isUniqueViolation,
} from './points.service';
import { notifyBadgeEarned } from './notification.service';
import { broadcast } from './websocket.service';
import { publishBadgeAward, publishPendingAwards } from './badges.publisher';

let _pool: InstanceType<Awaited<typeof import('nostr-tools/pool')>['SimplePool']> | null = null;
async function getPool() {
    if (!_pool) {
        const { SimplePool } = await import('nostr-tools/pool');
        _pool = new SimplePool();
    }
    return _pool;
}

const SCORED_KINDS = [1, 7];
const BACKFILL_PAGE_SIZE = 500;
const BACKFILL_PAGE_MAX_WAIT_MS = 15_000;
const RESUME_OVERLAP_SECONDS = 3600; // replay the last hour on restart
const CONNECT_TIMEOUT_MS = 10_000;
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const MAINTENANCE_BOOT_DELAY_MS = 15_000;

// ─── Scorer (backfill-or-resume + live subscription) ─────────────────────────

let activeSub: { close: (reason?: string) => void } | null = null;
let subGeneration = 0; // invalidates stale onclose callbacks
let connecting = false;
let retryAttempt = 0;

/**
 * Start the points scorer. Called once on server startup. Never throws —
 * an unreachable relay is logged and retried with capped exponential backoff.
 */
export async function startPointsScorer(): Promise<void> {
    if (!config.nostrPrivateRelay) {
        console.warn('[Points] NOSTR_PRIVATE_RELAY not set — points scorer disabled');
        return;
    }
    await connectAndStart();
}

async function connectAndStart(): Promise<void> {
    if (connecting) return;
    connecting = true;
    try {
        // Supersede any previous subscription before reconnecting.
        subGeneration += 1;
        if (activeSub) {
            activeSub.close();
            activeSub = null;
        }

        const pool = await getPool();
        // Probe the relay first: an unreachable relay must retry with backoff
        // instead of silently yielding an empty backfill.
        await pool.ensureRelay(config.nostrPrivateRelay, {
            connectionTimeout: CONNECT_TIMEOUT_MS,
        });

        const ledgerCount = await prisma.pointEvent.count();
        if (ledgerCount === 0) {
            await backfill(pool);
        }

        await subscribeLive(pool, subGeneration);
        retryAttempt = 0;
    } catch (error) {
        scheduleRetry(error);
    } finally {
        connecting = false;
    }
}

function scheduleRetry(error: unknown): void {
    retryAttempt += 1;
    const delay = Math.min(RETRY_BASE_MS * 2 ** (retryAttempt - 1), RETRY_MAX_MS);
    console.error(
        `[Points] Scorer connect failed (attempt ${retryAttempt}), retrying in ${Math.round(delay / 1000)}s:`,
        error instanceof Error ? error.message : error
    );
    setTimeout(() => {
        connectAndStart().catch((err) => console.error('[Points] Retry failed:', err));
    }, delay);
}

/**
 * Full backfill: page backwards through the relay's kind-1/7 history, then
 * process everything in ascending event-time order with notifications
 * suppressed, and finally recompute scores + sweep badges.
 */
async function backfill(pool: Awaited<ReturnType<typeof getPool>>): Promise<void> {
    console.log('[Points] Empty ledger — starting full backfill from relay');
    const relays = [config.nostrPrivateRelay];
    const byId = new Map<string, Event>();
    let until = Math.floor(Date.now() / 1000) + 60;

    for (;;) {
        const filter: Filter = { kinds: SCORED_KINDS, until, limit: BACKFILL_PAGE_SIZE };
        const page = await pool.querySync(relays, filter, {
            maxWait: BACKFILL_PAGE_MAX_WAIT_MS,
        });

        let added = 0;
        let oldest = until;
        for (const event of page) {
            if (!byId.has(event.id)) {
                byId.set(event.id, event);
                added += 1;
            }
            if (event.created_at < oldest) oldest = event.created_at;
        }

        if (page.length < BACKFILL_PAGE_SIZE) break; // relay exhausted below `until`
        if (added === 0) break; // page returned no new events — stop
        if (oldest >= until) break; // `until` stopped decreasing — stop
        until = oldest;
    }

    const events = Array.from(byId.values()).sort(
        (a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)
    );

    for (const event of events) {
        try {
            await processEvent(event, { silent: true });
        } catch (error) {
            console.error(`[Points] Backfill: failed to process ${event.id}:`, error);
        }
    }

    await recomputeAllScores();

    const scores = await prisma.userScore.findMany({ select: { userId: true } });
    for (const { userId } of scores) {
        await checkBadges(userId, { silent: true });
    }

    const ledgerRows = await prisma.pointEvent.count();
    console.log(
        `[Points] Backfill complete — ${events.length} relay events processed, ` +
            `${ledgerRows} ledger rows, ${scores.length} users scored`
    );

    // Backfill awards badges silently (no NIP-58 publishes mid-sweep) —
    // bulk-publish the pending awards now that the sweep is complete.
    await publishPendingAwards();
}

/** Open the live subscription, resuming from the ledger's last event time. */
async function subscribeLive(
    pool: Awaited<ReturnType<typeof getPool>>,
    generation: number
): Promise<void> {
    const last = await prisma.pointEvent.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
    });
    const resumeFrom = last
        ? Math.floor(last.createdAt.getTime() / 1000)
        : Math.floor(Date.now() / 1000);
    const since = resumeFrom - RESUME_OVERLAP_SECONDS;

    const filter: Filter = { kinds: SCORED_KINDS, since };
    activeSub = pool.subscribeMany([config.nostrPrivateRelay], filter, {
        onevent: (event: Event) => {
            processEvent(event).catch((err) =>
                console.error('[Points] Process error:', err)
            );
        },
        oneose: () => {
            console.log('[Points] Caught up with relay history');
        },
        onclose: (reasons: string[]) => {
            if (generation !== subGeneration) return; // superseded — ignore
            activeSub = null;
            console.warn(`[Points] Subscription closed (${reasons.join(', ')}) — reconnecting`);
            scheduleRetry(new Error('subscription closed'));
        },
    });
    console.log(`[Points] Live subscription open (kinds 1,7 since ${since})`);
}

// ─── Maintenance loop (monthly rollover) ─────────────────────────────────────

let maintenanceStarted = false;

/**
 * Start the maintenance loop: one run shortly after boot, then every 15
 * minutes (twitter.service.ts pattern). Each tick runs the monthly rollover,
 * which is a cheap no-op outside the month boundary.
 */
export function startPointsMaintenanceLoop(): void {
    if (maintenanceStarted) return;
    maintenanceStarted = true;

    const tick = () => {
        runMonthlyRollover().catch((error) =>
            console.error('[Points] Monthly rollover failed:', error)
        );
        // Retry NIP-58 awards whose publish was skipped or failed
        // (nostrAwardEventId still null). No-op when the issuer is disabled.
        publishPendingAwards().catch((error) =>
            console.error('[Badges] Pending award sweep failed:', error)
        );
    };

    setTimeout(tick, MAINTENANCE_BOOT_DELAY_MS);
    setInterval(tick, MAINTENANCE_INTERVAL_MS);
    console.log(
        `[Points] Maintenance loop scheduled every ${MAINTENANCE_INTERVAL_MS / 60000} min`
    );
}

/** 'YYYY-MM' immediately before the given 'YYYY-MM'. */
function monthBefore(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}

/**
 * Close out the previous month: snapshot the ranked leaderboard, award the
 * monthly badges (top 3 + Corona del Volcán for #1), notify and broadcast the
 * winners, then reset every stale UserScore to the current month.
 *
 * Idempotent and safe to run concurrently: if the previous month has no
 * stale scores or already has a snapshot, only the lazy month sync runs;
 * unique constraints absorb duplicate snapshot/badge writes.
 */
export async function runMonthlyRollover(): Promise<void> {
    const currentMonth = monthOf(new Date());
    const prevMonth = monthBefore(currentMonth);

    const [staleCount, existingSnapshot] = await Promise.all([
        prisma.userScore.count({ where: { currentMonth: prevMonth } }),
        prisma.leaderboardSnapshot.findFirst({
            where: { month: prevMonth },
            select: { id: true },
        }),
    ]);

    if (staleCount === 0 || existingSnapshot) {
        await lazyMonthSync(currentMonth);
        return;
    }

    console.log(`[Points] Monthly rollover: closing ${prevMonth}`);

    const ranked = await prisma.userScore.findMany({
        where: { currentMonth: prevMonth, monthlyPoints: { gt: 0 } },
        orderBy: [{ monthlyPoints: 'desc' }, { userId: 'asc' }],
        select: {
            userId: true,
            monthlyPoints: true,
            user: {
                select: {
                    nostrPubkey: true,
                    profile: { select: { name: true } },
                },
            },
        },
    });

    // Snapshot — the (month, userId) unique constraint is the concurrency guard.
    let snapshots = 0;
    for (let i = 0; i < ranked.length; i++) {
        try {
            await prisma.leaderboardSnapshot.create({
                data: {
                    month: prevMonth,
                    userId: ranked[i].userId,
                    rank: i + 1,
                    points: ranked[i].monthlyPoints,
                },
            });
            snapshots += 1;
        } catch (error) {
            if (!isUniqueViolation(error)) throw error; // already snapshotted
        }
    }

    // Monthly badges: ranks 1–3 → monthly-top3; rank 1 → monthly-first.
    const top3 = ranked.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
        await awardMonthlyBadge(top3[i].userId, 'monthly-top3', prevMonth);
        if (i === 0) {
            await awardMonthlyBadge(top3[i].userId, 'monthly-first', prevMonth);
        }
    }

    if (top3.length > 0) {
        broadcast({
            type: 'gamification',
            event: 'monthly_winners',
            month: prevMonth,
            winners: top3.map((row, i) => ({
                pubkey: row.user.nostrPubkey,
                name: row.user.profile?.name || undefined,
                points: row.monthlyPoints,
                rank: i + 1,
            })),
        });
    }

    await lazyMonthSync(currentMonth);
    console.log(
        `[Points] Rollover complete for ${prevMonth}: ${snapshots} snapshot rows, ` +
            `top ${top3.length} awarded`
    );
}

/**
 * Reset every UserScore still pointing at an old month. Rows already in the
 * current month are left untouched so points earned after the boundary (via
 * the scorer's lazy per-entry month reset) are preserved.
 */
async function lazyMonthSync(currentMonth: string): Promise<void> {
    const result = await prisma.userScore.updateMany({
        where: { currentMonth: { not: currentMonth } },
        data: { monthlyPoints: 0, currentMonth },
    });
    if (result.count > 0) {
        console.log(`[Points] Month sync: reset ${result.count} user scores to ${currentMonth}`);
    }
}

/** Award a monthly badge (P2002-safe) and notify only on first award. */
async function awardMonthlyBadge(
    userId: string,
    badgeId: string,
    month: string
): Promise<void> {
    try {
        const userBadge = await prisma.userBadge.create({ data: { userId, badgeId, month } });
        await notifyBadgeEarned(userId, badgeId);
        // NIP-58 kind-8 award — no-op when the issuer is disabled; retried by
        // the pending sweep if the publish fails.
        await publishBadgeAward(userBadge);
    } catch (error) {
        if (!isUniqueViolation(error)) throw error; // already awarded — re-run stays quiet
    }
}
