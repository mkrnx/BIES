import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { cache, TTL, cacheKey } from '../services/redis.service';
import { fetchTweetsByHandles } from '../services/twitter.service';
import { getLiveNewsFeed, filterByKeyword } from '../services/newsfeed.service';

// ─── Validation ──────────────────────────────────────────────────────────────

export const updateSiteSettingsSchema = z.object({
    nostrNpubs: z.array(z.string().startsWith('npub1')).max(50).optional(),
    twitterHandles: z.array(z.string().min(1).max(15)).max(50).optional(),
    livestreamUrl: z.string().url().or(z.literal('')).optional(),
    livestreamActive: z.boolean().optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateSettings() {
    let settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
        settings = await prisma.siteSettings.create({ data: { id: 'default' } });
    }
    return {
        nostrNpubs: JSON.parse(settings.nostrNpubs || '[]'),
        twitterHandles: JSON.parse(settings.twitterHandles || '[]'),
        livestreamUrl: settings.livestreamUrl || '',
        livestreamActive: settings.livestreamActive ?? false,
        updatedAt: settings.updatedAt,
    };
}

// ─── GET /news/settings (public) ─────────────────────────────────────────────

export async function getSiteSettings(req: Request, res: Response): Promise<void> {
    try {
        const cached = await cache.getJson<any>(cacheKey.siteSettings());
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.json(cached);
            return;
        }

        const settings = await getOrCreateSettings();
        await cache.setJson(cacheKey.siteSettings(), settings, TTL.SITE_SETTINGS);
        res.json(settings);
    } catch (error) {
        console.error('Get site settings error:', error);
        res.status(500).json({ error: 'Failed to get site settings' });
    }
}

// ─── PUT /news/settings (admin) ──────────────────────────────────────────────

export async function updateSiteSettings(req: Request, res: Response): Promise<void> {
    try {
        const { nostrNpubs, twitterHandles, livestreamUrl, livestreamActive } = req.body;

        const data: any = {};
        if (nostrNpubs !== undefined) data.nostrNpubs = JSON.stringify(nostrNpubs);
        if (twitterHandles !== undefined) data.twitterHandles = JSON.stringify(twitterHandles);
        if (livestreamUrl !== undefined) data.livestreamUrl = livestreamUrl;
        if (livestreamActive !== undefined) data.livestreamActive = livestreamActive;

        await prisma.siteSettings.upsert({
            where: { id: 'default' },
            update: data,
            create: { id: 'default', ...data },
        });

        // Invalidate caches
        await cache.del(cacheKey.siteSettings());
        await cache.del(cacheKey.twitterFeed());

        const settings = await getOrCreateSettings();
        res.json(settings);
    } catch (error) {
        console.error('Update site settings error:', error);
        res.status(500).json({ error: 'Failed to update site settings' });
    }
}

// ─── GET /news/twitter-feed (public) ─────────────────────────────────────────

export async function getTwitterFeed(req: Request, res: Response): Promise<void> {
    try {
        const settings = await getOrCreateSettings();
        const tweets = await fetchTweetsByHandles(settings.twitterHandles);
        res.json({ data: tweets });
    } catch (error) {
        console.error('Twitter feed error:', error);
        res.status(500).json({ error: 'Failed to get Twitter feed' });
    }
}

// ─── GET /news/live-feed (public) ────────────────────────────────────────────

export async function getLiveNews(req: Request, res: Response): Promise<void> {
    try {
        const { keyword } = req.query;
        let articles = await getLiveNewsFeed();

        // Filter by keyword if provided
        if (keyword && typeof keyword === 'string') {
            articles = filterByKeyword(articles, keyword);
        }

        res.json({ data: articles });
    } catch (error) {
        console.error('Live news feed error:', error);
        res.status(500).json({ error: 'Failed to get live news feed' });
    }
}
