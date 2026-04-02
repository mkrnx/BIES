/**
 * Events controller — community events (meetups, hackathons, demo days).
 */

import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { cache, cacheKey, TTL } from '../services/redis.service';
import { publishAnnouncement, publishCalendarEvent, deleteCalendarEvent, publishRSVPEvent, validateCalendarEventData } from '../services/nostr.service';
import { notifyEventRsvp } from '../services/notification.service';

// ─── Validation ───────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    category: z.enum(['NETWORKING', 'CONFERENCE', 'WORKSHOP', 'HACKATHON', 'MEETUP', 'DEMO_DAY', 'OTHER']).default('NETWORKING'),
    visibility: z.enum(['PUBLIC', 'LIMITED_SPACES', 'INVITE_ONLY', 'PRIVATE', 'DRAFT']).default('PUBLIC'),
    location: z.string().optional(),
    isOnline: z.boolean().default(false),
    onlineUrl: z.string().optional().or(z.literal('')),
    startDate: z.string(), // More lenient, parse in controller
    endDate: z.string().optional(),
    thumbnail: z.string().optional().or(z.literal('')),
    ticketUrl: z.string().optional().or(z.literal('')),
    maxAttendees: z.number().int().optional().nullable(),
    tags: z.array(z.string()).optional(),
    isOfficial: z.boolean().optional(),
    endorsementRequested: z.boolean().optional(),
    guestList: z.array(z.object({ name: z.string(), userId: z.string().optional() })).optional(),
    locationName: z.string().optional(),
    locationAddress: z.string().optional(),
    locationMapUrl: z.string().optional().or(z.literal('')),
    customSections: z.array(z.object({
        title: z.string().default(''),
        type: z.enum(['TEXT', 'PHOTO', 'CAROUSEL', 'GRAPH']).default('TEXT'),
        placement: z.enum(['LEFT', 'RIGHT']).default('LEFT'),
        body: z.string().optional(),
        content: z.string().optional(),
        imageUrl: z.string().optional(),
        images: z.array(z.string()).optional(),
        graphType: z.string().optional(),
        xAxisLabel: z.string().optional(),
        yAxisLabel: z.string().optional(),
        dataPoints: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
    })).optional(),
    nostrPublish: z.enum(['none', 'bies', 'public', 'both']).default('bies'),
});

export const updateEventSchema = createEventSchema.partial();

