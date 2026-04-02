import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getProjectMatches, getInvestorRecommendations } from '../controllers/match.controller';

const router = Router();

// Builder sees matched investors for their project
router.get('/projects/:id/matches', authenticate, getProjectMatches);

// Investor sees recommended projects
router.get('/investors/recommendations', authenticate, requireRole('INVESTOR'), getInvestorRecommendations);

export default router;
