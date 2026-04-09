import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const VALID_STATUSES = ['NEW', 'IN_REVIEW', 'FIXED', 'WONT_FIX', 'PLANNED', 'DUPLICATE', 'CLOSED'];
const VALID_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export const submitFeedbackSchema = z.object({
    type: z.enum(['BUG', 'FEATURE', 'LOVE', 'GENERAL']).default('GENERAL'),
    message: z.string().min(5, 'Message must be at least 5 characters').max(5000),
});

/**
 * POST /feedback
 * Submit feedback (authenticated users only).
 */
export async function submitFeedback(req: Request, res: Response): Promise<void> {
    try {
        const { type, message } = req.body;

        const feedback = await prisma.feedback.create({
            data: {
                userId: req.user!.id,
                type,
                message,
            },
        });

        res.status(201).json({ message: 'Thank you for your feedback!', id: feedback.id });
    } catch (error) {
        console.error('Feedback submit error:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
}

/**
 * GET /admin/feedback
 * List all feedback with filters (admin only).
 */
export async function listFeedback(req: Request, res: Response): Promise<void> {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 30));
        const type = req.query.type as string || '';
        const status = req.query.status as string || '';
        const priority = req.query.priority as string || '';
        const search = req.query.search as string || '';

        const where: any = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (search) {
            where.OR = [
                { message: { contains: search } },
                { adminNote: { contains: search } },
            ];
        }

        const [data, total, counts] = await Promise.all([
            prisma.feedback.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            nostrPubkey: true,
                            profile: { select: { name: true, avatar: true } },
                        },
                    },
                },
                orderBy: [
                    { priority: 'asc' }, // URGENT first (alphabetical: HIGH, LOW, NORMAL, URGENT — we sort client-side)
                    { createdAt: 'desc' },
                ],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.feedback.count({ where }),
            // Summary counts for the dashboard header
            Promise.all([
                prisma.feedback.count({ where: { status: 'NEW' } }),
                prisma.feedback.count({ where: { status: 'IN_REVIEW' } }),
                prisma.feedback.count({ where: { status: 'FIXED' } }),
                prisma.feedback.count(),
            ]).then(([newCount, inReview, fixed, all]) => ({ new: newCount, inReview, fixed, all })),
        ]);

        res.json({
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            counts,
        });
    } catch (error) {
        console.error('List feedback error:', error);
        res.status(500).json({ error: 'Failed to list feedback' });
    }
}

/**
 * PUT /admin/feedback/:id
 * Update feedback fields — status, priority, adminNote (admin only).
 */
export async function updateFeedback(req: Request, res: Response): Promise<void> {
    try {
        const { id } = req.params;
        const { status, priority, adminNote } = req.body;

        const data: any = {};

        if (status !== undefined) {
            if (!VALID_STATUSES.includes(status)) {
                res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` });
                return;
            }
            data.status = status;
            // Auto-set resolvedAt when marking as resolved
            if (['FIXED', 'WONT_FIX', 'DUPLICATE', 'CLOSED'].includes(status)) {
                data.resolvedAt = new Date();
            } else {
                data.resolvedAt = null;
            }
        }

        if (priority !== undefined) {
            if (!VALID_PRIORITIES.includes(priority)) {
                res.status(400).json({ error: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}` });
                return;
            }
            data.priority = priority;
        }

        if (adminNote !== undefined) {
            data.adminNote = adminNote;
        }

        if (Object.keys(data).length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }

        const feedback = await prisma.feedback.update({
            where: { id },
            data,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        nostrPubkey: true,
                        profile: { select: { name: true, avatar: true } },
                    },
                },
            },
        });

        res.json(feedback);
    } catch (error) {
        console.error('Update feedback error:', error);
        res.status(500).json({ error: 'Failed to update feedback' });
    }
}

/**
 * DELETE /admin/feedback/:id
 * Delete feedback (admin only).
 */
export async function deleteFeedback(req: Request, res: Response): Promise<void> {
    try {
        await prisma.feedback.delete({ where: { id: req.params.id } });
        res.json({ message: 'Feedback deleted' });
    } catch (error) {
        console.error('Delete feedback error:', error);
        res.status(500).json({ error: 'Failed to delete feedback' });
    }
}
