import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listProfiles,
    getProfile,
    getMyProfile,
    updateMyProfile,
    updateProfileSchema,
} from '../controllers/profile.controller';
import {
    followUser,
    unfollowUser,
    getFollowers,
    getFollowing,
} from '../controllers/follow.controller';

const router = Router();

// /me routes MUST come before /:id to avoid being swallowed as an id param
router.get('/me', authenticate, getMyProfile);
router.put('/me', authenticate, validate(updateProfileSchema), updateMyProfile);

// Follow routes (before generic /:id)
router.post('/:id/follow', authenticate, followUser);
router.delete('/:id/follow', authenticate, unfollowUser);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

// Public routes
router.get('/', listProfiles);
router.get('/:id', optionalAuth, getProfile);

export default router;
