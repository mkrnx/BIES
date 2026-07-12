/**
 * NIP-58 badge publishing — mirrors in-app badge awards to Nostr so they are
 * visible in Amethyst/Primal/etc.
 *
 * - Kind 30009 (replaceable) badge *definitions* are published on boot, one
 *   per catalog entry — republishing is harmless (same d-tag replaces).
 * - Kind 8 *awards* are published when a UserBadge row is inserted; the award
 *   event id is stored in `UserBadge.nostrAwardEventId`.
 * - Kind 30008 *Profile Badges* are auto-maintained for custodial users via
 *   the existing server-signing path, so their badges show up in other
 *   clients without a manual "accept" step. Nostr-native users accept
 *   badges client-side as usual.
 *
 * Everything here is best-effort and silently disabled when
 * `BIES_ISSUER_PRIVKEY` is unset (issuer.service.ts logs one warning).
 * Awards left with a null `nostrAwardEventId` (publish failure, backfill
 * suppression, disabled issuer) are retried by `publishPendingAwards`,
 * which runs after backfill and on every maintenance-loop tick.
 */

import prisma from '../lib/prisma';
import { config } from '../config';
import { BADGES } from './badges.catalog';
import { publishEvent } from './nostr.service';
import { getIssuerKeys, publishAsIssuer, ensureIssuerWhitelisted } from './issuer.service';
import { isEnabled } from './featureFlags.service';

function nowSeconds(): number {
    return Math.floor(Date.now() / 1000);
}

function badgeImageUrl(badgeId: string): string {
    return `${config.appPublicUrl}/badges/${badgeId}.png`;
}

function badgeDefRef(issuerPubkey: string, badgeId: string): string {
    return `30009:${issuerPubkey}:${badgeId}`;
}

// ─── Definitions (kind 30009, replaceable) ───────────────────────────────────

/**
 * Publish one kind-30009 badge definition per catalog entry. Idempotent —
 * replaceable events keyed by ['d', badgeId]. Called on server boot; no-op
 * when the issuer is disabled.
 */
export async function publishBadgeDefinitions(): Promise<void> {
    // Gamification badge definitions belong to the `points` feature. Safe to
    // skip at boot: the maintenance loop's pending-award sweep resumes NIP-58
    // publishing once an admin re-enables the flag, and definitions are
    // republished on the next boot.
    if (!(await isEnabled('points'))) {
        console.log('[Badges] "points" feature disabled — definition publish skipped');
        return;
    }

    const issuer = await getIssuerKeys();
    if (!issuer) return; // disabled — warn already logged once

    // The write policy must accept the issuer before anything can publish.
    await ensureIssuerWhitelisted();

    let published = 0;
    for (const badge of BADGES) {
        const image = badgeImageUrl(badge.id);
        const eventId = await publishAsIssuer({
            kind: 30009,
            created_at: nowSeconds(),
            tags: [
                ['d', badge.id],
                ['name', badge.name],
                ['description', badge.description],
                ['image', image, '256x256'],
                ['thumb', image, '256x256'],
            ],
            content: '',
        });
        if (eventId) published += 1;
    }
    console.log(`[Badges] Published ${published}/${BADGES.length} NIP-58 badge definitions`);
}

/**
 * Publish the kind-30009 completion-badge definition for a course —
 * issuer-signed (platform-attested certificates, never author-signed).
 * Replaceable via ['d', 'course-<courseId>']; re-publish on title/cover
 * change is harmless. Returns the event id or null (issuer disabled/failed).
 */
export async function publishCourseBadgeDefinition(course: {
    id: string;
    title: string;
    coverImage?: string | null;
}): Promise<string | null> {
    const issuer = await getIssuerKeys();
    if (!issuer) return null;

    await ensureIssuerWhitelisted();

    const badgeId = `course-${course.id}`;
    const image = course.coverImage || badgeImageUrl('course-default');
    const eventId = await publishAsIssuer({
        kind: 30009,
        created_at: nowSeconds(),
        tags: [
            ['d', badgeId],
            ['name', `Course: ${course.title}`],
            ['description', `Completed "${course.title}" on BIES.`],
            ['image', image, '1024x1024'],
            ['thumb', image, '256x256'],
        ],
        content: '',
    });
    if (eventId) {
        await prisma.course.update({
            where: { id: course.id },
            data: { badgeDefEventId: eventId },
        }).catch(() => {});
    }
    return eventId;
}

// ─── Awards (kind 8) ─────────────────────────────────────────────────────────

/**
 * Publish a kind-8 badge award for a freshly inserted UserBadge row and
 * store the award event id in `nostrAwardEventId`. For custodial users the
 * kind-30008 Profile Badges list is updated too (auto-accept).
 *
 * Never throws; returns null when the issuer is disabled or publish failed
 * (the pending sweep retries rows left with a null event id).
 */
