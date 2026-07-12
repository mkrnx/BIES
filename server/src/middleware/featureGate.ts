import { Request, Response, NextFunction } from 'express';
import { FeatureSlug, isEnabled } from '../services/featureFlags.service';

/**
 * Per-prefix runtime feature gate. When the flag is off every request under
 * the prefix gets 404 `{ error: 'Feature disabled' }` — indistinguishable
 * from a route that never existed.
 *
 * Fail-open: if the flag read itself blows up, the request proceeds — a
 * flaky cache/DB must never take a live feature down.
 *
 * Admin routes (`/api/admin/*`) and the flags endpoints are never gated:
 * admins must always be able to re-enable a feature.
 */
export function featureGate(slug: FeatureSlug) {
    return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (await isEnabled(slug)) {
                next();
                return;
            }
            res.status(404).json({ error: 'Feature disabled' });
        } catch (error) {
            console.error(`[Flags] featureGate(${slug}) check failed — failing open:`, error);
            next();
        }
    };
}
