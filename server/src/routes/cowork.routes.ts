import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listVenues,
    addVenue,
    addVenueSchema,
    listSessions,
    createSession,
    createSessionSchema,
    getSession,
    joinSession,
    leaveSession,
    endSession,
} from '../controllers/cowork.controller';

const router = Router();

// Venues (static — register before '/sessions/:id')
router.get('/venues', authenticate, listVenues);
router.post('/venues', authenticate, validate(addVenueSchema), addVenue);

// Sessions collection
router.get('/sessions', authenticate, listSessions);
router.post('/sessions', authenticate, validate(createSessionSchema), createSession);

// Single session + membership (static segments after ':id')
router.get('/sessions/:id', authenticate, getSession);
router.post('/sessions/:id/join', authenticate, joinSession);
router.delete('/sessions/:id/join', authenticate, leaveSession);
router.post('/sessions/:id/end', authenticate, endSession);

export default router;