export async function publishBadgeAward(
    userBadge: { id: string; userId: string; badgeId: string },
    opts: { skipProfileUpdate?: boolean } = {}
): Promise<string | null> {
    try {
        const issuer = await getIssuerKeys();
        if (!issuer) return null;

        const user = await prisma.user.findUnique({
            where: { id: userBadge.userId },
            select: { nostrPubkey: true, encryptedPrivkey: true },
        });
        if (!user?.nostrPubkey) return null;

        const eventId = await publishAsIssuer({
            kind: 8,
            created_at: nowSeconds(),
            tags: [
                ['a', badgeDefRef(issuer.pubkey, userBadge.badgeId)],
                ['p', user.nostrPubkey],
            ],
            content: '',
        });
        if (!eventId) return null;

        await prisma.userBadge.update({
            where: { id: userBadge.id },
            data: { nostrAwardEventId: eventId },
        });

        // Auto-accept for custodial users: refresh their Profile Badges list.
        if (user.encryptedPrivkey && !opts.skipProfileUpdate) {
            try {
                await updateProfileBadges(userBadge.userId, issuer.pubkey);
            } catch (error) {
                console.error('[Badges] Profile Badges update failed:', error);
            }
        }

        console.log(
            `[Badges] Award published: ${userBadge.badgeId} → ${user.nostrPubkey.substring(0, 8)}...`
        );
        return eventId;
    } catch (error) {
        console.error('[Badges] Award publish failed:', error);
        return null;
    }
}

/**
 * Rebuild and publish a custodial user's kind-30008 Profile Badges list
 * (d='profile_badges') from their published UserBadge rows. The DB is the
 * source of truth, so a full replace is deterministic — no need to fetch
 * the previous list from the relay. Signed via the existing custodial
 * server-signing path (`publishEvent`), which no-ops for Nostr-native users.
 */
async function updateProfileBadges(userId: string, issuerPubkey: string): Promise<void> {
    const awarded = await prisma.userBadge.findMany({
        where: { userId, nostrAwardEventId: { not: null } },
        orderBy: { awardedAt: 'asc' },
        select: { badgeId: true, nostrAwardEventId: true },
    });
    if (awarded.length === 0) return;

    // One a/e pair per badge id — repeat monthly awards keep the latest award.
    const latestAward = new Map<string, string>();
    for (const badge of awarded) {
        latestAward.set(badge.badgeId, badge.nostrAwardEventId as string);
    }

    const tags: string[][] = [['d', 'profile_badges']];
    for (const [badgeId, awardEventId] of latestAward) {
        tags.push(['a', badgeDefRef(issuerPubkey, badgeId)]);
        tags.push(['e', awardEventId]);
    }

    await publishEvent(userId, {
        kind: 30008,
        created_at: nowSeconds(),
        tags,
        content: '',
    });
}

// ─── Pending sweep (retry + post-backfill bulk publish) ──────────────────────

let sweepInFlight = false;

/**
 * Publish awards for every UserBadge with a null `nostrAwardEventId` —
 * badges granted during backfill, while the issuer was disabled, or whose
 * publish failed. Runs after backfill and on each maintenance tick.
 * Profile Badges lists are refreshed once per user, after their awards.
 */
export async function publishPendingAwards(): Promise<void> {
    const issuer = await getIssuerKeys();
    if (!issuer) return;
    if (sweepInFlight) return;
    sweepInFlight = true;

    try {
        const pending = await prisma.userBadge.findMany({
            where: { nostrAwardEventId: null },
            orderBy: { awardedAt: 'asc' },
            select: { id: true, userId: true, badgeId: true },
        });
        if (pending.length === 0) return;

        await ensureIssuerWhitelisted();

        const byUser = new Map<string, typeof pending>();
        for (const badge of pending) {
            const list = byUser.get(badge.userId) ?? [];
            list.push(badge);
            byUser.set(badge.userId, list);
        }

        let published = 0;
        for (const [userId, badges] of byUser) {
            let userPublished = 0;
            for (const badge of badges) {
                const eventId = await publishBadgeAward(badge, { skipProfileUpdate: true });
                if (eventId) userPublished += 1;
            }
            published += userPublished;

            if (userPublished > 0) {
                try {
                    await updateProfileBadges(userId, issuer.pubkey);
                } catch (error) {
                    console.error('[Badges] Profile Badges update failed:', error);
                }
            }
        }

        console.log(`[Badges] Pending award sweep: published ${published}/${pending.length}`);
    } finally {
        sweepInFlight = false;
    }
}
