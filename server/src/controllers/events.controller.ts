/**
 * Events controller — community events (meetups, hackathons, demo days).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { cache, cacheKey, TTL } from '../services/redis.service';

// ─── Validation ───────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    category: z.enum(['NETWORKING', 'CONFERENCE', 'WORKSHOP', 'HACKATHON', 'MEETUP', 'DEMO_DAY', 'OTHER']).default('NETWORKING'),
    location: z.string().optional(),
    isOnline: z.boolean().default(false),
    onlineUrl: z.string().url().optional().or(z.literal('')),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().optional(),
    thumbnail: z.string().url().optional().or(z.literal('')),
    maxAttendees: z.number().positive().int().optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
});

export const updateEventSchema = createEventSchema.partial();

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /events
 * List upcoming events with filters.
 */
export async function listEvents(req: Request, res: Response): Promise<void> {
    try {
        const { category, upcoming, search, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const cKey = cacheKey.events({ category: category as string || '', upcoming: upcoming as string || '', page: page as string, limit: limit as string });
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.json(cached); return; }

        const where: any = { isPublished: true };

        if (category && typeof category === 'string') {
            where.category = category.toUpperCase();
        }
        if (upcoming === 'true') {
            where.startDate = { gte: new Date() };
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } },
                { location: { contains: search } },
            ];
        }

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                orderBy: { startDate: 'asc' },
                skip,
                take,
                include: {
                    host: {
                        select: {
                            id: true, nostrPubkey: true,
                            profile: { select: { name: true, avatar: true, company: true } },
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
            attendeeCount: e._count.attendees,
        }));

        const result = {
            data: parsed,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        };

        await cache.setJson(cKey, result, TTL.EVENT_LIST);
        res.json(result);
    } catch (error) {
        console.error('List events error:', error);
        res.status(500).json({ error: 'Failed to list events' });
    }
}

/**
 * GET /events/:id
 * Get a single event with attendee info.
 */
export async function getEvent(req: Request, res: Response): Promise<void> {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: {
                host: {
                    select: {
                        id: true, nostrPubkey: true,
                        profile: { select: { name: true, avatar: true, company: true } },
                    },
                },
                attendees: {
                    take: 20,
                    orderBy: { joinedAt: 'asc' },
                    include: {
                        // Using a raw join isn't straightforward; we'll include via event model
                    },
                },
                _count: { select: { attendees: true } },
            },
        });

        if (!event || !event.isPublished) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        res.json({
            ...event,
            tags: JSON.parse(event.tags || '[]'),
            attendeeCount: event._count.attendees,
        });
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ error: 'Failed to get event' });
    }
}

/**
 * POST /events
 * Create a new event.
 */
export async function createEvent(req: Request, res: Response): Promise<void> {
    try {
        // Explicitly pick allowed fields — never allow isPublished, isFeatured, hostId, etc.
        const allowedFields = ['title', 'description', 'category', 'location', 'isOnline', 'onlineUrl', 'startDate', 'endDate', 'thumbnail', 'maxAttendees', 'tags'];
        const data: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }
        if (data.tags) data.tags = JSON.stringify(data.tags);
        if (data.startDate) data.startDate = new Date(data.startDate);
        if (data.endDate) data.endDate = new Date(data.endDate);

        const event = await prisma.event.create({
            data: { ...data, hostId: req.user!.id, isPublished: false },
            include: {
                host: {
                    select: {
                        id: true,
                        profile: { select: { name: true, avatar: true } },
                    },
                },
            },
        });

        await cache.delPattern('events:');

        res.status(201).json({ ...event, tags: JSON.parse(event.tags || '[]') });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
}

/**
 * PUT /events/:id
 * Update an event (host only).
 */
export async function updateEvent(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.event.findUnique({
            where: { id: req.params.id },
            select: { hostId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }
        if (existing.hostId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        // Explicitly pick allowed fields — never allow isPublished, isFeatured, hostId, etc.
        const allowedFields = ['title', 'description', 'category', 'location', 'isOnline', 'onlineUrl', 'startDate', 'endDate', 'thumbnail', 'maxAttendees', 'tags'];
        const data: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        }
        if (data.tags) data.tags = JSON.stringify(data.tags);
        if (data.startDate) data.startDate = new Date(data.startDate);
        if (data.endDate) data.endDate = new Date(data.endDate);

        const event = await prisma.event.update({ where: { id: req.params.id }, data });
        await cache.delPattern('events:');

        res.json({ ...event, tags: JSON.parse(event.tags || '[]') });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
}

/**
 * DELETE /events/:id
 * Delete an event (host or admin).
 */
export async function deleteEvent(req: Request, res: Response): Promise<void> {
    try {
        const existing = await prisma.event.findUnique({
            where: { id: req.params.id },
            select: { hostId: true },
        });

        if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }
        if (existing.hostId !== req.user!.id && req.user!.role !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        await prisma.event.delete({ where: { id: req.params.id } });
        await cache.delPattern('events:');

        res.json({ message: 'Event deleted' });
    } catch (error) {
        console.error('Delete event error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
}

/**
 * POST /events/:id/rsvp
 * RSVP to an event.
 */
export async function rsvpEvent(req: Request, res: Response): Promise<void> {
    try {
        const userId = req.user!.id;
        const { status = 'GOING' } = req.body;

        // Validate RSVP status against allowed values
        const validStatuses = ['GOING', 'INTERESTED', 'NOT_GOING'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` }); return;
        }

        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            select: { maxAttendees: true, isPublished: true, _count: { select: { attendees: true } } },
        });

        if (!event || !event.isPublished) {
            res.status(404).json({ error: 'Event not found' }); return;
        }

        // Enforce max attendee limit for GOING status
        if (status === 'GOING' && event.maxAttendees && event._count.attendees >= event.maxAttendees) {
            // Check if user is already an attendee (updating their status is OK)
            const existing = await prisma.eventAttendee.findUnique({
                where: { eventId_userId: { eventId: req.params.id, userId } },
            });
            if (!existing) {
                res.status(409).json({ error: 'Event is at full capacity' }); return;
            }
        }

        const attendee = await prisma.eventAttendee.upsert({
            where: { eventId_userId: { eventId: req.params.id, userId } },
            update: { status },
            create: { eventId: req.params.id, userId, status },
        });

        res.json(attendee);
    } catch (error) {
        console.error('RSVP error:', error);
        res.status(500).json({ error: 'Failed to RSVP' });
    }
}

/**
 * DELETE /events/:id/rsvp
 * Cancel RSVP.
 */
export async function cancelRsvp(req: Request, res: Response): Promise<void> {
    try {
        await prisma.eventAttendee.deleteMany({
            where: { eventId: req.params.id, userId: req.user!.id },
        });
        res.json({ message: 'RSVP cancelled' });
    } catch (error) {
        console.error('Cancel RSVP error:', error);
        res.status(500).json({ error: 'Failed to cancel RSVP' });
    }
}
