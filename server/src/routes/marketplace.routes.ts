import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

// Publish/delete sign with the custodial key and broadcast to PUBLIC relays —
// throttle so a compromised account can't spam the wider Nostr network.
// 30/hour covers create + edit + mark-sold flows comfortably.
const publishLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    message: { error: 'Too many publish requests, please try again later' },
});

// Public routes
router.get('/blocklist', getBlocklist);

// Member routes (custodial-key publish; Nostr-native users sign client-side)
router.post('/publish', publishLimiter, authenticate, validate(publishListingSchema), publishListing);
router.post('/delete', publishLimiter, authenticate, validate(deleteListingSchema), deleteListing);

// Moderation routes (MOD or admin)
router.post('/blocklist', authenticate, requireRole('MOD'), validate(blockSchema), addBlock);
router.delete('/blocklist/:id', authenticate, requireRole('MOD'), removeBlock);

export default router;
