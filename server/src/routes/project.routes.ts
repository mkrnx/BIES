import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listProjects,
    getProject,
    createProject,
    createProjectSchema,
    updateProject,
    updateProjectSchema,
    deleteProject,
    getProjectDeck,
    postProjectUpdate,
    requestDeckAccess,
    deckRequestSchema,
    listDeckRequests,
    reviewDeckRequest,
    submitProject,
    expressInterest,
    listAllDeckRequests,
} from '../controllers/project.controller';

const router = Router();

// Public routes
router.get('/', optionalAuth, listProjects);
router.get('/:id', optionalAuth, getProject);

// Protected routes
router.get('/builder/deck-requests', authenticate, listAllDeckRequests);
router.post('/', authenticate, validate(createProjectSchema), createProject);
router.put('/:id/submit', authenticate, submitProject);
router.put('/:id', authenticate, validate(updateProjectSchema), updateProject);
router.delete('/:id', authenticate, deleteProject);
router.get('/:id/deck', authenticate, getProjectDeck);
router.post('/:id/deck/request', authenticate, validate(deckRequestSchema), requestDeckAccess);
router.get('/:id/deck/requests', authenticate, listDeckRequests);
router.put('/:id/deck/requests/:requestId', authenticate, reviewDeckRequest);
router.post('/:id/interest', authenticate, expressInterest);
router.post('/:id/updates', authenticate, postProjectUpdate);

export default router;
