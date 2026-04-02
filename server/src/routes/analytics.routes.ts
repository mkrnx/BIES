import { Router } from 'express';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth';
import {
    recordProjectView,
    getBuilderDashboard,
    getInvestorDashboard,
    getProjectAnalytics,
    getPlatformStats,
} from '../controllers/analytics.controller';

const router = Router();

// View tracking (public with optional auth)
router.post('/view/:projectId', optionalAuth, recordProjectView);

// Protected analytics
router.get('/dashboard', authenticate, requireRole('BUILDER'), getBuilderDashboard);
router.get('/investor-dashboard', authenticate, requireRole('INVESTOR'), getInvestorDashboard);
router.get('/project/:id', authenticate, getProjectAnalytics);
router.get('/platform', authenticate, requireRole('ADMIN'), getPlatformStats);

export default router;
