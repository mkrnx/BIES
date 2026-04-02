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
    moveProjectOwnership,
    listAdminProjects,
    reviewProject,
    listAdminEvents,
    featureEvent,
    getAuditLogs,
    broadcastMessage,
    clearCache,
    listInvestorRequests,
    reviewInvestorRequest,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require isAdmin flag or MOD role
router.use(authenticate, requireRole('MOD'));

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
router.get('/investor-requests', listInvestorRequests);
router.put('/investor-requests/:id/review', reviewInvestorRequest);

router.get('/projects', listAdminProjects);
router.put('/projects/:id/feature', featureProject);
router.put('/projects/:id/review', reviewProject);
router.put('/projects/:id/owner', moveProjectOwnership);   // ADMIN only (enforced in controller)
router.delete('/projects/:id', hardDeleteProject);

// Events
router.get('/events', listAdminEvents);
router.put('/events/:id/feature', featureEvent);

// Audit & System
router.get('/audit-logs', getAuditLogs);
router.post('/broadcast', broadcastMessage);
router.post('/cache/clear', clearCache);

export default router;
