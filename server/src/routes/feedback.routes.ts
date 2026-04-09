import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    submitFeedback,
    submitFeedbackSchema,
    listFeedback,
    updateFeedback,
    deleteFeedback,
} from '../controllers/feedback.controller';

const router = Router();

// Authenticated user submits feedback
router.post('/', authenticate, validate(submitFeedbackSchema), submitFeedback);

export default router;

// Admin routes are mounted separately under /api/admin/feedback
export const adminFeedbackRouter = Router();
adminFeedbackRouter.get('/', listFeedback);
adminFeedbackRouter.put('/:id', updateFeedback);
adminFeedbackRouter.delete('/:id', deleteFeedback);
