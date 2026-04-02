import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    getSettings,
    updateNotificationSettings,
    updateNotificationSettingsSchema,
    updateRelays,
    updateRelaysSchema,
    getMediaRead,
    updateMediaRead,
    updateMediaReadSchema,
    deleteAccount,
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.put('/notifications', validate(updateNotificationSettingsSchema), updateNotificationSettings);
router.put('/relays', validate(updateRelaysSchema), updateRelays);
router.get('/media-read', getMediaRead);
router.put('/media-read', validate(updateMediaReadSchema), updateMediaRead);
router.delete('/account', deleteAccount);

export default router;
