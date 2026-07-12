import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    publishListing,
    publishListingSchema,
    deleteListing,
    deleteListingSchema,
    getBlocklist,
    addBlock,
    blockSchema,
    removeBlock,
} from '../controllers/marketplace.controller';

const router = Router();

// Public routes
router.get('/blocklist', getBlocklist);

// Member routes (custodial-key publish; Nostr-native users sign client-side)
router.post('/publish', authenticate, validate(publishListingSchema), publishListing);
router.post('/delete', authenticate, validate(deleteListingSchema), deleteListing);

// Moderation routes
router.post('/blocklist', authenticate, requireRole('MOD'), validate(blockSchema), addBlock);
router.delete('/blocklist/:id', authenticate, requireRole('MOD'), removeBlock);

export default router;
