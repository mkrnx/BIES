import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
    listUsers,
    banUser,
    setUserRole,
    verifyUser,
    featureProject,
    hardDeleteProject,
    getAuditLogs,
    broadcastMessage,
    clearCache,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require ADMIN role
router.use(authenticate, requireRole('ADMIN'));

// Users
router.get('/users', listUsers);
router.put('/users/:id/ban', banUser);
router.put('/users/:id/role', setUserRole);
router.put('/users/:id/verify', verifyUser);

// Projects
router.put('/projects/:id/feature', featureProject);
router.delete('/projects/:id', hardDeleteProject);

// Audit & System
router.get('/audit-logs', getAuditLogs);
router.post('/broadcast', broadcastMessage);
router.post('/cache/clear', clearCache);

export default router;
