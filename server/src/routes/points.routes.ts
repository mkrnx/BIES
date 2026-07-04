/**
 * Points API routes. Session B3 adds the full surface (leaderboard, badges,
 * user lookups, admin adjust) via points.controller.ts — this file currently
 * exposes the minimal authenticated endpoint so the /api/points mount is real.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

router.use(authenticate);

/** GET /api/points/me — the caller's UserScore (zeros when not yet scored). */
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const score = await prisma.userScore.findUnique({ where: { userId } });

        res.json(
            score ?? {
                userId,
                monthlyPoints: 0,
                lifetimePoints: 0,
                level: 0,
                currentMonth: new Date().toISOString().slice(0, 7),
                lastScoredNoteAt: null,
                streakDays: 0,
                lastActiveDay: null,
                postCount: 0,
                replyCount: 0,
                reactionsGiven: 0,
                reactionsReceived: 0,
                updatedAt: null,
            }
        );
    } catch (error) {
        next(error);
    }
});

export default router;
