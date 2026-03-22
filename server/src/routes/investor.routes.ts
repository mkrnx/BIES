import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requestInvestorRole } from '../controllers/investor.controller';

const router = Router();

router.post('/request', authenticate, requestInvestorRole);

export default router;
