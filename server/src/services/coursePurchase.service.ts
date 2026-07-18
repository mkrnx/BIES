/**
 * Course purchase via zap-and-claim (NIP-57).
 *
 * The passive zap indexer is NEVER trusted for entitlement — receipts it
 * stores are display data. A purchase is only created here, after strict
 * verification of the actual kind-9735 events fetched from relays:
 *
 *   1. receipt signature valid AND signed by the author's LNURL provider's
 *      advertised zapper key (NIP-57 Appendix F) — kills self-signed fakes
 *   2. embedded kind-9734 zap request signature valid AND signed by the
 *      claiming buyer — kills cross-user replay
 *   3. bolt11 present; its description_hash commits to the exact 9734 JSON
 *      (payment is cryptographically bound to the request) and its amount
 *      is the amount credited — the client-supplied `amount` tag is ignored
 *   4. the request targets this course's addressable coordinate
 *
 * Sum of verified receipts >= priceSats → CoursePurchase + Enrollment in
 * one transaction. Unique constraints make claims idempotent.
 */

import { createHash } from 'crypto';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';
import type { Event } from 'nostr-tools/pure';
import type { Filter } from 'nostr-tools/filter';
import prisma from '../lib/prisma';
import { config } from '../config';
import { cache } from './redis.service';
import { createNotification } from './notification.service';
import { safeGetJson } from '../utils/safeFetch';

const LNURL_CACHE_TTL = 3600; // 1h
const RELAY_QUERY_TIMEOUT_MS = 8000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LnurlPayMetadata {
    callback: string;
    allowsNostr: boolean;
    nostrPubkey: string | null;
    minSendable: number;
    maxSendable: number;
}

export interface ReceiptVerifyContext {
    /** Course author's Nostr pubkey (the zap recipient). */
    authorPubkey: string;
    /** The claiming buyer's Nostr pubkey (must have signed the 9734). */
    buyerPubkey: string;
    /** The author's LNURL provider zapper key — the only valid receipt signer. */
    zapperPubkey: string;
    /** Addressable coordinates that count as "this course". */
    coordinates: Set<string>;
}

/** Decoded bolt11 fields relevant to zap verification. */
export interface DecodedInvoice {
    amountMsats: bigint;
    /** hex sha256 the invoice commits to (description_hash), or null. */
    descriptionHashHex: string | null;
}

export interface ClaimResult {
    purchased: boolean;
    verifiedSats: number;
    priceSats: number;
    receiptsChecked: number;
}

// ─── LNURL metadata (cached) ─────────────────────────────────────────────────

/**
 * Fetch and cache the LNURL-pay metadata for a lud16 address. The
 * `nostrPubkey` field is the trust anchor for receipt verification.
 */
export async function getLnurlPayMetadata(
    lightningAddress: string
): Promise<LnurlPayMetadata | null> {
    const match = /^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(
        (lightningAddress || '').trim()
    );
    if (!match) return null;
    const [, name, domain] = match;

    const cKey = `lnurlp:${name.toLowerCase()}@${domain.toLowerCase()}`;
    const cached = await cache.getJson<LnurlPayMetadata>(cKey);
    if (cached) return cached;

    try {
        // SSRF-hardened: `domain` comes from a user-controlled lightningAddress,
        // so this fetch validates every resolved IP against private/reserved
        // ranges and pins it to the socket (see safeGetJson). https-only.
        const data: any = await safeGetJson(
            `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`,
            RELAY_QUERY_TIMEOUT_MS
        );
        if (!data?.callback) return null;

        const meta: LnurlPayMetadata = {
            callback: String(data.callback),
            allowsNostr: Boolean(data.allowsNostr),
            nostrPubkey:
                typeof data.nostrPubkey === 'string' && /^[0-9a-f]{64}$/i.test(data.nostrPubkey)
                    ? data.nostrPubkey.toLowerCase()
                    : null,
            minSendable: Number(data.minSendable) || 1000,
            maxSendable: Number(data.maxSendable) || 100_000_000_000,
        };
        await cache.setJson(cKey, meta, LNURL_CACHE_TTL);
        return meta;
    } catch {
        return null;
    }
}

// ─── Invoice decoding ────────────────────────────────────────────────────────

/** Decode a bolt11 invoice's amount + description_hash (null on failure). */
export function decodeInvoice(bolt11: string): DecodedInvoice | null {
    try {
        const decoded = decodeBolt11(bolt11);
        let amountMsats = 0n;
        let descriptionHashHex: string | null = null;
        // The lib's d.ts section union omits description_hash; the JS emits it.
        for (const section of (decoded.sections ?? []) as Array<{ name: string; value?: unknown }>) {
            if (section.name === 'amount') amountMsats = BigInt(String(section.value));
            if (section.name === 'description_hash' && section.value) {
                descriptionHashHex = String(section.value).toLowerCase();
            }
        }
        return { amountMsats, descriptionHashHex };
    } catch {
        return null;
    }
}

