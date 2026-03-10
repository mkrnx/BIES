/**
 * Admin controller — platform moderation and management.
 * All routes require role = ADMIN or MOD.
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { cache } from '../services/redis.service';
import { broadcast } from '../services/websocket.service';
import { removeFromRelayWhitelist, addToRelayWhitelist } from './auth.controller';
import { isAdminPubkey } from '../middleware/auth';

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

        // Only admins can ban other admins or mods
        const targetUser = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { role: true },
        });
        if ((targetUser?.role === 'ADMIN' || targetUser?.role === 'MOD') && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can ban other admins or mods' }); return;
        }

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { isBanned: banned },
            select: { id: true, email: true, nostrPubkey: true, isBanned: true },
        });

        // Update relay whitelist: remove on ban, restore on unban
        if (banned) {
            removeFromRelayWhitelist(user.nostrPubkey);
        } else {
            addToRelayWhitelist(user.nostrPubkey);
        }

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
        if (!['BUILDER', 'INVESTOR', 'MOD', 'ADMIN'].includes(role)) {
            res.status(400).json({ error: 'Invalid role' }); return;
        }

        // Only admins can promote/demote to MOD or ADMIN, or demote existing admins/mods
        const targetUser = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { role: true },
        });
        const isPrivilegedRole = (r: string) => r === 'ADMIN' || r === 'MOD';
        if ((isPrivilegedRole(role) || isPrivilegedRole(targetUser?.role || '')) && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Only admins can promote or demote admins and mods' }); return;
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

// ─── Admin Project Management ────────────────────────────────────────────────

/**
 * GET /admin/projects
 * List projects with optional status filter, search, and pagination.
 */
export async function listAdminProjects(req: Request, res: Response): Promise<void> {
    try {
        const { status, search, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const where: any = {};
        if (status && typeof status === 'string') where.status = status;
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
            ];
        }

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    owner: {
                        select: {
                            id: true, email: true,
                            profile: { select: { name: true, avatar: true } },
                        },
                    },
                },
            }),
            prisma.project.count({ where }),
        ]);

        const parsed = projects.map((p) => ({
            ...p,
            tags: JSON.parse(p.tags || '[]'),
        }));

        res.json({
            data: parsed,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('Admin list projects error:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
}

/**
 * PUT /admin/projects/:id/review
 * Approve or reject a project submission.
 * Body: { action: 'approve' | 'reject' }
 */
export async function reviewProject(req: Request, res: Response): Promise<void> {
    try {
        const { action } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            res.status(400).json({ error: 'action must be "approve" or "reject"' }); return;
        }

        const data: any = action === 'approve'
            ? { status: 'active', isPublished: true }
            : { status: 'draft', isPublished: false };

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data,
            select: { id: true, title: true, status: true, ownerId: true },
        });

        await cache.delPattern('projects:');

        // Notify project owner
        await prisma.notification.create({
            data: {
                userId: project.ownerId,
                type: 'SYSTEM',
                title: action === 'approve' ? 'Project Approved' : 'Project Not Approved',
                body: action === 'approve'
                    ? `Your project "${project.title}" has been approved and is now live on the Discover page.`
                    : `Your project "${project.title}" was not approved for the Discover page. Please review and resubmit.`,
                data: JSON.stringify({ projectId: project.id }),
            },
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: action === 'approve' ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
                resource: `project:${req.params.id}`,
                metadata: JSON.stringify({ projectTitle: project.title }),
            },
        });

        res.json(project);
    } catch (error) {
        console.error('Review project error:', error);
        res.status(500).json({ error: 'Failed to review project' });
    }
}

// ─── Admin Event Management ─────────────────────────────────────────────────

/**
 * GET /admin/events
 * List all events (including unpublished) with pagination.
 */
export async function listAdminEvents(req: Request, res: Response): Promise<void> {
    try {
        const { search, category, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const where: any = {};
        if (category && typeof category === 'string') where.category = category.toUpperCase();
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
            ];
        }

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                skip,
                take,
                orderBy: { startDate: 'desc' },
                include: {
                    host: {
                        select: {
                            id: true, email: true,
                            profile: { select: { name: true } },
                        },
                    },
                    _count: { select: { attendees: true } },
                },
            }),
            prisma.event.count({ where }),
        ]);

        const parsed = events.map((e) => ({
            ...e,
            tags: JSON.parse(e.tags || '[]'),
        }));

        res.json({
            data: parsed,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('Admin list events error:', error);
        res.status(500).json({ error: 'Failed to list events' });
    }
}

/**
 * PUT /admin/events/:id/feature
 * Feature or unfeature an event.
 */
export async function featureEvent(req: Request, res: Response): Promise<void> {
    try {
        const { featured } = req.body;
        if (typeof featured !== 'boolean') {
            res.status(400).json({ error: '"featured" must be a boolean' }); return;
        }

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { isFeatured: featured },
        });

        await cache.delPattern('events:');

        res.json({ id: event.id, isFeatured: event.isFeatured });
    } catch (error) {
        console.error('Feature event error:', error);
        res.status(500).json({ error: 'Failed to feature event' });
    }
}
