import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { publishProject } from '../services/nostr.service';
import { getPresignedUrl } from '../services/storage.service';
import { cache, cacheKey, TTL } from '../services/redis.service';
import { notifyProjectUpdate, notifyDeckRequest, notifyDeckApproved, notifyDeckDenied } from '../services/notification.service';
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

export const deckRequestSchema = z.object({
    message: z.string().max(500).optional(),
});

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
 * Presigned URL for pitch deck. Owner/admin always have access.
 * Investors must have an approved DeckRequest.
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
        const isAdmin = req.user!.role === 'ADMIN';
        const isInvestor = req.user!.role === 'INVESTOR';

        // Owner and admin always have access
        if (isOwner || isAdmin) {
            const url = await getPresignedUrl(project.deckKey);
            res.json({ url, expiresIn: 900 });
            return;
        }

        // Investors need an approved DeckRequest
        if (isInvestor) {
            const approvedRequest = await prisma.deckRequest.findUnique({
                where: {
                    projectId_investorId: {
                        projectId: req.params.id,
                        investorId: req.user!.id,
                    },
                },
            });

            if (!approvedRequest || approvedRequest.status !== 'APPROVED') {
                res.status(403).json({
                    error: 'Deck access not approved. Please request access first.',
                    requestStatus: approvedRequest?.status || null,
                });
                return;
            }

            const url = await getPresignedUrl(project.deckKey);
            res.json({ url, expiresIn: 900 });
            return;
        }

        res.status(403).json({ error: 'Only investors can view pitch decks' });
    } catch (error) {
        console.error('Get deck error:', error);
        res.status(500).json({ error: 'Failed to get pitch deck' });
    }
}

/**
 * POST /projects/:id/deck/request
 * Investor requests access to a project's pitch deck.
 */
export async function requestDeckAccess(req: Request, res: Response): Promise<void> {
    try {
        const projectId = req.params.id;
        const investorId = req.user!.id;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true, title: true, deckKey: true },
        });

        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        if (!project.deckKey) { res.status(404).json({ error: 'No pitch deck available for this project' }); return; }
        if (project.ownerId === investorId) { res.status(400).json({ error: 'You own this project' }); return; }

        const deckRequest = await prisma.deckRequest.create({
            data: {
                projectId,
                investorId,
                message: req.body.message || '',
            },
        });

        // Notify builder
        const investor = await prisma.user.findUnique({
            where: { id: investorId },
            include: { profile: { select: { name: true } } },
        });
        await notifyDeckRequest({
            builderId: project.ownerId,
            investorName: investor?.profile?.name || 'An investor',
            projectTitle: project.title,
            projectId,
            requestId: deckRequest.id,
        });

        res.status(201).json(deckRequest);
    } catch (error: any) {
        if (error?.code === 'P2002') {
            res.status(409).json({ error: 'You have already requested this deck' });
            return;
        }
        console.error('Request deck access error:', error);
        res.status(500).json({ error: 'Failed to request deck access' });
    }
}

/**
 * GET /projects/:id/deck/requests
 * Builder sees pending deck requests for their project.
 */
export async function listDeckRequests(req: Request, res: Response): Promise<void> {
    try {
        const projectId = req.params.id;
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true },
        });

        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        const requests = await prisma.deckRequest.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            include: {
                investor: {
                    select: {
                        id: true, nostrPubkey: true,
                        profile: { select: { name: true, avatar: true, company: true, title: true } },
                    },
                },
            },
        });

        res.json({ data: requests });
    } catch (error) {
        console.error('List deck requests error:', error);
        res.status(500).json({ error: 'Failed to list deck requests' });
    }
}

/**
 * PUT /projects/:id/deck/requests/:requestId
 * Builder approves or denies a deck request.
 */
export async function reviewDeckRequest(req: Request, res: Response): Promise<void> {
    try {
        const { id: projectId, requestId } = req.params;
        const { status } = req.body;

        if (!['APPROVED', 'DENIED'].includes(status)) {
            res.status(400).json({ error: 'Status must be APPROVED or DENIED' }); return;
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { ownerId: true, title: true },
        });

        if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
        if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        const deckRequest = await prisma.deckRequest.update({
            where: { id: requestId },
            data: { status, reviewedAt: new Date() },
        });

        // Notify investor
        if (status === 'APPROVED') {
            await notifyDeckApproved({
                investorId: deckRequest.investorId,
                projectTitle: project.title,
                projectId,
            });
        } else {
            await notifyDeckDenied({
                investorId: deckRequest.investorId,
                projectTitle: project.title,
                projectId,
            });
        }

        res.json(deckRequest);
    } catch (error) {
        console.error('Review deck request error:', error);
        res.status(500).json({ error: 'Failed to review deck request' });
    }
}
