import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { publishMarketplaceListing, deleteMarketplaceListing } from '../services/nostr.service';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────

const hexPubkeyRegex = /^[0-9a-f]{64}$/;
// Address form: "30402:<pubkey>:<dTag>"
const addressRegex = /^30402:[0-9a-f]{64}:.+$/;
const amountRegex = /^\d+(\.\d+)?$/;

export const publishListingSchema = z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(500).optional(),
    description: z.string().max(10000).optional(),
    price: z.object({
        amount: z.union([z.number().nonnegative(), z.string().regex(amountRegex)]),
        currency: z.string().max(12).optional(),
    }),
    // http(s) only — never allow javascript:/data: etc. to be stored as an image
    images: z.array(z.string().url().max(500).regex(/^https?:\/\//i)).max(10).optional(),
    location: z.string().max(200).optional(),
    status: z.enum(['active', 'sold']).optional(),
    categories: z.array(z.string().max(40)).max(10).optional(),
    // Edit fields: reuse the d-tag and preserve the original published_at
    dTag: z.string().max(100).optional(),
    publishedAt: z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/)]).optional(),
});

export const deleteListingSchema = z.object({
    eventId: z.string().min(1).max(100),
    dTag: z.string().min(1).max(100),
});

export const blockSchema = z.object({
    type: z.enum(['pubkey', 'address']),
    value: z.string().min(1).max(200),
    reason: z.string().max(500).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'pubkey' && !hexPubkeyRegex.test(data.value)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: 'Pubkey must be 64 lowercase hex characters',
        });
    }
    if (data.type === 'address' && !addressRegex.test(data.value)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: 'Address must be of the form 30402:<pubkey>:<dTag>',
        });
    }
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /marketplace/publish
 * Publish a marketplace listing (NIP-99 kind:30402, Shopstr-compatible)
 * signed with the user's custodial key. Nostr-native users sign client-side
 * (nostrService.publishMarketplaceListing) and get a 400 here.
 */
export async function publishListing(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { encryptedPrivkey: true },
        });

        if (!user?.encryptedPrivkey) {
            res.status(400).json({ error: 'No custodial key — sign and publish the listing client-side' });
            return;
        }

        const result = await publishMarketplaceListing(req.user!.id, req.body);

        if (!result) {
            res.status(502).json({ error: 'Failed to publish listing to any relay' });
            return;
        }

        res.json(result); // { eventId, dTag, naddr }
    } catch (error) {
        console.error('Publish marketplace listing error:', error);
        res.status(500).json({ error: 'Failed to publish marketplace listing' });
    }
}

/**
 * POST /marketplace/delete
 * Publish a NIP-09 deletion (kind:5) for a marketplace listing, signed with
 * the user's custodial key. Nostr-native users delete client-side.
 */
export async function deleteListing(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { encryptedPrivkey: true },
        });

        if (!user?.encryptedPrivkey) {
            res.status(400).json({ error: 'No custodial key — publish the deletion client-side' });
            return;
        }

        const { eventId, dTag } = req.body;
        const deleted = await deleteMarketplaceListing(req.user!.id, eventId, dTag);

        if (!deleted) {
            res.status(502).json({ error: 'Failed to publish deletion to any relay' });
            return;
        }

        res.json({ message: 'Listing deletion published' });
    } catch (error) {
        console.error('Delete marketplace listing error:', error);
        res.status(500).json({ error: 'Failed to delete marketplace listing' });
    }
}

/**
 * GET /marketplace/blocklist
 * Public moderation blocklist the client applies when rendering listings.
 * Returns { pubkeys: [...], addresses: [...] } (address = "30402:<pubkey>:<dTag>").
 */
export async function getBlocklist(_req: Request, res: Response): Promise<void> {
    try {
        const blocks = await prisma.marketplaceBlock.findMany({
            select: { type: true, value: true },
        });

        res.json({
            pubkeys: blocks.filter((b) => b.type === 'pubkey').map((b) => b.value),
            addresses: blocks.filter((b) => b.type === 'address').map((b) => b.value),
        });
    } catch (error) {
        console.error('Get marketplace blocklist error:', error);
        res.status(500).json({ error: 'Failed to get marketplace blocklist' });
    }
}

/**
 * POST /marketplace/blocklist
 * Add a blocklist entry (MOD/admin). Upserts on (type, value) so repeated
 * blocks just update the reason.
 */
export async function addBlock(req: Request, res: Response): Promise<void> {
    try {
        const { type, value, reason = '' } = req.body;

        const block = await prisma.marketplaceBlock.upsert({
            where: { type_value: { type, value } },
            create: { type, value, reason, createdBy: req.user!.id },
            update: { reason },
        });

        res.status(201).json(block);
    } catch (error) {
        console.error('Add marketplace block error:', error);
        res.status(500).json({ error: 'Failed to add marketplace block' });
    }
}

/**
 * DELETE /marketplace/blocklist/:id
 * Remove a blocklist entry (MOD/admin).
 */
export async function removeBlock(req: Request, res: Response): Promise<void> {
    try {
        const deleted = await prisma.marketplaceBlock.deleteMany({
            where: { id: req.params.id },
        });

        if (deleted.count === 0) {
            res.status(404).json({ error: 'Block not found' });
            return;
        }

        res.json({ message: 'Block removed' });
    } catch (error) {
        console.error('Remove marketplace block error:', error);
        res.status(500).json({ error: 'Failed to remove marketplace block' });
    }
}
