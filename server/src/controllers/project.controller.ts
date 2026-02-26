import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { publishProject } from '../services/nostr.service';
import { getPresignedUrl } from '../services/storage.service';
import { cache, cacheKey, TTL } from '../services/redis.service';
import { notifyProjectUpdate } from '../services/notification.service';
import { z } from 'zod';

// ─── Validation ───────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    category: z.enum([
        'ENERGY', 'FINTECH', 'EDUCATION', 'AGRICULTURE',
        'REAL_ESTATE', 'INFRASTRUCTURE', 'TOURISM', 'TECHNOLOGY', 'OTHER',
    ]).default('OTHER'),
    stage: z.enum(['IDEA', 'MVP', 'GROWTH', 'SCALING']).default('IDEA'),
    fundingGoal: z.number().positive().optional(),
    thumbnail: z.string().url().optional().or(z.literal('')),
    demoUrl: z.string().url().optional().or(z.literal('')),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /projects
 * List published projects with filtering, sorting, and caching.
 */
export async function listProjects(req: Request, res: Response): Promise<void> {
    try {
        const {
            category, stage, ownerId, search, featured,
            page = '1', limit = '20',
            sort = 'newest',
        } = req.query;

        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        // Try cache for non-owner, non-authenticated requests
        const cKey = cacheKey.projects({
            category: category as string || '',
            stage: stage as string || '',
            search: search as string || '',
            featured: featured as string || '',
            sort: sort as string,
            page: page as string,
            limit: limit as string,
        });

        if (!ownerId) {
            const cached = await cache.getJson<any>(cKey);
            if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }
        }

        const where: any = { isPublished: true };

        if (category && typeof category === 'string') where.category = category.toUpperCase();
        if (stage && typeof stage === 'string') where.stage = stage.toUpperCase();
        if (ownerId && typeof ownerId === 'string') where.ownerId = ownerId;
        if (featured === 'true') where.isFeatured = true;
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
            ];
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'oldest') orderBy = { createdAt: 'asc' };
        if (sort === 'title') orderBy = { title: 'asc' };
        if (sort === 'popular') orderBy = { viewCount: 'desc' };
        if (sort === 'funded') orderBy = { raisedAmount: 'desc' };

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                include: {
                    owner: {
                        select: {
                            id: true, nostrPubkey: true, role: true,
                            profile: { select: { name: true, avatar: true, company: true } },
                        },
                    },
                    _count: { select: { watchlisted: true, investments: true } },
                },
                skip,
                take,
                orderBy,
            }),
            prisma.project.count({ where }),
        ]);

        const parsed = projects.map((p) => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
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

        if (!ownerId) {
            await cache.setJson(cKey, result, TTL.PROJECT_LIST);
        }

        res.json(result);
    } catch (error) {
        console.error('List projects error:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
}

/**
 * GET /projects/:id
 * Get a single project (cached).
 */
export async function getProject(req: Request, res: Response): Promise<void> {
    try {
        const cKey = cacheKey.projectDetail(req.params.id);
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }

        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                owner: {
                    select: {
                        id: true, nostrPubkey: true, role: true,
                        profile: { select: { name: true, avatar: true, company: true, bio: true } },
                    },
                },
                teamMembers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                profile: { select: { name: true, avatar: true, title: true } },
                            },
                        },
                    },
                },
                updates: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                _count: { select: { watchlisted: true, investments: true, views: true } },
            },
        });

        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const result = { ...project, tags: JSON.parse(project.tags || '[]') };
        await cache.setJson(cKey, result, TTL.PROJECT_DETAIL);
        res.json(result);
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to get project' });
    }
}

/**
 * POST /projects
 * Create a project. Busts list cache. Syncs to Nostr.
 */
export async function createProject(req: Request, res: Response): Promise<void> {
    try {
        const data: any = { ...req.body };
        if (data.tags) data.tags = JSON.stringify(data.tags);

        const project = await prisma.project.create({
            data: { ...data, ownerId: req.user!.id },
            include: {
                owner: {
                    select: {
                        id: true, nostrPubkey: true,
                        profile: { select: { name: true } },
                    },
                },
            },
        });

        await cache.delPattern('projects:');

        publishProject(req.user!.id, {
            id: project.id,
            title: project.title,
            description: project.description,
            category: project.category,
            stage: project.stage,
            thumbnail: project.thumbnail,
        }).catch((err) => console.error('[Nostr] Project sync failed:', err));

        res.status(201).json({ ...project, tags: JSON.parse(project.tags || '[]') });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
}

/**
 * PUT /projects/:id
 * Update a project (owner only). Busts caches.
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { ownerId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }
        if (existing.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized to update this project' }); return;
        }

        const data: any = { ...req.body };
        if (data.tags) data.tags = JSON.stringify(data.tags);

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data,
        });

        await Promise.all([
            cache.del(cacheKey.projectDetail(req.params.id)),
            cache.delPattern('projects:'),
        ]);

        publishProject(req.user!.id, {
            id: project.id,
            title: project.title,
            description: project.description,
            category: project.category,
            stage: project.stage,
            thumbnail: project.thumbnail,
        }).catch((err) => console.error('[Nostr] Project sync failed:', err));

        res.json({ ...project, tags: JSON.parse(project.tags || '[]') });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
}

/**
 * DELETE /projects/:id
 * Soft-delete (owner only).
 */
export async function deleteProject(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { ownerId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Project not found' }); return; }
        if (existing.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized to delete this project' }); return;
        }

        await prisma.project.update({
            where: { id: req.params.id },
            data: { isPublished: false },
        });

        await Promise.all([
            cache.del(cacheKey.projectDetail(req.params.id)),
            cache.delPattern('projects:'),
        ]);

        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
}

/**
 * POST /projects/:id/updates
 * Post a project update (builder only).
 */
export async function postProjectUpdate(req: Request, res: Response): Promise<void> {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { ownerId: true, title: true },
        });

        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        const { title, content } = req.body;
        if (!title || !content) {
            res.status(400).json({ error: 'title and content are required' }); return;
        }

        const update = await prisma.projectUpdate.create({
            data: { projectId: req.params.id, title, content },
        });

        // Notify watchers
        const watchers = await prisma.watchlistItem.findMany({
            where: { projectId: req.params.id },
            select: { userId: true },
        });
        if (watchers.length > 0) {
            await notifyProjectUpdate({
                projectId: req.params.id,
                projectTitle: project.title,
                updateTitle: title,
                watcherIds: watchers.map((w) => w.userId),
            });
        }

        await cache.del(cacheKey.projectDetail(req.params.id));
        res.status(201).json(update);
    } catch (error) {
        console.error('Post project update error:', error);
        res.status(500).json({ error: 'Failed to post update' });
    }
}

/**
 * GET /projects/:id/deck
 * Presigned URL for pitch deck (investors, admins, and owner only).
 */
export async function getProjectDeck(req: Request, res: Response): Promise<void> {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            select: { deckKey: true, ownerId: true },
        });

        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        if (!project.deckKey) { res.status(404).json({ error: 'No pitch deck uploaded for this project' }); return; }

        const isOwner = project.ownerId === req.user!.id;
        const isInvestor = req.user!.role === 'INVESTOR';
        const isAdmin = req.user!.role === 'ADMIN';

        if (!isOwner && !isInvestor && !isAdmin) {
            res.status(403).json({ error: 'Only investors can view pitch decks' }); return;
        }

        const url = await getPresignedUrl(project.deckKey);
        res.json({ url, expiresIn: 900 });
    } catch (error) {
        console.error('Get deck error:', error);
        res.status(500).json({ error: 'Failed to get pitch deck' });
    }
}
