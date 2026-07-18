import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { featureGate } from '../middleware/featureGate';
import { getNewsStories, getBiesUpdates } from '../controllers/news.controller';
import {
    getSiteSettings,
    updateSiteSettings,
    updateSiteSettingsSchema,
    getTwitterFeed,
    getLiveNews,
} from '../controllers/siteSettings.controller';

const router = Router();

// The `news` feature gate is applied per-endpoint (NOT on the whole prefix):
// `/settings` must stay reachable while news is off because the Media page
// (livestream config) and the admin news panel both depend on it.

// Existing news endpoints
router.get('/stories', featureGate('news'), getNewsStories);
router.get('/bies-updates', featureGate('news'), getBiesUpdates);

// Site settings (public read, admin write) — never feature-gated
router.get('/settings', getSiteSettings);
router.put('/settings', authenticate, requireRole('ADMIN'), validate(updateSiteSettingsSchema), updateSiteSettings);

// Twitter feed proxy (public)
router.get('/twitter-feed', featureGate('news'), getTwitterFeed);

// Live news feed from gnews.io + RSS (public)
router.get('/live-feed', featureGate('news'), getLiveNews);

export default router;
