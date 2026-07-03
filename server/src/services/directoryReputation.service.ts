/**
 * Directory reputation scoring service.
 *
 * score = clamp(0, 100,
 *     baseScore                                            // admin lever, 0–60
 *   + ((memberUser ?? owner).isVerified ? 10 : 0)          // verified bonus
 *   + min(20, verifiedEndorsementCount * 4)                // only verified endorsers count
 *   + min(10, round(2 * log10(1 + totalZapSats)))          // zaps to memberUser.nostrPubkey
 *   + completeness                                         // 2 pts each, max 10
 * )
 *
 * isCertified = score >= 90 — certifiedAt is set on the false→true
 * transition and cleared when the listing drops below the threshold.
 */

import prisma from '../lib/prisma';

const CERTIFICATION_THRESHOLD = 90;

function clamp(min: number, max: number, value: number): number {
    return Math.max(min, Math.min(max, value));
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
    try {
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Profile completeness: 2 points each (max 10) for
 * (phone or whatsapp), location, about ≥ 100 chars, photo,
 * and a non-empty products or skills list.
 */
function completenessScore(listing: {
    phone: string;
    whatsapp: string;
    location: string;
    about: string;
    photo: string;
    products: string;
    skills: string;
}): number {
    let points = 0;
    if (listing.phone.trim() || listing.whatsapp.trim()) points += 2;
    if (listing.location.trim()) points += 2;
    if (listing.about.length >= 100) points += 2;
    if (listing.photo.trim()) points += 2;
    if (parseJsonArray(listing.products).length > 0 || parseJsonArray(listing.skills).length > 0) points += 2;
    return points;
}

/**
 * Recompute the reputation score for a single listing and persist
 * reputationScore / isCertified / certifiedAt. Missing listings are ignored.
 */
export async function recomputeListingScore(listingId: string): Promise<void> {
    const listing = await prisma.directoryListing.findUnique({
        where: { id: listingId },
        include: {
            owner: { select: { isVerified: true } },
            memberUser: { select: { isVerified: true, nostrPubkey: true } },
            endorsements: {
                include: { user: { select: { isVerified: true } } },
            },
        },
    });
    if (!listing) return;

    // Verified bonus — the linked member account takes precedence over the owner
    const verifiedBonus = (listing.memberUser ?? listing.owner).isVerified ? 10 : 0;

    // Endorsements — only endorsements from verified users add score
    const verifiedEndorsementCount = listing.endorsements.filter((e) => e.user.isVerified).length;
    const endorsementPoints = Math.min(20, verifiedEndorsementCount * 4);

    // Zaps — sats received by the linked member's Nostr pubkey (0 without a link)
    let zapPoints = 0;
    if (listing.memberUser?.nostrPubkey) {
        const zapAgg = await prisma.zapReceipt.aggregate({
            where: { recipientPubkey: listing.memberUser.nostrPubkey },
            _sum: { amountSats: true },
        });
        const totalZapSats = zapAgg._sum.amountSats ?? 0;
        zapPoints = Math.min(10, Math.round(2 * Math.log10(1 + totalZapSats)));
    }

    const score = clamp(0, 100,
        listing.baseScore
        + verifiedBonus
        + endorsementPoints
        + zapPoints
        + completenessScore(listing)
    );

    const isCertified = score >= CERTIFICATION_THRESHOLD;
    const data: { reputationScore: number; isCertified: boolean; certifiedAt?: Date | null } = {
        reputationScore: score,
        isCertified,
    };
    if (isCertified && !listing.isCertified) data.certifiedAt = new Date();
    if (!isCertified && listing.isCertified) data.certifiedAt = null;

    await prisma.directoryListing.update({
        where: { id: listingId },
        data,
    });
}

/**
 * Recompute reputation scores for all listings (sequential).
 * Per-listing failures are logged and do not abort the run.
 */
export async function recomputeAllScores(): Promise<void> {
    const listings = await prisma.directoryListing.findMany({ select: { id: true } });
    for (const { id } of listings) {
        try {
            await recomputeListingScore(id);
        } catch (error) {
            console.error(`[DirectoryReputation] Failed to recompute listing ${id}:`, error);
        }
    }
}
