import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listProfiles,
    getProfile,
    getMyProfile,
    updateMyProfile,
    updateProfileSchema,
} from '../controllers/profile.controller';

const router = Router();

// ⚠️  /me routes MUST come before /:id to avoid being swallowed as an id param
router.get('/me', authenticate, getMyProfile);
router.put('/me', authenticate, validate(updateProfileSchema), updateMyProfile);

// Public routes
router.get('/', listProfiles);
router.get('/:id', getProfile);

export default router;
