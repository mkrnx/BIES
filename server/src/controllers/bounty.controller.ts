import { Request, Response } from 'express';
import { z } from 'zod';
import * as bountyService from '../services/bounty.service';
import { BountyError, InsufficientBountyBalanceError } from '../services/bounty.service';

const VALID_STATUSES = ['OPEN', 'AWARDED', 'PAID', 'EXPIRED', 'CANCELLED'];
const VALID_REWARD_TYPES = ['SATS', 'POINTS'];

// ─── Validation ───────────────────────────────────────────────────────────────

export const createBountySchema = z.object({
    title: z.string().min(3).max(200),
    description: z.string().max(10000).default(''),
    rewardType: z.enum(['SATS', 'POINTS']),
    // Type-dependent range (POINTS 5..10000, SATS 100..1000000) is enforced
    // in the service next to the escrow logic.
    amount: z.number().int().positive(),
    deadline: z.string().datetime({ offset: true }).optional().nullable(),
});

export const bountySubmissionSchema = z.object({
    content: z.string().min(5).max(10000),
});

export const awardBountySchema = z.object({
    submissionId: z.string().min(1),
});

export const markPaidSchema = z.object({
    via: z.enum(['WALLET', 'MANUAL']),
});

export const mirrorBountySchema = z.object({
    eventId: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a 64-char lowercase hex event id').optional(),
});

export const featureBountySchema = z.object({
    featured: z.boolean(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, fallback: string): void {
    if (error instanceof BountyError) {
        res.status(error.status).json({ error: error.message });
        return;
    }
    if (error instanceof InsufficientBountyBalanceError) {
        res.status(400).json({ error: error.message });
        return;
    }
    console.error(`${fallback}:`, error);
    res.status(500).json({ error: fallback });
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /bounties
 * List bounties with filters (status, rewardType, featured, mine, posterId).
 */
export async function listBounties(req: Request, res: Response): Promise<void> {
    try {
        const status = req.query.status as string || '';
        const rewardType = req.query.rewardType as string || '';

        if (status && !VALID_STATUSES.includes(status)) {
            res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
            return;
        }
        if (rewardType && !VALID_REWARD_TYPES.includes(rewardType)) {
            res.status(400).json({ error: `Invalid rewardType. Must be one of: ${VALID_REWARD_TYPES.join(', ')}` });
            return;
        }

        // "mine" covers bounties the user posted OR submitted to (the tab's
        // empty-state copy promises both); posterId stays a pure poster filter.
        const mine = req.query.mine === 'true';

        const result = await bountyService.listBounties({
            status: status || undefined,
            rewardType: rewardType || undefined,
            featured: req.query.featured === 'true' || undefined,
            posterId: mine ? undefined : (req.query.posterId as string || undefined),
            participantId: mine ? req.user!.id : undefined,
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 20,
        });

        res.json(result);
    } catch (error) {
        handleError(res, error, 'Failed to list bounties');
    }
}

/**
 * GET /bounties/:id
 * Bounty detail with poster, submissions and winner.
 */
export async function getBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.getBounty(req.params.id);
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to load bounty');
    }
}

/**
 * POST /bounties
 * Create a bounty. POINTS bounties escrow the amount from the poster's
 * spendable balance inside the create transaction.
 */
export async function createBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.createBounty(req.user!.id, req.body);
        res.status(201).json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to create bounty');
    }
}

/**
 * POST /bounties/:id/submissions
 * Submit work to an open bounty (one submission per user).
 */
export async function submitToBounty(req: Request, res: Response): Promise<void> {
    try {
        const submission = await bountyService.submitToBounty(
            req.user!.id,
            req.params.id,
            req.body.content
        );
        res.status(201).json(submission);
    } catch (error) {
        handleError(res, error, 'Failed to submit to bounty');
    }
}

/**
 * PUT /bounties/:id/submissions
 * Edit your own submission while the bounty is still open.
 */
export async function updateSubmission(req: Request, res: Response): Promise<void> {
    try {
        const submission = await bountyService.updateSubmission(
            req.user!.id,
            req.params.id,
            req.body.content
        );
        res.json(submission);
    } catch (error) {
        handleError(res, error, 'Failed to update submission');
    }
}

/**
 * POST /bounties/:id/award
 * Pick a winner (poster only). POINTS settle instantly; SATS move to AWARDED.
 */
export async function awardBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.awardBounty(
            req.user!.id,
            req.params.id,
            req.body.submissionId
        );
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to award bounty');
    }
}

/**
 * POST /bounties/:id/unaward
 * Revert a sats bounty from AWARDED back to OPEN (poster only).
 */
export async function unawardBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.unawardBounty(req.user!.id, req.params.id);
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to un-award bounty');
    }
}

/**
 * POST /bounties/:id/mark-paid
 * Poster confirms an awarded sats bounty was paid (WALLET or MANUAL).
 */
export async function markBountyPaid(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.markPaid(req.user!.id, req.params.id, req.body.via);
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to mark bounty paid');
    }
}

/**
 * POST /bounties/:id/cancel
 * Cancel an open bounty (poster only); points escrow is refunded.
 */
export async function cancelBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.cancelBounty(req.user!.id, req.params.id);
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to cancel bounty');
    }
}

/**
 * POST /bounties/:id/mirror
 * Mirror the bounty as a kind-1 note. Custodial posters: server publishes.
 * Nostr-native posters: client already published, body carries the eventId.
 */
export async function mirrorBounty(req: Request, res: Response): Promise<void> {
    try {
        const { eventId } = req.body;

        if (eventId) {
            await bountyService.attachMirrorEvent(req.params.id, req.user!.id, eventId);
        } else {
            const publishedId = await bountyService.mirrorBountyNote(req.params.id, req.user!.id);
            if (!publishedId) {
                res.status(400).json({
                    error: 'Server-side publish unavailable — provide the eventId of a client-published note',
                });
                return;
            }
        }

        res.json(await bountyService.getBounty(req.params.id));
    } catch (error) {
        handleError(res, error, 'Failed to mirror bounty');
    }
}

/**
 * GET /admin/bounties
 * List all bounties with filters (admin only).
 */
export async function listAdminBounties(req: Request, res: Response): Promise<void> {
    try {
        const result = await bountyService.adminListBounties({
            status: req.query.status as string || undefined,
            rewardType: req.query.rewardType as string || undefined,
            search: req.query.search as string || undefined,
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 30,
        });
        res.json(result);
    } catch (error) {
        handleError(res, error, 'Failed to list bounties');
    }
}

/**
 * DELETE /admin/bounties/:id
 * Delete a bounty, refunding points escrow if still held (admin only).
 */
export async function deleteAdminBounty(req: Request, res: Response): Promise<void> {
    try {
        const { refunded } = await bountyService.adminDeleteBounty(req.params.id);
        res.json({ message: 'Bounty deleted', refunded });
    } catch (error) {
        handleError(res, error, 'Failed to delete bounty');
    }
}

/**
 * POST /admin/bounties/:id/feature
 * Toggle the featured flag (admin only).
 */
export async function featureAdminBounty(req: Request, res: Response): Promise<void> {
    try {
        const bounty = await bountyService.adminSetFeatured(req.params.id, req.body.featured);
        res.json(bounty);
    } catch (error) {
        handleError(res, error, 'Failed to feature bounty');
    }
}
