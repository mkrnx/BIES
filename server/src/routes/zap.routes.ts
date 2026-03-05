import { Router } from 'express';
import { optionalAuth } from '../middleware/auth';
import {
    getProjectZaps,
    getUserZaps,
    getProjectZapStats,
} from '../controllers/zap.controller';

const router = Router();

// Zap data is public — use optionalAuth for potential future filtering
router.get('/project/:projectId', optionalAuth, getProjectZaps);
router.get('/user/:pubkey', optionalAuth, getUserZaps);
router.get('/stats/:projectId', optionalAuth, getProjectZapStats);

export default router;
