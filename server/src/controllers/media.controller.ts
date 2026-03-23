import { Request, Response } from 'express';
import { fetchSubstackFeed, fetchYouTubeFeed } from '../services/media.service';

/**
 * GET /api/media/substack
 * Fetch Substack feed (blog posts)
 */
export async function getSubstackFeed(req: Request, res: Response) {
    try {
        const items = await fetchSubstackFeed();
        res.json({ data: items });
    } catch (error: any) {
        console.error('[Media] Error in getSubstackFeed:', error.message);
        res.status(500).json({ error: 'Failed to fetch Substack feed' });
    }
}

/**
 * GET /api/media/youtube
 * Fetch YouTube feed (videos)
 */
export async function getYouTubeFeed(req: Request, res: Response) {
    try {
        const items = await fetchYouTubeFeed();
        res.json({ data: items });
    } catch (error: any) {
        console.error('[Media] Error in getYouTubeFeed:', error.message);
        res.status(500).json({ error: 'Failed to fetch YouTube feed' });
    }
}
