/**
 * Tickets controller — non-custodial Lightning event ticketing.
 *
 * Revenue goes directly to the event host: the server requests a bolt11
 * invoice from the host's Lightning address (LNURL-pay) and only tracks
 * settlement — primary via LUD-21 verify polling, fallback via buyer
 * preimage submission checked against the invoice payment_hash.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { cache } from '../services/redis.service';
import { createNotification } from '../services/notification.service';
import {
    resolveLightningAddress,
    requestInvoice,
    decodeBolt11,
    verifyLud21,
    sha256Hex,
} from '../services/lnurl.service';

// ─── Validation ───────────────────────────────────────────────────────────────

export const claimTicketSchema = z.object({
    preimage: z.string().regex(/^[0-9a-fA-F]{64}$/, 'preimage must be a 64-char hex string'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MAX_PENDING_SECONDS = 15 * 60; // cap invoice validity window at 15 minutes

interface TicketRow {
    id: string;
    eventId: string;
    buyerId: string;
    amountSats: number;
    bolt11: string;
    paymentHash: string;
    preimage: string;
    verifyUrl: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
    paidAt: Date | null;
    checkedInAt: Date | null;
}

/** Public-safe ticket shape (no paymentHash/preimage/verifyUrl internals). */
function serializeTicket(t: TicketRow) {
    return {
        id: t.id,
        eventId: t.eventId,
        buyerId: t.buyerId,
        amountSats: t.amountSats,
        bolt11: t.bolt11,
        status: t.status,
        verifySupported: !!t.verifyUrl,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        paidAt: t.paidAt,
        checkedInAt: t.checkedInAt,
    };
}

/**
 * Run a final LUD-21 settlement check on a stale PENDING ticket before giving
 * up on it: the invoice may outlive our PENDING window, so a buyer can settle
 * it after expiresAt. Marks PAID when settled, EXPIRED when verifiably
 * unsettled, and leaves it PENDING (retried later) when verify is unreachable.
 * Returns the updated ticket row.
 */
async function settleOrExpireTicket(ticket: TicketRow): Promise<TicketRow> {
    if (ticket.verifyUrl) {
        try {
            const result = await verifyLud21(ticket.verifyUrl);
            if (result.settled) {
                // When the provider returns the preimage, require it to match
                const preimageOk = !result.preimage
                    || sha256Hex(Buffer.from(result.preimage, 'hex')) === ticket.paymentHash;
                if (preimageOk) return markTicketPaid(ticket, result.preimage || '');
                console.warn(`[Tickets] LUD-21 preimage mismatch for ticket ${ticket.id}`);
                return ticket;
            }
        } catch {
            // Verify endpoint unreachable — leave the ticket PENDING for now
            return ticket;
        }
    }
    return prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'EXPIRED' },
    });
}

/**
 * Opportunistically flip stale PENDING tickets to EXPIRED — but never without
 * a final LUD-21 settlement check when the ticket supports verify, so buyers
 * who paid a still-valid invoice after our PENDING window are not stranded.
 */
async function expireStaleTickets(where: { eventId?: string; buyerId?: string }): Promise<void> {
    const now = new Date();

    const staleVerifiable = await prisma.ticket.findMany({
        where: { ...where, status: 'PENDING', expiresAt: { lt: now }, verifyUrl: { not: '' } },
        take: 10,
    });
    if (staleVerifiable.length > 0) {
        await Promise.allSettled(staleVerifiable.map((t) => settleOrExpireTicket(t)));
    }

    await prisma.ticket.updateMany({
        where: { ...where, status: 'PENDING', expiresAt: { lt: now }, verifyUrl: '' },
        data: { status: 'EXPIRED' },
    });
}

/**
 * Mark a ticket PAID: store preimage/paidAt, upsert the buyer's RSVP to GOING,
 * invalidate the events cache and notify the host. Returns the updated ticket.
 */
