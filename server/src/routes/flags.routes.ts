import { Router } from 'express';
import { getFeatureFlags } from '../controllers/featureFlags.controller';

const router = Router();

// Public, cached, tiny payload — the client fetches this at boot (pre-auth)
// and on window focus. Never feature-gated (the app must always be able to
// learn which features are off). The admin write lives at PUT /api/admin/flags.
router.get('/', getFeatureFlags);

export default router;
