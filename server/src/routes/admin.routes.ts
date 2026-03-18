import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
    listUsers,
    banUser,
    setUserRole,
    verifyUser,
    deleteUser,
    listTrashedUsers,
    restoreUser,
    purgeUser,
    syncAccounts,
    featureProject,
    hardDeleteProject,
    listAdminProjects,
    reviewProject,
    listAdminEvents,
    featureEvent,
    getAuditLogs,
    broadcastMessage,
    clearCache,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require ADMIN or MOD role
router.use(authenticate, requireRole('ADMIN', 'MOD'));

// Users
router.get('/users', listUsers);
router.get('/users/trash', listTrashedUsers);           // ADMIN only (enforced in controller)
router.put('/users/:id/ban', banUser);
router.put('/users/:id/role', setUserRole);
router.put('/users/:id/verify', verifyUser);
router.put('/users/:id/restore', restoreUser);          // ADMIN only (enforced in controller)
router.delete('/users/:id', deleteUser);                // ADMIN only (enforced in controller)
router.delete('/users/:id/purge', purgeUser);           // ADMIN only (enforced in controller)
router.post('/users/sync', syncAccounts);               // ADMIN only (enforced in controller)

// Projects
router.get('/projects', listAdminProjects);
router.put('/projects/:id/feature', featureProject);
router.put('/projects/:id/review', reviewProject);
router.delete('/projects/:id', hardDeleteProject);

// Events
router.get('/events', listAdminEvents);
router.put('/events/:id/feature', featureEvent);

// Audit & System
router.get('/audit-logs', getAuditLogs);
router.post('/broadcast', broadcastMessage);
router.post('/cache/clear', clearCache);

export default router;