async function markTicketPaid(ticket: TicketRow, preimage: string): Promise<TicketRow> {
    const [updated] = await prisma.$transaction([
        prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: 'PAID', paidAt: new Date(), preimage },
        }),
        prisma.eventAttendee.upsert({
            where: { eventId_userId: { eventId: ticket.eventId, userId: ticket.buyerId } },
            update: { status: 'GOING' },
            create: { eventId: ticket.eventId, userId: ticket.buyerId, status: 'GOING' },
        }),
    ]);

    await cache.delPattern('events:');

    // Notify the host of the sale (best-effort)
    prisma.event.findUnique({
        where: { id: ticket.eventId },
        select: { title: true, hostId: true },
    }).then(async (event) => {
        if (!event || event.hostId === ticket.buyerId) return;
        const buyer = await prisma.user.findUnique({
            where: { id: ticket.buyerId },
            select: { profile: { select: { name: true } } },
        });
        const buyerName = buyer?.profile?.name || 'A BIES member';
        await createNotification({
            userId: event.hostId,
            type: 'EVENT_RSVP',
            title: `${buyerName} bought a ticket to "${event.title}"`,
            body: `${ticket.amountSats} sats were paid to your Lightning address.`,
            data: { eventId: ticket.eventId, ticketId: ticket.id, buyerId: ticket.buyerId },
        });
    }).catch(() => {});

    return updated;
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /events/:id/tickets
 * Create a PENDING ticket: request a bolt11 invoice from the host's Lightning
 * address so the buyer pays the host directly (non-custodial).
 */
export async function createTicket(req: Request, res: Response): Promise<void> {
    try {
        const eventId = req.params.id;
        const buyerId = req.user!.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true, title: true, hostId: true, isPublished: true,
                startDate: true, endDate: true,
                priceSats: true, ticketCapacity: true, payoutLightningAddress: true,
                host: { select: { profile: { select: { lightningAddress: true } } } },
            },
        });

        if (!event || !event.isPublished) {
            res.status(404).json({ error: 'Event not found' }); return;
        }
        if (!event.priceSats || event.priceSats <= 0) {
            res.status(400).json({ error: 'This event does not sell tickets' }); return;
        }

        const now = new Date();
        const eventEnd = event.endDate || event.startDate;
        if (eventEnd < now) {
            res.status(400).json({ error: 'This event has already ended' }); return;
        }

        // Opportunistically expire stale PENDING tickets so they free up capacity
        await expireStaleTickets({ eventId });

        // If the buyer already has a live pending invoice, return it instead of
        // requesting a new one (avoids invoice spam + double capacity holds)
        const existingPending = await prisma.ticket.findFirst({
            where: { eventId, buyerId, status: 'PENDING', expiresAt: { gt: now } },
            orderBy: { createdAt: 'desc' },
        });
        if (existingPending) {
            res.status(201).json({ ticket: serializeTicket(existingPending) }); return;
        }

        // Cheap capacity pre-check before hitting the host's LNURL server
        if (event.ticketCapacity) {
            const active = await prisma.ticket.count({
                where: {
                    eventId,
                    OR: [{ status: 'PAID' }, { status: 'PENDING', expiresAt: { gt: now } }],
                },
            });
            if (active >= event.ticketCapacity) {
                res.status(409).json({ error: 'Tickets are sold out' }); return;
            }
        }

        // Resolve the payout address: per-event override, else host profile
        const payoutAddress = event.payoutLightningAddress || event.host?.profile?.lightningAddress || '';
        if (!payoutAddress) {
            res.status(400).json({ error: 'The event host has no Lightning address configured to receive ticket payments' });
            return;
        }

        // Request a bolt11 invoice from the host's LNURL-pay endpoint
        const amountMsats = event.priceSats * 1000;
        let bolt11: string;
        let verifyUrl: string;
        let paymentHash: string;
        let expirySeconds: number;
        try {
            const params = await resolveLightningAddress(payoutAddress);
            const invoice = await requestInvoice(params, amountMsats);
            const decoded = decodeBolt11(invoice.pr);
            // Amountless invoices let the payer pick any amount, so require an exact match
            if (decoded.amountMsats === null || decoded.amountMsats !== BigInt(amountMsats)) {
                throw new Error('Lightning provider returned an invoice with the wrong amount');
            }
            bolt11 = invoice.pr;
            verifyUrl = invoice.verify || '';
            paymentHash = decoded.paymentHash;
            expirySeconds = decoded.expirySeconds;
        } catch (err) {
            console.error('Ticket invoice error:', err);
            res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to get an invoice from the host\'s Lightning address' });
            return;
        }

        const expiresAt = new Date(now.getTime() + Math.min(expirySeconds, MAX_PENDING_SECONDS) * 1000);

        // Atomic capacity check + create: PAID plus unexpired PENDING hold seats
        const ticket = await prisma.$transaction(async (tx) => {
            if (event.ticketCapacity) {
                const active = await tx.ticket.count({
                    where: {
                        eventId,
                        OR: [{ status: 'PAID' }, { status: 'PENDING', expiresAt: { gt: now } }],
                    },
                });
                if (active >= event.ticketCapacity) return null;
            }
            return tx.ticket.create({
                data: {
                    eventId,
                    buyerId,
                    amountSats: event.priceSats!,
                    bolt11,
                    paymentHash,
                    verifyUrl,
                    status: 'PENDING',
                    expiresAt,
                },
            });
        });

        if (!ticket) {
            res.status(409).json({ error: 'Tickets are sold out' }); return;
        }

        res.status(201).json({ ticket: serializeTicket(ticket) });
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
}

