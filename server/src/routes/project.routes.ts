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
} from '../controllers/project.controller';

const router = Router();

// Public routes
router.get('/', optionalAuth, listProjects);
router.get('/:id', optionalAuth, getProject);

// Protected routes
router.post('/', authenticate, validate(createProjectSchema), createProject);
router.put('/:id', authenticate, validate(updateProjectSchema), updateProject);
router.delete('/:id', authenticate, deleteProject);
router.get('/:id/deck', authenticate, getProjectDeck);
router.post('/:id/updates', authenticate, postProjectUpdate);

export default router;
