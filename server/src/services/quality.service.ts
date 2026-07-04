/**
 * Quality bonus hook — AI content-quality scoring (deferred).
 *
 * The points scorer calls `getQualityBonus(content)` for every scored note.
 * Today this is a deliberate no-op stub so the ledger plumbing exists
 * (`QUALITY_BONUS` PointEvent reason, `meta.aiScore`, daily-cap handling)
 * without any AI SDK dependency.
 *
 * Future implementation (single-file drop-in, per plan):
 *   - gated behind an env flag (e.g. QUALITY_BONUS_ENABLED) so it stays off
 *     by default in dev and can be toggled per environment;
 *   - calls the Claude API to rate the note's contribution quality and maps
 *     the rating to a small bonus (e.g. 0–3 points), returned here;
 *   - the scorer records the bonus as a QUALITY_BONUS ledger row with
 *     `meta.aiScore`, subject to the same daily point cap.
 *
 * Returns the bonus points to award, or null for "no bonus" (current
 * behavior — also the correct fallback on any future API error).
 */
export async function getQualityBonus(content: string): Promise<number | null> {
    void content;
    return null;
}
