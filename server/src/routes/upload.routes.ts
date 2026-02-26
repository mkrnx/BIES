import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { uploadMiddleware, uploadMedia, uploadDeck } from '../controllers/upload.controller';

const router = Router();

// All upload routes require authentication
router.post('/media', authenticate, uploadMiddleware, uploadMedia);
router.post('/deck', authenticate, uploadMiddleware, uploadDeck);

export default router;
