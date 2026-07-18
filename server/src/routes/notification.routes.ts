import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listNotifications,
    getUnreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    feedInteraction,
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
    registerDeviceToken,
    unregisterDeviceToken,
    registerDeviceTokenSchema,
} from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

// Push subscription routes (must be before /:id param routes)
router.get('/push/vapid-key', getVapidPublicKey);
router.post('/push/subscribe', subscribePush);
router.delete('/push/subscribe', unsubscribePush);

// Native push (APNs) device token routes
router.post('/device-token', validate(registerDeviceTokenSchema), registerDeviceToken);
router.delete('/device-token', unregisterDeviceToken);

router.get('/', listNotifications);
router.get('/count', getUnreadCount);
router.post('/feed-interaction', feedInteraction);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/:id', deleteNotification);

export default router;
