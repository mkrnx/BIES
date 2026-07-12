import { Request, Response } from 'express';
import { z } from 'zod';
import { FEATURE_SLUGS, getFlags, setFlags } from '../services/featureFlags.service';

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Partial { slug: boolean } map. `.strict()` rejects unknown slugs so a typo
 * can never silently persist, and at least one known slug must be present.
 */
export const updateFlagsSchema = z
    .object(
        Object.fromEntries(
            FEATURE_SLUGS.map((slug) => [slug, z.boolean().optional()])
        ) as Record<(typeof FEATURE_SLUGS)[number], z.ZodOptional<z.ZodBoolean>>
    )
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
        message: 'At least one feature flag is required',
    });

// ─── GET /api/flags (public, cached) ─────────────────────────────────────────

export async function getFeatureFlags(_req: Request, res: Response): Promise<void> {
    try {
        const flags = await getFlags();
        res.json(flags);
    } catch (error) {
        console.error('Get feature flags error:', error);
        res.status(500).json({ error: 'Failed to get feature flags' });
    }
}

// ─── PUT /api/admin/flags (true admins only) ─────────────────────────────────

export async function updateFeatureFlags(req: Request, res: Response): Promise<void> {
    try {
        const flags = await setFlags(req.body);
        res.json(flags);
    } catch (error) {
        console.error('Update feature flags error:', error);
        res.status(500).json({ error: 'Failed to update feature flags' });
    }
}