/**
 * GET /events/:id/tickets/:ticketId
 * Get a ticket (buyer or host/admin). For PENDING tickets with LUD-21 support
 * the server polls the verify URL and marks the ticket PAID when settled.
 */
export async function getTicket(req: Request, res: Response): Promise<void> {
    try {
        let ticket = await prisma.ticket.findUnique({
            where: { id: req.params.ticketId },
            include: { event: { select: { hostId: true } } },
        });

        if (!ticket || ticket.eventId !== req.params.id) {
            res.status(404).json({ error: 'Ticket not found' }); return;
        }

        const isBuyer = ticket.buyerId === req.user!.id;
        const isHost = ticket.event.hostId === req.user!.id || req.user!.isAdmin;
        if (!isBuyer && !isHost) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        if (ticket.status === 'PENDING' && ticket.expiresAt < new Date()) {
            // Stale: final LUD-21 settlement check before flipping to EXPIRED
            const updated = await settleOrExpireTicket(ticket);
            ticket = { ...ticket, ...updated };
        } else if ((ticket.status === 'PENDING' || ticket.status === 'EXPIRED') && ticket.verifyUrl) {
            // Poll settlement — EXPIRED included so late payers can still recover
            try {
                const result = await verifyLud21(ticket.verifyUrl);
                if (result.settled) {
                    // When the provider returns the preimage, require it to match
                    const preimageOk = !result.preimage
                        || sha256Hex(Buffer.from(result.preimage, 'hex')) === ticket.paymentHash;
                    if (preimageOk) {
                        const paid = await markTicketPaid(ticket, result.preimage || '');
                        ticket = { ...ticket, ...paid };
                    } else {
                        console.warn(`[Tickets] LUD-21 preimage mismatch for ticket ${ticket.id}`);
                    }
                }
            } catch {
                // Verify endpoint unreachable — leave the ticket as-is
            }
        }

        res.json({ ticket: serializeTicket(ticket) });
    } catch (error) {
        console.error('Get ticket error:', error);
        res.status(500).json({ error: 'Failed to get ticket' });
    }
}

/**
 * POST /events/:id/tickets/:ticketId/claim
 * Buyer submits the payment preimage (from NWC/WebLN) as proof of payment.
 * sha256(preimage) must match the invoice payment_hash.
 */
export async function claimTicket(req: Request, res: Response): Promise<void> {
    try {
        const { preimage } = req.body as { preimage: string };

        const ticket = await prisma.ticket.findUnique({ where: { id: req.params.ticketId } });

        if (!ticket || ticket.eventId !== req.params.id) {
            res.status(404).json({ error: 'Ticket not found' }); return;
        }
        if (ticket.buyerId !== req.user!.id) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        // Idempotent: already settled
        if (ticket.status === 'PAID') {
            res.json({ ticket: serializeTicket(ticket) }); return;
        }
        if (ticket.status === 'CANCELLED') {
            res.status(400).json({ error: 'Ticket has been cancelled' }); return;
        }

        if (sha256Hex(Buffer.from(preimage, 'hex')) !== ticket.paymentHash) {
            res.status(400).json({ error: 'Preimage does not match the invoice payment hash' }); return;
        }

        // A valid preimage proves payment even if our PENDING window lapsed
        const paid = await markTicketPaid(ticket, preimage.toLowerCase());
        res.json({ ticket: serializeTicket(paid) });
    } catch (error) {
        console.error('Claim ticket error:', error);
        res.status(500).json({ error: 'Failed to claim ticket' });
    }
}

