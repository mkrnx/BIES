/**
 * Points API routes — gamification read surface (§B5).
 * Admin mutations (adjust/recompute/badge grant+revoke) live in admin.routes.ts.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    getLeaderboard,
    getMyPoints,
    getUserPoints,
    getBadgeCatalog,
    getMonthSnapshot,
} from '../controllers/points.controller';

const router = Router();

router.use(authenticate);

router.get('/leaderboard', getLeaderboard);
router.get('/me', getMyPoints);
router.get('/badges', getBadgeCatalog);
router.get('/months/:month', getMonthSnapshot);
router.get('/user/:pubkey', getUserPoints);

export default router;
