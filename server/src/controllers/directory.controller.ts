import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { recomputeListingScore } from '../services/directoryReputation.service';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────

const phoneRegex = /^[+0-9\s()-]*$/;

export const createDirectoryListingSchema = z.object({
    type: z.enum(['FARM', 'PROVIDER']),
    name: z.string().min(1).max(120),
    about: z.string().max(5000).optional(),
    photo: z.string().optional().or(z.literal('')),
    logo: z.string().optional().or(z.literal('')),
    photos: z.array(z.string()).max(10).optional(),
    location: z.string().max(200).optional(),
    phone: z.string().max(30).regex(phoneRegex).optional().or(z.literal('')),
    whatsapp: z.string().max(30).regex(phoneRegex).optional().or(z.literal('')),
    email: z.string().email().optional().or(z.literal('')),
    website: z.string().url().optional().or(z.literal('')),
    instagram: z.string().optional().or(z.literal('')),
    languages: z.array(z.string().max(20)).optional(),
    btcAccepted: z.boolean().optional(),
    products: z.array(z.object({
        label: z.string().min(1).max(60),
        icon: z.string().max(30).optional(),
    })).max(20).optional(),
    practices: z.array(z.enum(['regenerative', 'rotational-grazing', 'no-gmo-feed', 'animal-welfare'])).optional(),
    skills: z.array(z.string().max(60)).max(20).optional(),
    bestFor: z.string().max(200).optional(),
    pricing: z.string().max(200).optional(),
    comment: z.string().max(500).optional(),
    memberUserId: z.string().optional().or(z.literal('')),
});

export const updateDirectoryListingSchema = createDirectoryListingSchema.partial();

