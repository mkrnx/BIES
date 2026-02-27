import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    getSettings,
    updateNotificationSettings,
    updateNotificationSettingsSchema,
    updateRelays,
    updateRelaysSchema,
    deleteAccount,
} from '../controllers/settings.controller';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.put('/notifications', validate(updateNotificationSettingsSchema), updateNotificationSettings);
router.put('/relays', validate(updateRelaysSchema), updateRelays);
router.delete('/account', deleteAccount);

export default router;
