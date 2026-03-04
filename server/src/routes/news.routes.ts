import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getNewsStories, getBiesUpdates } from '../controllers/news.controller';
import {
    getSiteSettings,
    updateSiteSettings,
    updateSiteSettingsSchema,
    getTwitterFeed,
} from '../controllers/siteSettings.controller';

const router = Router();

// Existing news endpoints
router.get('/stories', getNewsStories);
router.get('/bies-updates', getBiesUpdates);

// Site settings (public read, admin write)
router.get('/settings', getSiteSettings);
router.put('/settings', authenticate, requireRole('ADMIN'), validate(updateSiteSettingsSchema), updateSiteSettings);

// Twitter feed proxy (public)
router.get('/twitter-feed', getTwitterFeed);

export default router;
