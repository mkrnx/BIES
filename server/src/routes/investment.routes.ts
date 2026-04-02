import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listInvestments,
    getInvestment,
    createInvestment,
    createInvestmentSchema,
    updateInvestment,
    updateInvestmentSchema,
    getProjectFundingStats,
} from '../controllers/investment.controller';

const router = Router();

router.use(authenticate);

router.get('/', listInvestments);
router.get('/stats/:projectId', getProjectFundingStats);
router.get('/:id', getInvestment);
router.post('/', requireRole('INVESTOR'), validate(createInvestmentSchema), createInvestment);
router.put('/:id', validate(updateInvestmentSchema), updateInvestment);

export default router;
