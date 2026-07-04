/**
 * Badge catalog & level titles — code-defined gamification metadata.
 *
 * Badges are defined here and awarded in the DB (UserBadge). The `name` and
 * `description` fields are the plain-English strings published in the NIP-58
 * kind-30009 badge definitions (badges.publisher.ts); the client i18n
 * (`points.badges.*`) may localize them for the in-app UI. Monthly badges
 * (monthly: true) are never awarded by `checkBadges` — only by the monthly
 * rollover job (their `check` always returns false).
 */

export type BadgeRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Shape of the UserScore fields badge checks are allowed to read. */
export interface UserScoreLike {
    monthlyPoints: number;
    lifetimePoints: number;
    level: number;
    streakDays: number;
    postCount: number;
    replyCount: number;
    reactionsGiven: number;
    reactionsReceived: number;
}

export interface BadgeDef {
    id: string;
    rarity: BadgeRarity;
    /** lucide icon name (client resolves it to a component) */
    icon: string;
    /** Plain-EN name — published in the NIP-58 kind-30009 definition. */
    name: string;
    /** Plain-EN description — published in the NIP-58 kind-30009 definition. */
    description: string;
    /** Awarded only by the monthly rollover job, never by checkBadges. */
    monthly?: boolean;
    check(score: UserScoreLike, user: { createdAt: Date }): boolean;
}

/**
 * Level → i18n title key thresholds. A user's title is the entry with the
 * highest `level` that is <= their level. Keys resolve in the client's
 * `points.levels.*` namespace.
 */
export const LEVEL_TITLES: ReadonlyArray<{ level: number; titleKey: string }> = [
    { level: 0, titleKey: 'points.levels.visitante' },
    { level: 1, titleKey: 'points.levels.novato' },
    { level: 2, titleKey: 'points.levels.vecino' },
    { level: 3, titleKey: 'points.levels.constructor' },
    { level: 5, titleKey: 'points.levels.emprendedor' },
    { level: 7, titleKey: 'points.levels.embajador' },
    { level: 10, titleKey: 'points.levels.pionero' },
    { level: 15, titleKey: 'points.levels.volcanero' },
    { level: 20, titleKey: 'points.levels.leyenda' },
];

export const BADGES: ReadonlyArray<BadgeDef> = [
    // ── Common ────────────────────────────────────────────────────────────
    {
        id: 'first-post',
        rarity: 'common',
        icon: 'pencil',
        name: 'First Post',
        description: 'Published a first post in the BIES community.',
        check: (score) => score.postCount >= 1,
    },
    {
        id: 'first-reply',
        rarity: 'common',
        icon: 'message-circle',
        name: 'First Reply',
        description: 'Replied to another member for the first time.',
        check: (score) => score.replyCount >= 1,
    },
    {
        id: 'first-reaction',
        rarity: 'common',
        icon: 'heart',
        name: 'First Reaction',
        description: 'Reacted to a community post for the first time.',
        check: (score) => score.reactionsGiven >= 1,
    },
    // ── Uncommon ──────────────────────────────────────────────────────────
    {
        id: 'posts-25',
        rarity: 'uncommon',
        icon: 'notebook-pen',
        name: 'Prolific Poster',
        description: 'Published 25 posts in the BIES community.',
        check: (score) => score.postCount >= 25,
    },
    {
        id: 'replies-50',
        rarity: 'uncommon',
        icon: 'messages-square',
        name: 'Conversationalist',
        description: 'Wrote 50 replies to other members.',
        check: (score) => score.replyCount >= 50,
    },
    {
        id: 'received-25',
        rarity: 'uncommon',
        icon: 'thumbs-up',
        name: 'Appreciated',
        description: 'Received 25 reactions from the community.',
        check: (score) => score.reactionsReceived >= 25,
    },
    {
        id: 'streak-7',
        rarity: 'uncommon',
        icon: 'flame',
        name: '7-Day Streak',
        description: 'Active in the community 7 days in a row.',
        check: (score) => score.streakDays >= 7,
    },
    {
        id: 'level-5',
        rarity: 'uncommon',
        icon: 'star',
        name: 'Level 5',
        description: 'Reached level 5 — Emprendedor.',
        check: (score) => score.level >= 5,
    },
    // ── Rare ──────────────────────────────────────────────────────────────
    {
        id: 'received-100',
        rarity: 'rare',
        icon: 'sparkles',
        name: 'Community Favorite',
        description: 'Received 100 reactions from the community.',
        check: (score) => score.reactionsReceived >= 100,
    },
    {
        id: 'streak-30',
        rarity: 'rare',
        icon: 'calendar-check',
        name: '30-Day Streak',
        description: 'Active in the community 30 days in a row.',
        check: (score) => score.streakDays >= 30,
    },
    {
        id: 'level-10',
        rarity: 'rare',
        icon: 'award',
        name: 'Level 10',
        description: 'Reached level 10 — Pionero.',
        check: (score) => score.level >= 10,
    },
    {
        id: 'level-15',
        rarity: 'rare',
        icon: 'mountain',
        name: 'Level 15',
        description: 'Reached level 15 — Volcanero.',
        check: (score) => score.level >= 15,
    },
    {
        // Top 3 of the monthly leaderboard — awarded by the rollover job only.
        id: 'monthly-top3',
        rarity: 'rare',
        icon: 'medal',
        name: 'Monthly Podium',
        description: 'Finished in the top 3 of a BIES monthly leaderboard.',
        monthly: true,
        check: () => false,
    },
    // ── Legendary ─────────────────────────────────────────────────────────
    {
        // "Corona del Volcán" — monthly #1, awarded by the rollover job only.
        id: 'monthly-first',
        rarity: 'legendary',
        icon: 'crown',
        name: 'Corona del Volcán',
        description: 'Won first place on a BIES monthly leaderboard.',
        monthly: true,
        check: () => false,
    },
    {
        id: 'level-20',
        rarity: 'legendary',
        icon: 'gem',
        name: 'Level 20',
        description: 'Reached level 20 — Leyenda de El Zonte.',
        check: (score) => score.level >= 20,
    },
    {
        // Early adopters: account created on or before GENESIS_CUTOFF.
        // Never awarded when the env var is unset or unparseable.
        id: 'genesis',
        rarity: 'legendary',
        icon: 'rocket',
        name: 'Genesis',
        description: 'Joined BIES in its earliest days.',
        check: (_score, user) => {
            const cutoff = process.env.GENESIS_CUTOFF;
            if (!cutoff) return false;
            const cutoffDate = new Date(cutoff);
            if (Number.isNaN(cutoffDate.getTime())) return false;
            return user.createdAt.getTime() <= cutoffDate.getTime();
        },
    },
];
