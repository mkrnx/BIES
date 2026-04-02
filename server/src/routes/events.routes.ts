import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listEvents,
    getEvent,
    createEvent,
    createEventSchema,
    updateEvent,
    updateEventSchema,
    deleteEvent,
    listMyEvents,
    listAttendingEvents,
    endorseEvent,
    rsvpEvent,
    cancelRsvp,
} from '../controllers/events.controller';

const router = Router();

// Public routes
router.get('/', optionalAuth, listEvents);

// Protected: my events (must come before /:id to avoid shadowing)
router.get('/my', authenticate, listMyEvents);
router.get('/attending', authenticate, listAttendingEvents);

// Public single event
router.get('/:id', optionalAuth, getEvent);

// Protected routes
router.post('/', authenticate, validate(createEventSchema), createEvent);
router.put('/:id', authenticate, validate(updateEventSchema), updateEvent);
router.delete('/:id', authenticate, deleteEvent);
router.put('/:id/endorse', authenticate, endorseEvent);
router.post('/:id/rsvp', authenticate, rsvpEvent);
router.delete('/:id/rsvp', authenticate, cancelRsvp);

export default router;
