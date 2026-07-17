import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    register,
    registerSchema,
    login,
    loginSchema,
    nostrLogin,
    getNostrChallenge,
    getMe,
    logout,
} from '../controllers/auth.controller';

const router = Router();

// Public routes
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/nostr-challenge', getNostrChallenge);
router.post('/nostr-login', nostrLogin);

// Protected routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
