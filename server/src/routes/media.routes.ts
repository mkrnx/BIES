import { Router } from 'express';
import { getSubstackFeed, getYouTubeFeed } from '../controllers/media.controller';

const router = Router();

/**
 * GET /api/media/substack
 * Fetch Substack feed (public)
 */
router.get('/substack', getSubstackFeed);

/**
 * GET /api/media/youtube
 * Fetch YouTube feed (public)
 */
router.get('/youtube', getYouTubeFeed);

export default router;