// Derive isPublished from visibility
function visibilityToPublished(visibility: string): boolean {
    return visibility !== 'DRAFT' && visibility !== 'PRIVATE';
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /events
 * List publicly visible events with filters.
 */
export async function listEvents(req: Request, res: Response): Promise<void> {
    try {
        const { category, upcoming, search, isOfficial, isEndorsed, page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 50);

        const cKey = cacheKey.events({
            category: category as string || '',
            upcoming: upcoming as string || '',
            isOfficial: isOfficial as string || '',
            page: page as string,
            limit: limit as string
        });
        const cached = await cache.getJson<any>(cKey);
        if (cached) { res.json(cached); return; }

        // Only show published events that are not PRIVATE or DRAFT
        const where: any = {
            isPublished: true,
            visibility: { notIn: ['PRIVATE', 'DRAFT'] },
        };

        if (category && typeof category === 'string') {
            where.category = category.toUpperCase();
        }
        if (upcoming === 'true') {
            where.startDate = { gte: new Date() };
        }
        if (isOfficial === 'true') {
            where.isOfficial = true;
        } else if (isOfficial === 'false') {
            where.isOfficial = false;
        }
        if (isEndorsed === 'true') {
            where.isEndorsed = true;
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
            guestList: JSON.parse(e.guestList || '[]'),
            customSections: JSON.parse((e as any).customSections || '[]'),
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
 * GET /events/my
 * List all events created by the current user (all visibilities).
 */
export async function listMyEvents(req: Request, res: Response): Promise<void> {
    try {
        const { page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where: { hostId: req.user!.id },
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: {
                    _count: { select: { attendees: true } },
                },
            }),
            prisma.event.count({ where: { hostId: req.user!.id } }),
        ]);

        const parsed = events.map((e) => ({
            ...e,
            tags: JSON.parse(e.tags || '[]'),
            guestList: JSON.parse(e.guestList || '[]'),
            customSections: JSON.parse((e as any).customSections || '[]'),
            attendeeCount: e._count.attendees,
        }));

        res.json({
            data: parsed,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('List my events error:', error);
        res.status(500).json({ error: 'Failed to list your events' });
    }
}

/**
 * GET /events/attending — events the current user has RSVP'd to
 */
export async function listAttendingEvents(req: Request, res: Response): Promise<void> {
    try {
        const { page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
        const take = Math.min(parseInt(limit as string, 10), 100);

        const attendeeRecords = await prisma.eventAttendee.findMany({
            where: { userId: req.user!.id, status: { in: ['GOING', 'INTERESTED'] } },
            include: {
                event: {
                    include: {
                        _count: { select: { attendees: true } },
                        host: { select: { id: true, nostrPubkey: true, profile: { select: { name: true, avatar: true } } } },
                    },
                },
            },
            orderBy: { joinedAt: 'desc' },
            skip,
            take,
        });

        const total = await prisma.eventAttendee.count({
            where: { userId: req.user!.id, status: { in: ['GOING', 'INTERESTED'] } },
        });

        const data = attendeeRecords.map((a) => ({
            ...a.event,
            tags: JSON.parse(a.event.tags || '[]'),
            guestList: JSON.parse(a.event.guestList || '[]'),
            customSections: JSON.parse((a.event as any).customSections || '[]'),
            attendeeCount: a.event._count.attendees,
            rsvpStatus: a.status,
            host: a.event.host,
        }));

        res.json({
            data,
            pagination: { page: parseInt(page as string, 10), limit: take, total, totalPages: Math.ceil(total / take) },
        });
    } catch (error) {
        console.error('List attending events error:', error);
        res.status(500).json({ error: 'Failed to list attending events' });
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
                        user: {
                            select: {
                                id: true,
                                nostrPubkey: true,
                                profile: {
                                    select: {
                                        id: true,
                                        name: true,
                                        avatar: true,
                                        company: true,
                                    },
                                },
                            },
                        },
                    },
                },
                _count: { select: { attendees: true } },
            },
        });

        if (!event) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        const currentUserId = req.user?.id;

        // DRAFT: only host can view
        if (event.visibility === 'DRAFT' && event.hostId !== currentUserId) {
            res.status(404).json({ error: 'Event not found' });
            return;
        }

        // PRIVATE: only host or guests can view
        if (event.visibility === 'PRIVATE' && event.hostId !== currentUserId) {
            const guestList: { name: string; userId?: string }[] = JSON.parse(event.guestList || '[]');
            const isGuest = currentUserId && guestList.some((g) => g.userId === currentUserId);
            if (!isGuest) {
                res.status(404).json({ error: 'Event not found' });
                return;
            }
        }

        res.json({
            ...event,
            tags: JSON.parse(event.tags || '[]'),
            guestList: JSON.parse(event.guestList || '[]'),
            customSections: JSON.parse((event as any).customSections || '[]'),
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
        const allowedFields = [
            'title', 'description', 'category', 'visibility',
            'location', 'locationName', 'locationAddress', 'locationMapUrl',
            'isOnline', 'onlineUrl', 'startDate', 'endDate',
            'thumbnail', 'ticketUrl', 'maxAttendees', 'tags', 'isOfficial',
            'endorsementRequested', 'guestList', 'customSections', 'nostrPublish',
        ];
        const data: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'isOfficial' && req.body[field] === true && !req.user!.isAdmin) {
                    continue;
                }
                data[field] = req.body[field];
            }
        }

        // Extract nostrPublish before DB write (stored separately)
        const nostrPublish: string = data.nostrPublish || 'none';

        // Derive isPublished from visibility
        const visibility = data.visibility || 'PUBLIC';
        const isPublished = visibilityToPublished(visibility);

        const parsedTags: string[] = data.tags || [];
        if (data.tags) data.tags = JSON.stringify(data.tags);
        if (data.guestList) data.guestList = JSON.stringify(data.guestList);
        if (data.customSections) data.customSections = JSON.stringify(data.customSections);
        if (data.startDate) data.startDate = new Date(data.startDate);
        if (data.endDate) data.endDate = new Date(data.endDate);

        const event = await prisma.event.create({
            data: { ...data, hostId: req.user!.id, isPublished },
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

        // Announce new event on the BIES feed
        if (isPublished) {
            const hostName = event.host?.profile?.name || 'A BIES member';
            const dateStr = data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            publishAnnouncement(req.user!.id, `${hostName} is hosting "${event.title}"${dateStr ? ` on ${dateStr}` : ''}${event.location ? ` in ${event.location}` : ''}. Check it out on BIES!`, [['t', 'new-event']]).catch((err) =>
                console.error('[Nostr] Event announcement failed:', err)
            );
        }

        // Publish NIP-52 calendar event to Nostr relays (custodial users)
        let nostrPublished = false;
        if (nostrPublish !== 'none' && isPublished) {
            const validationError = validateCalendarEventData({
                id: event.id,
                title: event.title,
                startDate: data.startDate,
            });
            if (validationError) {
                console.warn('[Nostr] NIP-52 validation failed:', validationError);
            } else {
                try {
                    const nostrEventId = await publishCalendarEvent(req.user!.id, {
                        id: event.id,
                        title: event.title,
                        description: event.description,
                        startDate: data.startDate,
                        endDate: data.endDate || undefined,
                        location: event.location || undefined,
                        locationName: event.locationName || undefined,
                        locationAddress: event.locationAddress || undefined,
                        isOnline: event.isOnline,
                        onlineUrl: event.onlineUrl || undefined,
                        category: event.category,
                        tags: parsedTags,
                        thumbnail: event.thumbnail || undefined,
                        ticketUrl: event.ticketUrl || undefined,
                    }, nostrPublish as 'bies' | 'public' | 'both');
                    if (nostrEventId) {
                        await prisma.event.update({
                            where: { id: event.id },
                            data: { nostrEventId },
                        });
                        nostrPublished = true;
                    }
                } catch (err) {
                    console.error('[Nostr] NIP-52 calendar event publish failed:', err);
                }
            }
        }

        res.status(201).json({
            ...event,
            tags: JSON.parse(event.tags || '[]'),
            guestList: JSON.parse(event.guestList || '[]'),
            customSections: JSON.parse((event as any).customSections || '[]'),
            nostrPublished,
        });
    } catch (error) {
        console.error('Create event error:', error);
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.errors });
            return;
        }
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create event' });
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
            select: { hostId: true, visibility: true, nostrEventId: true, nostrPublish: true },
        });

        if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }
        if (existing.hostId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        const allowedFields = [
            'title', 'description', 'category', 'visibility',
            'location', 'locationName', 'locationAddress', 'locationMapUrl',
            'isOnline', 'onlineUrl', 'startDate', 'endDate',
            'thumbnail', 'ticketUrl', 'maxAttendees', 'tags', 'isOfficial',
            'endorsementRequested', 'guestList', 'customSections', 'nostrPublish',
        ];
        const data: any = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'isOfficial' && req.body[field] === true && !req.user!.isAdmin) {
                    continue;
                }
                data[field] = req.body[field];
            }
        }

        const nostrPublish: string = data.nostrPublish || 'none';

        // Sync isPublished when visibility changes
        if (data.visibility !== undefined) {
            data.isPublished = visibilityToPublished(data.visibility);
        }

        // Format arrays into JSON strings for SQLite
        const parsedTags: string[] = data.tags || [];
        if (data.tags !== undefined) data.tags = JSON.stringify(data.tags);
        if (data.guestList !== undefined) data.guestList = JSON.stringify(data.guestList);
        if (data.customSections !== undefined) data.customSections = JSON.stringify(data.customSections);

        if (data.startDate) data.startDate = new Date(data.startDate);
        if (data.endDate) data.endDate = new Date(data.endDate);

        const event = await prisma.event.update({ where: { id: req.params.id }, data });
        await cache.delPattern('events:');

        // If visibility changed to non-public and event was previously on Nostr, delete it
        let nostrPublished = false;
        const wasPublic = visibilityToPublished(existing.visibility);
        const isNowPublic = event.isPublished;

        if (wasPublic && !isNowPublic && existing.nostrEventId) {
            const prevTarget = (existing.nostrPublish || 'bies') as 'bies' | 'public' | 'both';
            deleteCalendarEvent(req.user!.id, existing.nostrEventId, event.id, prevTarget).catch((err) =>
                console.error('[Nostr] NIP-09 deletion on visibility change failed:', err)
            );
            await prisma.event.update({
                where: { id: event.id },
                data: { nostrEventId: '', nostrPublish: 'none' },
            });
        } else if (nostrPublish !== 'none' && isNowPublic) {
            // Re-publish NIP-52 calendar event (kind 31923 is replaceable via d-tag)
            const validationError = validateCalendarEventData({
                id: event.id,
                title: event.title,
                startDate: event.startDate,
            });
            if (validationError) {
                console.warn('[Nostr] NIP-52 validation failed on update:', validationError);
            } else {
                try {
                    const nostrEventId = await publishCalendarEvent(req.user!.id, {
                        id: event.id,
                        title: event.title,
                        description: event.description,
                        startDate: event.startDate,
                        endDate: event.endDate || undefined,
                        location: event.location || undefined,
                        locationName: event.locationName || undefined,
                        locationAddress: event.locationAddress || undefined,
                        isOnline: event.isOnline,
                        onlineUrl: event.onlineUrl || undefined,
                        category: event.category,
                        tags: parsedTags.length > 0 ? parsedTags : JSON.parse(event.tags || '[]'),
                        thumbnail: event.thumbnail || undefined,
                        ticketUrl: event.ticketUrl || undefined,
                    }, nostrPublish as 'bies' | 'public' | 'both');
                    if (nostrEventId) {
                        await prisma.event.update({
                            where: { id: event.id },
                            data: { nostrEventId },
                        });
                        nostrPublished = true;
                    }
                } catch (err) {
                    console.error('[Nostr] NIP-52 calendar event update failed:', err);
                }
            }
        }

        res.json({
            ...event,
            tags: JSON.parse(event.tags || '[]'),
            guestList: JSON.parse(event.guestList || '[]'),
            customSections: JSON.parse((event as any).customSections || '[]'),
            nostrPublished,
        });
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
            select: { hostId: true, nostrEventId: true, nostrPublish: true },
        });

        if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }
        if (existing.hostId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        // Delete NIP-52 calendar event from Nostr relays before removing from DB
        if (existing.nostrEventId && existing.nostrPublish !== 'none') {
            deleteCalendarEvent(
                existing.hostId,
                existing.nostrEventId,
                req.params.id,
                (existing.nostrPublish || 'bies') as 'bies' | 'public' | 'both'
            ).catch((err) =>
                console.error('[Nostr] NIP-09 deletion on event delete failed:', err)
            );
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
 * PUT /events/:id/endorse
 * Endorse a community event (admin only).
 */
export async function endorseEvent(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user!.isAdmin) {
            res.status(403).json({ error: 'Admin only' }); return;
        }

        const { endorse = true } = req.body;

        const event = await prisma.event.update({
            where: { id: req.params.id },
            data: { isEndorsed: Boolean(endorse) },
        });

        await cache.delPattern('events:');
        res.json({ ...event, tags: JSON.parse(event.tags || '[]') });
    } catch (error) {
        console.error('Endorse event error:', error);
        res.status(500).json({ error: 'Failed to endorse event' });
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

        const validStatuses = ['GOING', 'INTERESTED', 'NOT_GOING'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` }); return;
        }

        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            select: {
                title: true, hostId: true, maxAttendees: true, isPublished: true,
                visibility: true, nostrPublish: true,
                host: { select: { nostrPubkey: true } },
                _count: { select: { attendees: true } },
            },
        });

        if (!event || !event.isPublished) {
            res.status(404).json({ error: 'Event not found' }); return;
        }

        if (status === 'GOING' && event.maxAttendees && event._count.attendees >= event.maxAttendees) {
            const existing = await prisma.eventAttendee.findUnique({
                where: { eventId_userId: { eventId: req.params.id, userId } },
            });
            if (!existing) {
                res.status(409).json({ error: 'Event is at full capacity' }); return;
            }
        }

        // Check if this is a new RSVP (not an update)
        const existingRsvp = await prisma.eventAttendee.findUnique({
            where: { eventId_userId: { eventId: req.params.id, userId } },
        });

        const attendee = await prisma.eventAttendee.upsert({
            where: { eventId_userId: { eventId: req.params.id, userId } },
            update: { status },
            create: { eventId: req.params.id, userId, status },
        });

        // Announce RSVP on the BIES feed (only for new RSVPs with GOING status)
        if (!existingRsvp && (status === 'GOING' || status === 'INTERESTED')) {
            const rsvpUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { profile: { select: { name: true } } },
            });
            const userName = rsvpUser?.profile?.name || 'A BIES member';

            if (status === 'GOING') {
                publishAnnouncement(userId, `${userName} is going to "${event.title}"!`, [['t', 'rsvp']]).catch((err) =>
                    console.error('[Nostr] RSVP announcement failed:', err)
                );
            }

            // Notify event host (don't notify yourself)
            if (event.hostId !== userId) {
                notifyEventRsvp({
                    hostId: event.hostId,
                    attendeeName: userName,
                    attendeeId: userId,
                    eventTitle: event.title,
                    eventId: req.params.id,
                    status,
                }).catch(() => {});
            }
        }

        // Publish NIP-52 RSVP (kind 31925) to Nostr
        const nostrTarget = (event.nostrPublish || 'none') as string;
        if (nostrTarget !== 'none' && event.host?.nostrPubkey) {
            const rsvpStatusMap: Record<string, 'accepted' | 'declined' | 'tentative'> = {
                GOING: 'accepted',
                INTERESTED: 'tentative',
                NOT_GOING: 'declined',
            };
            publishRSVPEvent(userId, {
                eventId: req.params.id,
                eventDTag: req.params.id,
                hostPubkey: event.host.nostrPubkey,
                status: rsvpStatusMap[status] || 'tentative',
            }, nostrTarget as 'bies' | 'public' | 'both').then(async (nostrRsvpId) => {
                if (nostrRsvpId) {
                    await prisma.eventAttendee.update({
                        where: { id: attendee.id },
                        data: { nostrEventId: nostrRsvpId },
                    });
                }
            }).catch((err) =>
                console.error('[Nostr] NIP-52 RSVP publish failed:', err)
            );
        }

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
