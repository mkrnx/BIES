/**
 * Admin controller — platform moderation and management.
 * All routes require role = ADMIN.
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache } from '../services/redis.service';
import { broadcast } from '../services/websocket.service';

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /admin/users
 * List all users with filtering and pagination.
 */
export async function listUsers(req: Request, res: Response): Promise<void> {
    try {
        const { role, search, banned, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const where: any = {};
        if (role && typeof role === 'string') where.role = role.toUpperCase();
        if (banned !== undefined) where.isBanned = banned === 'true';
        if (search && typeof search === 'string') {
            where.OR = [
                { email: { contains: search } },
                { profile: { name: { contains: search } } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, email: true, nostrPubkey: true, role: true,
                    isVerified: true, isBanned: true, createdAt: true,
                    profile: { select: { name: true, avatar: true, company: true } },
                    _count: { select: { projects: true, investments: true } },
                },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            data: users,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('Admin list users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
}

/**
 * PUT /admin/users/:id/ban
 * Ban or unban a user.
 */
export async function banUser(req: Request, res: Response): Promise<void> {
    try {
        const { banned } = req.body;
        if (typeof banned !== 'boolean') {
            res.status(400).json({ error: '"banned" must be a boolean' }); return;
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { isBanned: banned },
            select: { id: true, email: true, isBanned: true },
        });

        // Log the action
        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: banned ? 'USER_BANNED' : 'USER_UNBANNED',
                resource: `user:${req.params.id}`,
                metadata: JSON.stringify({ targetUserId: req.params.id }),
            },
        });

        res.json(user);
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: 'Failed to update user ban status' });
    }
}

/**
 * PUT /admin/users/:id/role
 * Change a user's role (including making admin).
 */
export async function setUserRole(req: Request, res: Response): Promise<void> {
    try {
        const { role } = req.body;
        if (!['BUILDER', 'INVESTOR', 'ADMIN'].includes(role)) {
            res.status(400).json({ error: 'Invalid role' }); return;
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { role },
            select: { id: true, email: true, role: true },
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'USER_ROLE_CHANGED',
                resource: `user:${req.params.id}`,
                metadata: JSON.stringify({ newRole: role }),
            },
        });

        res.json(user);
    } catch (error) {
        console.error('Set role error:', error);
        res.status(500).json({ error: 'Failed to set user role' });
    }
}

/**
 * PUT /admin/users/:id/verify
 * Mark a user as verified (KYC approved).
 */
export async function verifyUser(req: Request, res: Response): Promise<void> {
    try {
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { isVerified: true },
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'USER_VERIFIED',
                resource: `user:${req.params.id}`,
                metadata: '{}',
            },
        });

        res.json({ id: user.id, isVerified: user.isVerified });
    } catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({ error: 'Failed to verify user' });
    }
}

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * PUT /admin/projects/:id/feature
 * Feature or unfeature a project on the homepage.
 */
export async function featureProject(req: Request, res: Response): Promise<void> {
    try {
        const { featured } = req.body;
        if (typeof featured !== 'boolean') {
            res.status(400).json({ error: '"featured" must be a boolean' }); return;
        }

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: { isFeatured: featured },
        });

        await cache.delPattern('projects:');

        res.json({ id: project.id, isFeatured: project.isFeatured });
    } catch (error) {
        console.error('Feature project error:', error);
        res.status(500).json({ error: 'Failed to feature project' });
    }
}

/**
 * DELETE /admin/projects/:id
 * Hard delete a project (admin only).
 */
export async function hardDeleteProject(req: Request, res: Response): Promise<void> {
    try {
        await prisma.project.delete({ where: { id: req.params.id } });
        await cache.delPattern('projects:');

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'PROJECT_HARD_DELETED',
                resource: `project:${req.params.id}`,
                metadata: '{}',
            },
        });

        res.json({ message: 'Project permanently deleted' });
    } catch (error) {
        console.error('Hard delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

/**
 * GET /admin/audit-logs
 * View the audit log.
 */
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
        const { userId, action, page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const where: any = {};
        if (userId) where.userId = userId;
        if (action && typeof action === 'string') where.action = { contains: action };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true, email: true,
                            profile: { select: { name: true } },
                        },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            data: logs.map((l) => ({ ...l, metadata: JSON.parse(l.metadata || '{}') })),
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('Audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
}

// ─── System ───────────────────────────────────────────────────────────────────

/**
 * POST /admin/broadcast
 * Send a system-wide message to all connected WebSocket clients.
 */
export async function broadcastMessage(req: Request, res: Response): Promise<void> {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            res.status(400).json({ error: 'Message required' }); return;
        }

        broadcast({ type: 'system_announcement', message });
        res.json({ message: 'Broadcast sent' });
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Failed to broadcast' });
    }
}

/**
 * POST /admin/cache/clear
 * Clear all caches (use after bulk data migrations).
 */
export async function clearCache(req: Request, res: Response): Promise<void> {
    try {
        const { pattern = '' } = req.body;
        if (pattern) {
            await cache.delPattern(pattern);
        } else {
            // Clear all common prefixes
            await Promise.all([
                cache.delPattern('projects:'),
                cache.delPattern('profiles:'),
                cache.delPattern('events:'),
                cache.delPattern('search:'),
                cache.delPattern('analytics:'),
                cache.delPattern('notif_count:'),
            ]);
        }
        res.json({ message: 'Cache cleared' });
    } catch (error) {
        console.error('Clear cache error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
}