export const endorseSchema = z.object({
    comment: z.string().max(500).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Fields writable by owners — never status/isFeatured/baseScore/reputationScore/
// isCertified/nostrListingEventId (admin- or system-controlled).
const ALLOWED_FIELDS = [
    'type', 'name', 'about', 'photo', 'logo', 'photos', 'location',
    'phone', 'whatsapp', 'email', 'website', 'instagram', 'languages',
    'btcAccepted', 'products', 'practices', 'skills', 'bestFor',
    'pricing', 'comment', 'memberUserId',
];

const JSON_ARRAY_FIELDS = ['photos', 'languages', 'products', 'practices', 'skills'] as const;

const ownerSelect = {
    select: {
        id: true, nostrPubkey: true, role: true,
        profile: { select: { name: true, avatar: true } },
    },
};

function parseListing(listing: any): any {
    return {
        ...listing,
        photos: JSON.parse(listing.photos || '[]'),
        languages: JSON.parse(listing.languages || '[]'),
        products: JSON.parse(listing.products || '[]'),
        practices: JSON.parse(listing.practices || '[]'),
        skills: JSON.parse(listing.skills || '[]'),
    };
}

function pickAllowedFields(body: any): any {
    const data: any = {};
    for (const field of ALLOWED_FIELDS) {
        if (body[field] !== undefined) data[field] = body[field];
    }
    for (const field of JSON_ARRAY_FIELDS) {
        if (data[field]) data[field] = JSON.stringify(data[field]);
    }
    return data;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /directory
 * List directory listings with filtering, sorting, and pagination.
 * Public scope: active + published. Owners see all statuses of their own.
 */
export async function listListings(req: Request, res: Response): Promise<void> {
    try {
        const {
            type, search, certified, btc, language, ownerId,
            page = '1', limit = '20',
            sort = 'newest',
        } = req.query;

        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const where: any = { status: 'active', isPublished: true };

        if (type && typeof type === 'string') where.type = type.toUpperCase();
        if (ownerId && typeof ownerId === 'string') {
            where.ownerId = ownerId;
            // When viewing own listings, show all statuses
            if (req.user && req.user.id === ownerId) {
                delete where.isPublished;
                delete where.status;
            }
        }
        if (certified === 'true') where.isCertified = true;
        if (btc === 'true') where.btcAccepted = true;
        if (language && typeof language === 'string') {
            where.languages = { contains: language };
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search } },
                { about: { contains: search } },
                { location: { contains: search } },
                { products: { contains: search } },
                { skills: { contains: search } },
            ];
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'name') orderBy = { name: 'asc' };
        if (sort === 'score') orderBy = { reputationScore: 'desc' };

        const [listings, total] = await Promise.all([
            prisma.directoryListing.findMany({
                where,
                include: {
                    owner: ownerSelect,
                    memberUser: ownerSelect,
                    _count: { select: { endorsements: true } },
                },
                skip,
                take,
                orderBy,
            }),
            prisma.directoryListing.count({ where }),
        ]);

        res.json({
            data: listings.map(parseListing),
            pagination: {
                page: parseInt(page as string, 10),
                limit: take,
                total,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error) {
        console.error('List directory listings error:', error);
        res.status(500).json({ error: 'Failed to list directory listings' });
    }
}

/**
 * GET /directory/:id
 * Get a single listing. Non-active/unpublished listings are only visible
 * to the owner or an admin.
 */
export async function getListing(req: Request, res: Response): Promise<void> {
    try {
        const listing = await prisma.directoryListing.findUnique({
            where: { id: req.params.id },
            include: {
                owner: ownerSelect,
                memberUser: ownerSelect,
                endorsements: {
                    orderBy: { createdAt: 'desc' },
                    include: { user: ownerSelect },
                },
                _count: { select: { endorsements: true } },
            },
        });

        if (!listing) {
            res.status(404).json({ error: 'Listing not found' });
            return;
        }

        // Only allow owner/admin to view non-active or unpublished listings
        if (listing.status !== 'active' || !listing.isPublished) {
            const isOwner = req.user && listing.ownerId === req.user.id;
            const isAdmin = req.user && req.user.isAdmin;
            if (!isOwner && !isAdmin) {
                res.status(404).json({ error: 'Listing not found' });
                return;
            }
        }

        // Fire-and-forget view count increment
        prisma.directoryListing.update({
            where: { id: listing.id },
            data: { viewCount: { increment: 1 } },
        }).catch(() => {});

        res.json(parseListing(listing));
    } catch (error) {
        console.error('Get directory listing error:', error);
        res.status(500).json({ error: 'Failed to get directory listing' });
    }
}

/**
 * POST /directory
 * Create a listing. Allow-listed fields only. MOD/admin listings go live
 * immediately; member submissions await review.
 */
export async function createListing(req: Request, res: Response): Promise<void> {
    try {
        const data = pickAllowedFields(req.body);
        if (data.memberUserId === '') delete data.memberUserId;

        if (data.memberUserId) {
            const memberUser = await prisma.user.findUnique({
                where: { id: data.memberUserId },
                select: { id: true },
            });
            if (!memberUser) {
                res.status(400).json({ error: 'Linked member user not found' });
                return;
            }
        }

        const status = (req.user!.isAdmin || req.user!.role === 'MOD') ? 'active' : 'pending-review';

        const listing = await prisma.directoryListing.create({
            data: { ...data, ownerId: req.user!.id, status },
            include: {
                owner: ownerSelect,
                memberUser: ownerSelect,
            },
        });

        recomputeListingScore(listing.id).catch((err) =>
            console.error('[Directory] Score recompute failed:', err)
        );

        res.status(201).json(parseListing(listing));
    } catch (error) {
        console.error('Create directory listing error:', error);
        res.status(500).json({ error: 'Failed to create directory listing' });
    }
}

/**
 * PUT /directory/:id
 * Update a listing (owner or admin). Allow-listed fields only.
 */
export async function updateListing(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.directoryListing.findUnique({
            where: { id: req.params.id },
            select: { ownerId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Listing not found' }); return; }
        if (existing.ownerId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized to update this listing' }); return;
        }

        const data = pickAllowedFields(req.body);
        if (data.memberUserId === '') data.memberUserId = null;

        if (data.memberUserId) {
            const memberUser = await prisma.user.findUnique({
                where: { id: data.memberUserId },
                select: { id: true },
            });
            if (!memberUser) {
                res.status(400).json({ error: 'Linked member user not found' });
                return;
            }
        }

        const listing = await prisma.directoryListing.update({
            where: { id: req.params.id },
            data,
            include: {
                owner: ownerSelect,
                memberUser: ownerSelect,
            },
        });

        recomputeListingScore(listing.id).catch((err) =>
            console.error('[Directory] Score recompute failed:', err)
        );

        res.json(parseListing(listing));
    } catch (error) {
        console.error('Update directory listing error:', error);
        res.status(500).json({ error: 'Failed to update directory listing' });
    }
}

/**
 * DELETE /directory/:id
 * Delete a listing (owner or admin).
 */
export async function deleteListing(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.directoryListing.findUnique({
            where: { id: req.params.id },
            select: { ownerId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Listing not found' }); return; }
        if (existing.ownerId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized to delete this listing' }); return;
        }

        await prisma.directoryListing.delete({ where: { id: req.params.id } });

        res.json({ message: 'Listing deleted' });
    } catch (error) {
        console.error('Delete directory listing error:', error);
        res.status(500).json({ error: 'Failed to delete directory listing' });
    }
}

/**
 * POST /directory/:id/endorse
 * Endorse a listing (one endorsement per user per listing; upsert updates
 * the comment).
 */
export async function endorseListing(req: Request, res: Response): Promise<void> {
    try {
        const listing = await prisma.directoryListing.findUnique({
            where: { id: req.params.id },
            select: { id: true },
        });

        if (!listing) { res.status(404).json({ error: 'Listing not found' }); return; }

        const comment = req.body.comment || '';

        const endorsement = await prisma.directoryEndorsement.upsert({
            where: {
                listingId_userId: {
                    listingId: req.params.id,
                    userId: req.user!.id,
                },
            },
            create: { listingId: req.params.id, userId: req.user!.id, comment },
            update: { comment },
        });

        recomputeListingScore(req.params.id).catch((err) =>
            console.error('[Directory] Score recompute failed:', err)
        );

        res.status(201).json(endorsement);
    } catch (error) {
        console.error('Endorse listing error:', error);
        res.status(500).json({ error: 'Failed to endorse listing' });
    }
}

/**
 * DELETE /directory/:id/endorse
 * Remove own endorsement.
 */
export async function removeEndorsement(req: Request, res: Response): Promise<void> {
    try {
        const deleted = await prisma.directoryEndorsement.deleteMany({
            where: { listingId: req.params.id, userId: req.user!.id },
        });

        if (deleted.count === 0) {
            res.status(404).json({ error: 'Endorsement not found' });
            return;
        }

        recomputeListingScore(req.params.id).catch((err) =>
            console.error('[Directory] Score recompute failed:', err)
        );

        res.json({ message: 'Endorsement removed' });
    } catch (error) {
        console.error('Remove endorsement error:', error);
        res.status(500).json({ error: 'Failed to remove endorsement' });
    }
}
