import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listBounties,
    getBounty,
    createBounty,
    createBountySchema,
    submitToBounty,
    updateSubmission,
    bountySubmissionSchema,
    awardBounty,
    awardBountySchema,
    unawardBounty,
    markBountyPaid,
    markPaidSchema,
    cancelBounty,
    mirrorBounty,
    mirrorBountySchema,
    listAdminBounties,
    deleteAdminBounty,
    featureAdminBounty,
    featureBountySchema,
} from '../controllers/bounty.controller';

const router = Router();

// Bounty creation: 10 per hour per IP (creation escrows points / posts to feed)
const createBountyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many bounties created, please try again later' },
});

router.use(authenticate);

router.get('/', listBounties);
router.get('/:id', getBounty);
router.post('/', createBountyLimiter, validate(createBountySchema), createBounty);
router.post('/:id/submissions', validate(bountySubmissionSchema), submitToBounty);
router.put('/:id/submissions', validate(bountySubmissionSchema), updateSubmission);
router.post('/:id/award', validate(awardBountySchema), awardBounty);
router.post('/:id/unaward', unawardBounty);
router.post('/:id/mark-paid', validate(markPaidSchema), markBountyPaid);
router.post('/:id/cancel', cancelBounty);
router.post('/:id/mirror', validate(mirrorBountySchema), mirrorBounty);

export default router;

// Admin routes are mounted separately under /api/admin/bounties
export const adminBountyRouter = Router();
adminBountyRouter.get('/', listAdminBounties);
adminBountyRouter.delete('/:id', deleteAdminBounty);
adminBountyRouter.post('/:id/feature', validate(featureBountySchema), featureAdminBounty);
