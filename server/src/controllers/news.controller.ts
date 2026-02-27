import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache, TTL } from '../services/redis.service';

/**
 * GET /news/stories
 * Curated news items — articles filtered by NEWS/GUIDE/TUTORIAL categories.
 */
export async function getNewsStories(req: Request, res: Response): Promise<void> {
    try {
        const { category, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const cKey = `news:stories:${category || 'all'}:${page}:${limit}`;
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }

        const where: any = { isPublished: true };
        if (category && typeof category === 'string') {
            where.category = category.toUpperCase();
        } else {
            where.category = { in: ['NEWS', 'GUIDE', 'TUTORIAL'] };
        }

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, title: true, slug: true, excerpt: true,
                    category: true, thumbnail: true, authorName: true,
                    tags: true, createdAt: true,
                },
            }),
            prisma.article.count({ where }),
        ]);

        const result = {
            data: articles.map((a) => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        };

        await cache.setJson(cKey, result, TTL.CONTENT_LIST);
        res.json(result);
    } catch (error) {
        console.error('News stories error:', error);
        res.status(500).json({ error: 'Failed to get news stories' });
    }
}

/**
 * GET /news/bies-updates
 * Platform announcements — articles with category = BIES_UPDATE.
 */
export async function getBiesUpdates(req: Request, res: Response): Promise<void> {
    try {
        const { page = '1', limit = '10' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const cKey = `news:bies_updates:${page}:${limit}`;
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.setHeader('X-Cache', 'HIT'); res.json(cached); return; }

        const where = { isPublished: true, category: 'BIES_UPDATE' };

        const [articles, total] = await Promise.all([
            prisma.article.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.article.count({ where }),
        ]);

        const result = {
            data: articles.map((a) => ({ ...a, tags: JSON.parse(a.tags || '[]') })),
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        };

        await cache.setJson(cKey, result, TTL.CONTENT_LIST);
        res.json(result);
    } catch (error) {
        console.error('BIES updates error:', error);
        res.status(500).json({ error: 'Failed to get BIES updates' });
    }
}
