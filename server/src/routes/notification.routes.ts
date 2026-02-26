import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    listNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
