import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listListings,
    getListing,
    createListing,
    createDirectoryListingSchema,
    updateListing,
    updateDirectoryListingSchema,
    deleteListing,
    endorseListing,
    endorseSchema,
    removeEndorsement,
} from '../controllers/directory.controller';

const router = Router();

// Public routes
router.get('/', optionalAuth, listListings);
router.get('/:id', optionalAuth, getListing);

// Member routes
router.post('/', authenticate, validate(createDirectoryListingSchema), createListing);
router.put('/:id', authenticate, validate(updateDirectoryListingSchema), updateListing);
router.delete('/:id', authenticate, deleteListing);
router.post('/:id/endorse', authenticate, validate(endorseSchema), endorseListing);
router.delete('/:id/endorse', authenticate, removeEndorsement);

export default router;
