import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache, cacheKey, TTL } from '../services/redis.service';
import { notifyProfileView } from '../services/notification.service';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    bio: z.string().optional(),
    avatar: z.string().url().optional().or(z.literal('')),
    banner: z.string().url().optional().or(z.literal('')),
    location: z.string().optional(),
    skills: z.array(z.string()).optional(),
    website: z.string().url().optional().or(z.literal('')),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    company: z.string().optional(),
    title: z.string().optional(),
    tags: z.array(z.string()).optional(),
    // Investor-specific
    investmentFocus: z.array(z.string()).optional(),
    investmentStage: z.array(z.string()).optional(),
    minTicket: z.number().positive().optional(),
    maxTicket: z.number().positive().optional(),
    // Builder-specific
    lookingFor: z.array(z.string()).optional(),
    isPublic: z.boolean().optional(),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /profiles
 * List profiles (cached), filterable by role, location, search.
 */
export async function listProfiles(req: Request, res: Response): Promise<void> {
    try {
        const { role, location, search, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const cKey = cacheKey.profiles({
            role: role as string || '',
            location: location as string || '',
            search: search as string || '',
            page: page as string,
            limit: limit as string,
        });

        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }

        const where: any = { isPublic: true };

        if (role && typeof role === 'string') {
            where.user = { role: role.toUpperCase() };
        }
        if (location && typeof location === 'string') {
            where.location = { contains: location };
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search } },
                { bio: { contains: search } },
                { company: { contains: search } },
                { location: { contains: search } },
                { title: { contains: search } },
            ];
        }

        const [profiles, total] = await Promise.all([
            prisma.profile.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true, nostrPubkey: true, role: true,
                            isVerified: true,
                            _count: { select: { projects: true, followers: true } },
                        },
                    },
                },
                skip,
                take,
                orderBy: { viewCount: 'desc' },
            }),
            prisma.profile.count({ where }),
        ]);

        const parsed = profiles.map((p) => ({
            ...p,
            skills: JSON.parse(p.skills || '[]'),
            tags: JSON.parse(p.tags || '[]'),
            investmentFocus: JSON.parse(p.investmentFocus || '[]'),
            investmentStage: JSON.parse(p.investmentStage || '[]'),
            lookingFor: JSON.parse(p.lookingFor || '[]'),
        }));

        const result = {
            data: parsed,
            pagination: {
                page: parseInt(page as string, 10),
                limit: take,
                total,
                totalPages: Math.ceil(total / take),
            },
        };

        await cache.setJson(cKey, result, TTL.PROFILE_LIST);
        res.json(result);
    } catch (error) {
        console.error('List profiles error:', error);
        res.status(500).json({ error: 'Failed to list profiles' });
    }
}

/**
 * GET /profiles/:id
 * Get a single profile (cached, by userId or profileId).
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
    try {
        const cKey = cacheKey.profileDetail(req.params.id);
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }

        const profile = await prisma.profile.findFirst({
            where: {
                OR: [{ userId: req.params.id }, { id: req.params.id }],
                isPublic: true,
            },
            include: {
                user: {
                    select: {
                        id: true, nostrPubkey: true, role: true, isVerified: true,
                        projects: {
                            where: { isPublished: true },
                            select: {
                                id: true, title: true, category: true, stage: true,
                                thumbnail: true, viewCount: true, raisedAmount: true,
                                fundingGoal: true, createdAt: true,
                            },
                            orderBy: { createdAt: 'desc' },
                        },
                        _count: { select: { followers: true, following: true } },
                    },
                },
            },
        });

        if (!profile) {
            res.status(404).json({ error: 'Profile not found' });
            return;
        }

        // Increment view count (non-blocking)
        prisma.profile.update({
            where: { id: profile.id },
            data: { viewCount: { increment: 1 } },
        }).catch(() => {});

        // Notify profile owner of view (dedup: once per viewer per hour)
        if (req.user && req.user.id !== profile.userId) {
            const viewDedupKey = `profile_view:${profile.userId}:${req.user.id}`;
            const alreadyNotified = await cache.get(viewDedupKey);
            if (!alreadyNotified) {
                const viewerProfile = await prisma.profile.findUnique({
                    where: { userId: req.user.id },
                    select: { name: true },
                });
                notifyProfileView({
                    profileOwnerId: profile.userId,
                    viewerName: viewerProfile?.name || 'Someone',
                    viewerId: req.user.id,
                }).catch(() => {});
                cache.set(viewDedupKey, '1', 3600).catch(() => {}); // 1 hour dedup
            }
        }

        const result = {
            ...profile,
            skills: JSON.parse(profile.skills || '[]'),
            tags: JSON.parse(profile.tags || '[]'),
            investmentFocus: JSON.parse(profile.investmentFocus || '[]'),
            investmentStage: JSON.parse(profile.investmentStage || '[]'),
            lookingFor: JSON.parse(profile.lookingFor || '[]'),
        };

        await cache.setJson(cKey, result, TTL.PROFILE_DETAIL);
        res.json(result);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
}

/**
 * PUT /profiles/me
 * Update your own profile. Busts cache, syncs to Nostr.
 */
export async function updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
        const data: any = { ...req.body };

        // Convert arrays to JSON strings for SQLite
        const arrayFields = ['skills', 'tags', 'investmentFocus', 'investmentStage', 'lookingFor'];
        for (const field of arrayFields) {
            if (data[field]) data[field] = JSON.stringify(data[field]);
        }

        const profile = await prisma.profile.upsert({
            where: { userId: req.user!.id },
            update: data,
            create: { userId: req.user!.id, ...data },
        });

        // Bust caches
        await Promise.all([
            cache.del(cacheKey.profileDetail(req.user!.id)),
            cache.del(cacheKey.profileDetail(profile.id)),
            cache.delPattern('profiles:'),
        ]);

        const arrayParsedFields = ['skills', 'tags', 'investmentFocus', 'investmentStage', 'lookingFor'];
        const parsed: any = { ...profile };
        for (const f of arrayParsedFields) {
            parsed[f] = JSON.parse((profile as any)[f] || '[]');
        }

        res.json(parsed);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}

/**
 * GET /profiles/me
 * Get current user's full profile (not cached — always fresh).
 */
export async function getMyProfile(req: Request, res: Response): Promise<void> {
    try {
        const profile = await prisma.profile.findUnique({
            where: { userId: req.user!.id },
            include: {
                user: {
                    select: {
                        id: true, email: true, nostrPubkey: true, role: true, isVerified: true,
                        projects: {
                            orderBy: { createdAt: 'desc' },
                            select: {
                                id: true, title: true, stage: true, category: true,
                                isPublished: true, viewCount: true, raisedAmount: true,
                                fundingGoal: true, createdAt: true,
                            },
                        },
                    },
                },
            },
        });

        if (!profile) {
            res.status(404).json({ error: 'Profile not found — please complete setup' });
            return;
        }

        const arrayFields = ['skills', 'tags', 'investmentFocus', 'investmentStage', 'lookingFor'];
        const parsed: any = { ...profile };
        for (const f of arrayFields) {
            parsed[f] = JSON.parse((profile as any)[f] || '[]');
        }

        res.json(parsed);
    } catch (error) {
        console.error('Get my profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
}