// ─── Receipt verification (pure-ish core, decode injectable for tests) ──────

function firstTag(event: Event, name: string): string | null {
    const tag = event.tags.find((t) => t[0] === name);
    return tag?.[1] ?? null;
}

/**
 * Verify one kind-9735 receipt against the claim context. Returns the
 * verified amount in sats, or 0 if the receipt fails ANY check.
 */
export async function verifyZapReceiptForPurchase(
    receipt: Event,
    ctx: ReceiptVerifyContext,
    decode: (bolt11: string) => DecodedInvoice | null = decodeInvoice
): Promise<number> {
    try {
        // Plain-JSON clone: strips nostr-tools' cached-verification symbol so
        // signature checks below are always real, regardless of the source.
        receipt = JSON.parse(JSON.stringify(receipt)) as Event;
        if (receipt.kind !== 9735) return 0;

        // 1. Receipt must be signed by the LNURL provider's zapper key.
        if (receipt.pubkey.toLowerCase() !== ctx.zapperPubkey.toLowerCase()) return 0;
        const { verifyEvent } = await import('nostr-tools/pure');
        if (!verifyEvent(receipt)) return 0;

        // Recipient must be the course author.
        if (firstTag(receipt, 'p') !== ctx.authorPubkey) return 0;

        // 2. Embedded zap request: valid signature, signed by the buyer.
        const description = firstTag(receipt, 'description');
        if (!description) return 0;
        let request: Event;
        try {
            request = JSON.parse(description) as Event;
        } catch {
            return 0;
        }
        if (request.kind !== 9734) return 0;
        if (request.pubkey.toLowerCase() !== ctx.buyerPubkey.toLowerCase()) return 0;
        if (!verifyEvent(request)) return 0;

        // Request must target the author and this course's coordinate.
        if (firstTag(request, 'p') !== ctx.authorPubkey) return 0;
        const coordinate = firstTag(request, 'a') ?? firstTag(receipt, 'a');
        if (!coordinate || !ctx.coordinates.has(coordinate)) return 0;

        // 3. bolt11 binding: description_hash commits to this exact request,
        //    amount comes from the invoice — never from client-supplied tags.
        const bolt11 = firstTag(receipt, 'bolt11');
        if (!bolt11) return 0;
        const decoded = decode(bolt11);
        if (!decoded || decoded.amountMsats <= 0n) return 0;
        if (!decoded.descriptionHashHex) return 0;
        const expectedHash = createHash('sha256').update(description).digest('hex');
        if (decoded.descriptionHashHex !== expectedHash) return 0;

        // Cross-check the request's declared amount when present.
        const requestAmount = firstTag(request, 'amount');
        if (requestAmount && BigInt(requestAmount) !== decoded.amountMsats) return 0;

        return Number(decoded.amountMsats / 1000n);
    } catch {
        return 0;
    }
}

// ─── Claim flow ──────────────────────────────────────────────────────────────

/** Course coordinates a zap may target: the 30004 list or any 30402 lesson teaser. */
export function courseCoordinates(
    authorPubkey: string,
    courseId: string,
    lessonIds: string[]
): Set<string> {
    const set = new Set<string>([`30004:${authorPubkey}:${courseId}`]);
    for (const lessonId of lessonIds) set.add(`30402:${authorPubkey}:${lessonId}`);
    return set;
}

/** Fetch candidate 9735 events from relays (indexer may not have seen them). */
async function fetchCandidateReceipts(
    zapperPubkey: string,
    authorPubkey: string,
    coordinates: Set<string>,
    knownEventIds: string[]
): Promise<Event[]> {
    const relays = [
        ...config.nostrRelays,
        config.nostrPublicRelay,
        config.nostrPrivateRelay,
    ].filter(Boolean);

    const filters: Filter[] = [
        {
            kinds: [9735],
            authors: [zapperPubkey],
            '#p': [authorPubkey],
            '#a': Array.from(coordinates),
            limit: 50,
        },
    ];
    if (knownEventIds.length > 0) {
        filters.push({ ids: knownEventIds.slice(0, 50) });
    }

    try {
        const { SimplePool } = await import('nostr-tools/pool');
        const pool = new SimplePool();
        const results = await Promise.all(
            filters.map((filter) =>
                pool
                    .querySync(relays, filter, { maxWait: RELAY_QUERY_TIMEOUT_MS })
                    .catch(() => [] as Event[])
            )
        );
        pool.destroy();
        const byId = new Map<string, Event>();
        for (const event of results.flat()) byId.set(event.id, event);
        return Array.from(byId.values());
    } catch {
        return [];
    }
}

/**
 * Verify the buyer's zaps for a course and create the purchase when the
 * verified total covers the price. Idempotent — an existing purchase is
 * returned as-is.
 */
