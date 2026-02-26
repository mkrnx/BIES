import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    listConversations,
    getThread,
    sendMessage,
    sendMessageSchema,
    deleteMessage,
    getUnreadCount,
} from '../controllers/message.controller';

const router = Router();

// All message routes require authentication
router.use(authenticate);

router.get('/conversations', listConversations);
router.get('/unread-count', getUnreadCount);
router.get('/:partnerId', getThread);
router.post('/', validate(sendMessageSchema), sendMessage);
router.delete('/:id', deleteMessage);

export default router;
