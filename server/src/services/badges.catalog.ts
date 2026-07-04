/**
 * Badge catalog & level titles — code-defined gamification metadata.
 *
 * Badges are defined here and awarded in the DB (UserBadge). Names and
 * descriptions live in the i18n `points.badges.*` namespace client-side;
 * this catalog only carries ids, rarity, lucide icon names and the award
 * predicate. Monthly badges (monthly: true) are never awarded by
 * `checkBadges` — only by the monthly rollover job (their `check` always
 * returns false).
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
        check: (score) => score.postCount >= 1,
    },
    {
        id: 'first-reply',
        rarity: 'common',
        icon: 'message-circle',
        check: (score) => score.replyCount >= 1,
    },
    {
        id: 'first-reaction',
        rarity: 'common',
        icon: 'heart',
        check: (score) => score.reactionsGiven >= 1,
    },
    // ── Uncommon ──────────────────────────────────────────────────────────
    {
        id: 'posts-25',
        rarity: 'uncommon',
        icon: 'notebook-pen',
        check: (score) => score.postCount >= 25,
    },
    {
        id: 'replies-50',
        rarity: 'uncommon',
        icon: 'messages-square',
        check: (score) => score.replyCount >= 50,
    },
    {
        id: 'received-25',
        rarity: 'uncommon',
        icon: 'thumbs-up',
        check: (score) => score.reactionsReceived >= 25,
    },
    {
        id: 'streak-7',
        rarity: 'uncommon',
        icon: 'flame',
        check: (score) => score.streakDays >= 7,
    },
    // ── Rare ──────────────────────────────────────────────────────────────
    {
        id: 'received-100',
        rarity: 'rare',
        icon: 'sparkles',
        check: (score) => score.reactionsReceived >= 100,
    },
    {
        id: 'streak-30',
        rarity: 'rare',
        icon: 'calendar-check',
        check: (score) => score.streakDays >= 30,
    },
    {
        id: 'level-10',
        rarity: 'rare',
        icon: 'award',
        check: (score) => score.level >= 10,
    },
    {
        // Top 3 of the monthly leaderboard — awarded by the rollover job only.
        id: 'monthly-top3',
        rarity: 'rare',
        icon: 'medal',
        monthly: true,
        check: () => false,
    },
    // ── Legendary ─────────────────────────────────────────────────────────
    {
        // "Corona del Volcán" — monthly #1, awarded by the rollover job only.
        id: 'monthly-first',
        rarity: 'legendary',
        icon: 'crown',
        monthly: true,
        check: () => false,
    },
    {
        id: 'level-20',
        rarity: 'legendary',
        icon: 'gem',
        check: (score) => score.level >= 20,
    },
    {
        // Early adopters: account created on or before GENESIS_CUTOFF.
        // Never awarded when the env var is unset or unparseable.
        id: 'genesis',
        rarity: 'legendary',
        icon: 'rocket',
        check: (_score, user) => {
            const cutoff = process.env.GENESIS_CUTOFF;
            if (!cutoff) return false;
            const cutoffDate = new Date(cutoff);
            if (Number.isNaN(cutoffDate.getTime())) return false;
            return user.createdAt.getTime() <= cutoffDate.getTime();
        },
    },
];