export async function claimZapPurchase(userId: string, courseId: string): Promise<ClaimResult> {
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            id: true,
            title: true,
            authorId: true,
            priceSats: true,
            status: true,
            author: {
                select: { nostrPubkey: true, profile: { select: { lightningAddress: true } } },
            },
            lessons: { select: { id: true } },
        },
    });
    if (!course || course.status !== 'active') {
        throw Object.assign(new Error('Course not found'), { statusCode: 404 });
    }
    if (course.priceSats <= 0) {
        throw Object.assign(new Error('This course is free'), { statusCode: 400 });
    }
    if (course.authorId === userId) {
        throw Object.assign(new Error('You are the author of this course'), { statusCode: 400 });
    }

    const buyer = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, nostrPubkey: true, profile: { select: { name: true } } },
    });
    if (!buyer?.nostrPubkey) {
        throw Object.assign(new Error('No Nostr pubkey on your account'), { statusCode: 400 });
    }

    const existing = await prisma.coursePurchase.findUnique({
        where: { courseId_userId: { courseId, userId } },
    });
    if (existing) {
        return {
            purchased: true,
            verifiedSats: existing.amountSats,
            priceSats: course.priceSats,
            receiptsChecked: 0,
        };
    }

    const lightningAddress = course.author.profile?.lightningAddress || '';
    const lnurl = await getLnurlPayMetadata(lightningAddress);
    if (!lnurl?.allowsNostr || !lnurl.nostrPubkey) {
        throw Object.assign(
            new Error('The instructor\'s Lightning address does not support verifiable zaps'),
            { statusCode: 409 }
        );
    }

    const coordinates = courseCoordinates(
        course.author.nostrPubkey,
        course.id,
        course.lessons.map((l) => l.id)
    );

    // Candidates: receipts the indexer already matched to this course from
    // this buyer, plus a live relay sweep to close indexing races.
    const knownRows = await prisma.zapReceipt.findMany({
        where: { courseId, senderPubkey: buyer.nostrPubkey },
        select: { eventId: true },
        take: 50,
    });
    const candidates = await fetchCandidateReceipts(
        lnurl.nostrPubkey,
        course.author.nostrPubkey,
        coordinates,
        knownRows.map((r) => r.eventId)
    );

    const ctx: ReceiptVerifyContext = {
        authorPubkey: course.author.nostrPubkey,
        buyerPubkey: buyer.nostrPubkey,
        zapperPubkey: lnurl.nostrPubkey,
        coordinates,
    };

    let verifiedSats = 0;
    const usedReceiptIds: string[] = [];
    for (const receipt of candidates) {
        const sats = await verifyZapReceiptForPurchase(receipt, ctx);
        if (sats > 0) {
            verifiedSats += sats;
            usedReceiptIds.push(receipt.id);
        }
    }

    if (verifiedSats < course.priceSats) {
        return {
            purchased: false,
            verifiedSats,
            priceSats: course.priceSats,
            receiptsChecked: candidates.length,
        };
    }

    try {
        await prisma.$transaction([
            prisma.coursePurchase.create({
                data: {
                    courseId,
                    userId,
                    amountSats: verifiedSats,
                    method: 'ZAP',
                    zapReceiptIds: JSON.stringify(usedReceiptIds),
                },
            }),
            prisma.enrollment.upsert({
                where: { courseId_userId: { courseId, userId } },
                update: {},
                create: { courseId, userId },
            }),
        ]);
    } catch (error: any) {
        // Concurrent claim — the unique constraint means someone (us) won.
        if (error?.code !== 'P2002') throw error;
    }

    createNotification({
        userId: course.authorId,
        type: 'SYSTEM',
        title: 'Course purchased',
        body: `${buyer.profile?.name || 'A BIES member'} purchased "${course.title}" for ${verifiedSats.toLocaleString()} sats.`,
        data: { courseId },
    }).catch(() => {});
    createNotification({
        userId,
        type: 'SYSTEM',
        title: 'Course unlocked',
        body: `Your purchase of "${course.title}" is confirmed. Happy learning!`,
        data: { courseId },
    }).catch(() => {});

    return {
        purchased: true,
        verifiedSats,
        priceSats: course.priceSats,
        receiptsChecked: candidates.length,
    };
}

/**
 * Fire-and-forget hook for the zap indexer: when a receipt matched to a
 * course arrives from a known user without a purchase, try to auto-claim so
 * external-wallet payers unlock without pressing a button. Never throws.
 */
export async function attemptAutoClaim(senderPubkey: string, courseId: string): Promise<void> {
    try {
        const user = await prisma.user.findUnique({
            where: { nostrPubkey: senderPubkey },
            select: { id: true },
        });
        if (!user) return;
        const existing = await prisma.coursePurchase.findUnique({
            where: { courseId_userId: { courseId, userId: user.id } },
            select: { id: true },
        });
        if (existing) return;
        const result = await claimZapPurchase(user.id, courseId);
        if (result.purchased) {
            console.log(`[Courses] Auto-claimed purchase: course ${courseId} by ${senderPubkey.slice(0, 8)}...`);
        }
    } catch {
        // best-effort only
    }
}
