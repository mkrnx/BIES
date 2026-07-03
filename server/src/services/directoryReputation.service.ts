/**
 * Directory reputation scoring service.
 *
 * Stub only — the real scoring formula (baseScore + verified bonus +
 * endorsements + zaps + completeness, certification threshold at 90)
 * lands in the next session. Keep these exact signatures.
 */

/**
 * Recompute the reputation score for a single listing.
 * No-op stub.
 */
export async function recomputeListingScore(listingId: string): Promise<void> {
    console.debug(`[DirectoryReputation] recomputeListingScore stub (listing: ${listingId})`);
}

/**
 * Recompute reputation scores for all listings.
 * No-op stub.
 */
export async function recomputeAllScores(): Promise<void> {
    console.debug('[DirectoryReputation] recomputeAllScores stub');
}