/**
 * GET /events/:id/tickets/mine
 * The buyer's tickets for one event.
 */
export async function listMyEventTickets(req: Request, res: Response): Promise<void> {
    try {
        const eventId = req.params.id;
        const buyerId = req.user!.id;

        await expireStaleTickets({ eventId, buyerId });

        const tickets = await prisma.ticket.findMany({
            where: { eventId, buyerId },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ data: tickets.map(serializeTicket) });
    } catch (error) {
        console.error('List my event tickets error:', error);
        res.status(500).json({ error: 'Failed to list tickets' });
    }
}

/**
 * GET /events/:id/tickets
 * Host or admin: all tickets for an event with buyer info + sales summary.
 */
export async function listEventTickets(req: Request, res: Response): Promise<void> {
    try {
        const eventId = req.params.id;

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { hostId: true },
        });
        if (!event) {
            res.status(404).json({ error: 'Event not found' }); return;
        }
        if (event.hostId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }

        await expireStaleTickets({ eventId });

        const tickets = await prisma.ticket.findMany({
            where: { eventId },
            orderBy: { createdAt: 'desc' },
            include: {
                buyer: {
                    select: {
                        id: true,
                        nostrPubkey: true,
                        profile: { select: { name: true, avatar: true } },
                    },
                },
            },
        });

        const summary = tickets.reduce(
            (acc, t) => {
                if (t.status === 'PAID') {
                    acc.sold += 1;
                    acc.revenueSats += t.amountSats;
                    if (t.checkedInAt) acc.checkedIn += 1;
                } else if (t.status === 'PENDING') {
                    acc.pending += 1;
                }
                return acc;
            },
            { sold: 0, revenueSats: 0, pending: 0, checkedIn: 0 }
        );

        const data = tickets.map((t) => ({
            ...serializeTicket(t),
            buyer: {
                id: t.buyer.id,
                nostrPubkey: t.buyer.nostrPubkey,
                name: t.buyer.profile?.name || '',
                avatar: t.buyer.profile?.avatar || '',
            },
        }));

        res.json({ data, summary });
    } catch (error) {
        console.error('List event tickets error:', error);
        res.status(500).json({ error: 'Failed to list tickets' });
    }
}

/**
 * POST /events/:id/tickets/:ticketId/checkin
 * Host or admin marks a PAID ticket as checked in at the door.
 */
export async function checkinTicket(req: Request, res: Response): Promise<void> {
    try {
        const ticket = await prisma.ticket.findUnique({
            where: { id: req.params.ticketId },
            include: { event: { select: { hostId: true } } },
        });

        if (!ticket || ticket.eventId !== req.params.id) {
            res.status(404).json({ error: 'Ticket not found' }); return;
        }
        if (ticket.event.hostId !== req.user!.id && !req.user!.isAdmin) {
            res.status(403).json({ error: 'Not authorized' }); return;
        }
        if (ticket.status !== 'PAID') {
            res.status(400).json({ error: 'Only paid tickets can be checked in' }); return;
        }
        if (ticket.checkedInAt) {
            res.status(409).json({ error: 'Ticket already checked in', checkedInAt: ticket.checkedInAt });
            return;
        }

        const updated = await prisma.ticket.update({
            where: { id: ticket.id },
            data: { checkedInAt: new Date() },
        });

        res.json({ ticket: serializeTicket(updated) });
    } catch (error) {
        console.error('Check-in ticket error:', error);
        res.status(500).json({ error: 'Failed to check in ticket' });
    }
}

/**
 * GET /events/tickets/mine
 * All of the caller's tickets across events (with event summary embedded).
 */
export async function listMyTickets(req: Request, res: Response): Promise<void> {
    try {
        const buyerId = req.user!.id;

        await expireStaleTickets({ buyerId });

        const tickets = await prisma.ticket.findMany({
            where: { buyerId },
            orderBy: { createdAt: 'desc' },
            include: {
                event: {
                    select: { id: true, title: true, startDate: true, locationName: true },
                },
            },
        });

        const data = tickets.map((t) => ({
            ...serializeTicket(t),
            event: t.event,
        }));

        res.json({ data });
    } catch (error) {
        console.error('List my tickets error:', error);
        res.status(500).json({ error: 'Failed to list tickets' });
    }
}
