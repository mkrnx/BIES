// nostr-tools is ESM-only (@noble/curves has no CJS build);
// use dynamic import() so the compiled CJS output doesn't call require().
import type { EventTemplate } from 'nostr-tools/pure';
import { config } from '../config';
import prisma from '../lib/prisma';
import { decryptPrivateKey } from './crypto.service';

let _pool: InstanceType<Awaited<typeof import('nostr-tools/pool')>['SimplePool']> | null = null;
async function getPool() {
    if (!_pool) {
        const { SimplePool } = await import('nostr-tools/pool');
        _pool = new SimplePool();
    }
    return _pool;
}

/**
 * Publish a Nostr event signed by a user's custodial key.
 * For Nostr-native users (no custodial key), events are signed client-side.
 */
export async function publishEvent(
    userId: string,
    eventTemplate: EventTemplate
): Promise<string | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivkey: true, nostrPubkey: true },
        });

        if (!user || !user.encryptedPrivkey) {
            // Nostr-native user — they sign on the client side
            console.log(`[Nostr] User ${userId} has no custodial key, skipping server-side publish`);
            return null;
        }

        // Decrypt the private key
        const privateKeyHex = decryptPrivateKey(user.encryptedPrivkey);
        const privateKeyBytes = hexToBytes(privateKeyHex);

        // Finalize (sign) the event
        const { finalizeEvent } = await import('nostr-tools/pure');
        const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

        // Publish to private relay only
        const pool = await getPool();
        const relays = config.nostrPrivateRelay
            ? [config.nostrPrivateRelay]
            : config.nostrRelays;
        const results = await Promise.allSettled(
            pool.publish(relays, signedEvent)
        );

        const published = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Nostr] Published to ${published}/${relays.length} relays`);

        return published > 0 ? signedEvent.id : null;
    } catch (error) {
        console.error('[Nostr] Publish error:', error);
        return null;
    }
}

/**
 * Publish a user profile update (Kind 0).
 */
export async function publishProfileUpdate(
    userId: string,
    profile: {
        name: string;
        about?: string;
        picture?: string;
        banner?: string;
        website?: string;
        nip05?: string;
        lud16?: string;
    }
): Promise<string | null> {
    const content: Record<string, string> = {
        name: profile.name,
        about: profile.about || '',
        picture: profile.picture || '',
        website: profile.website || '',
    };
    if (profile.banner) content.banner = profile.banner;
    if (profile.nip05) content.nip05 = profile.nip05;
    if (profile.lud16) content.lud16 = profile.lud16;

    const event: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify(content),
    };

    return publishEvent(userId, event);
}

/**
 * Publish a project as a long-form content event (Kind 30023).
 */
export async function publishProject(
    userId: string,
    project: {
        id: string;
        title: string;
        description: string;
        category: string;
        stage: string;
        thumbnail?: string;
    }
): Promise<string | null> {
    const event: EventTemplate = {
        kind: 30023,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
            ['d', project.id], // unique identifier for replaceable event
            ['title', project.title],
            ['t', project.category.toLowerCase()],
            ['t', project.stage.toLowerCase()],
            ['t', 'bies'], // tag all BIES projects
            ['summary', project.description.substring(0, 200)],
            ...(project.thumbnail ? [['image', project.thumbnail]] : []),
        ],
        content: project.description,
    };

    return publishEvent(userId, event);
}

/**
 * Publish a project as a NIP-99 classified listing (Kind 30402).
 * Discoverable in Nostr clients with marketplace/classified support.
 */
export async function publishProjectListing(
    userId: string,
    project: {
        id: string;
        title: string;
        description: string;
        category: string;
        stage: string;
        fundingGoal?: number | null;
        thumbnail?: string;
        location?: string;
    }
): Promise<string | null> {
    const tags: string[][] = [
        ['d', project.id],
        ['title', project.title],
        ['summary', project.description.substring(0, 200)],
        ['t', project.category.toLowerCase()],
        ['t', project.stage.toLowerCase()],
        ['t', 'bies'],
        ['t', 'investment'],
    ];

    if (project.fundingGoal) {
        tags.push(['price', String(project.fundingGoal), 'USD']);
    }
    if (project.thumbnail) {
        tags.push(['image', project.thumbnail]);
    }
    if (project.location) {
        tags.push(['location', project.location]);
    }

    const event: EventTemplate = {
        kind: 30402,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: project.description,
    };

    return publishEvent(userId, event);
}

/**
 * Publish a NIP-65 relay list metadata event (Kind 10002).
 * Tags BIES relay as write, public relays as read.
 */
export async function publishRelayList(userId: string): Promise<string | null> {
    const tags: string[][] = [
        ['r', config.nostrPublicRelay, 'write'],
    ];

    // Add public relays as read
    for (const relay of config.nostrRelays) {
        tags.push(['r', relay, 'read']);
    }

    const event: EventTemplate = {
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: '',
    };

    return publishEvent(userId, event);
}

/**
 * Publish a Kind 1 announcement note to the BIES relay on behalf of a user.
 * Used for system events: new user joined, project created, lightning address added.
 * Only works for custodial-key users; Nostr-native users handle this client-side.
 */
export async function publishAnnouncement(
    userId: string,
    content: string,
    tags: string[][] = []
): Promise<string | null> {
    const event: EventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['t', 'bies'], ...tags],
        content,
    };

    return publishEvent(userId, event);
}

/**
 * Publish a NIP-52 time-based calendar event (Kind 31923).
 * Allows publishing to BIES relay only, public relays only, or both.
 */
export async function publishCalendarEvent(
    userId: string,
    event: {
        id: string;
        title: string;
        description: string;
        startDate: Date;
        endDate?: Date | null;
        location?: string;
        locationName?: string;
        locationAddress?: string;
        isOnline?: boolean;
        onlineUrl?: string;
        category?: string;
        tags?: string[];
        thumbnail?: string;
        ticketUrl?: string;
    },
    target: 'bies' | 'public' | 'both' = 'bies'
): Promise<string | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivkey: true, nostrPubkey: true },
        });

        if (!user || !user.encryptedPrivkey) {
            // Nostr-native user — signed client-side
            console.log(`[Nostr] User ${userId} has no custodial key, skipping server-side NIP-52 publish`);
            return null;
        }

        const privateKeyHex = decryptPrivateKey(user.encryptedPrivkey);
        const privateKeyBytes = hexToBytes(privateKeyHex);

        const startUnix = Math.floor(event.startDate.getTime() / 1000);
        const nip52Tags: string[][] = [
            ['d', event.id],
            ['title', event.title],
            ['start', String(startUnix)],
        ];

        if (event.endDate) {
            nip52Tags.push(['end', String(Math.floor(event.endDate.getTime() / 1000))]);
        }

        // Location tags
        if (event.location) {
            nip52Tags.push(['location', event.location]);
        }
        if (event.locationAddress) {
            nip52Tags.push(['g', event.locationAddress]); // geohash placeholder / address
        }

        // Online events
        if (event.isOnline && event.onlineUrl) {
            nip52Tags.push(['r', event.onlineUrl]);
        }

        // Metadata tags
        if (event.thumbnail) {
            nip52Tags.push(['image', event.thumbnail]);
        }
        if (event.ticketUrl) {
            nip52Tags.push(['r', event.ticketUrl]);
        }

        // Hashtags
        nip52Tags.push(['t', 'bies']);
        if (event.category) {
            nip52Tags.push(['t', event.category.toLowerCase().replace(/_/g, '-')]);
        }
        if (event.tags) {
            for (const tag of event.tags) {
                nip52Tags.push(['t', tag.toLowerCase()]);
            }
        }

        const nostrEvent: EventTemplate = {
            kind: 31923,
            created_at: Math.floor(Date.now() / 1000),
            tags: nip52Tags,
            content: event.description,
        };

        const { finalizeEvent } = await import('nostr-tools/pure');
        const signedEvent = finalizeEvent(nostrEvent, privateKeyBytes);

        const pool = await getPool();

        // Determine which relays to publish to
        const relays: string[] = [];
        if ((target === 'bies' || target === 'both') && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }
        if (target === 'public' || target === 'both') {
            relays.push(...config.nostrRelays);
        }
        // Fallback
        if (relays.length === 0 && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }

        const results = await Promise.allSettled(pool.publish(relays, signedEvent));
        const published = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Nostr] NIP-52 calendar event published to ${published}/${relays.length} relays (target: ${target})`);

        return published > 0 ? signedEvent.id : null;
    } catch (error) {
        console.error('[Nostr] NIP-52 publish error:', error);
        return null;
    }
}

/**
 * Publish a NIP-09 deletion event (Kind 5) to remove a calendar event from relays.
 * References the original event by its Nostr event ID.
 */
export async function deleteCalendarEvent(
    userId: string,
    nostrEventId: string,
    dTag: string,
    target: 'bies' | 'public' | 'both' = 'bies'
): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivkey: true, nostrPubkey: true },
        });

        if (!user || !user.encryptedPrivkey) {
            // Nostr-native user — deletion happens client-side
            return false;
        }

        const privateKeyHex = decryptPrivateKey(user.encryptedPrivkey);
        const privateKeyBytes = hexToBytes(privateKeyHex);

        const deletionEvent: EventTemplate = {
            kind: 5,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['e', nostrEventId],
                ['a', `31923:${user.nostrPubkey}:${dTag}`],
            ],
            content: 'Event deleted from BIES',
        };

        const { finalizeEvent } = await import('nostr-tools/pure');
        const signed = finalizeEvent(deletionEvent, privateKeyBytes);

        const pool = await getPool();
        const relays: string[] = [];
        if ((target === 'bies' || target === 'both') && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }
        if (target === 'public' || target === 'both') {
            relays.push(...config.nostrRelays);
        }
        if (relays.length === 0 && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }

        const results = await Promise.allSettled(pool.publish(relays, signed));
        const published = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Nostr] NIP-09 deletion published to ${published}/${relays.length} relays`);
        return published > 0;
    } catch (error) {
        console.error('[Nostr] NIP-09 deletion error:', error);
        return false;
    }
}

/**
 * Publish a NIP-52 calendar event RSVP (Kind 31925).
 */
export async function publishRSVPEvent(
    userId: string,
    eventData: {
        eventId: string;
        eventDTag: string;
        hostPubkey: string;
        status: 'accepted' | 'declined' | 'tentative';
    },
    target: 'bies' | 'public' | 'both' = 'bies'
): Promise<string | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivkey: true, nostrPubkey: true },
        });

        if (!user || !user.encryptedPrivkey) {
            return null;
        }

        const privateKeyHex = decryptPrivateKey(user.encryptedPrivkey);
        const privateKeyBytes = hexToBytes(privateKeyHex);

        const rsvpTags: string[][] = [
            ['d', `${eventData.eventDTag}-rsvp`],
            ['a', `31923:${eventData.hostPubkey}:${eventData.eventDTag}`],
            ['L', 'status'],
            ['l', eventData.status, 'status'],
            ['p', eventData.hostPubkey],
        ];

        const rsvpEvent: EventTemplate = {
            kind: 31925,
            created_at: Math.floor(Date.now() / 1000),
            tags: rsvpTags,
            content: '',
        };

        const { finalizeEvent } = await import('nostr-tools/pure');
        const signed = finalizeEvent(rsvpEvent, privateKeyBytes);

        const pool = await getPool();
        const relays: string[] = [];
        if ((target === 'bies' || target === 'both') && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }
        if (target === 'public' || target === 'both') {
            relays.push(...config.nostrRelays);
        }
        if (relays.length === 0 && config.nostrPrivateRelay) {
            relays.push(config.nostrPrivateRelay);
        }

        const results = await Promise.allSettled(pool.publish(relays, signed));
        const published = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Nostr] NIP-52 RSVP published to ${published}/${relays.length} relays (status: ${eventData.status})`);
        return published > 0 ? signed.id : null;
    } catch (error) {
        console.error('[Nostr] NIP-52 RSVP publish error:', error);
        return null;
    }
}

/**
 * Validate NIP-52 calendar event data before publishing.
 * Returns null if valid, or an error message string.
 */
export function validateCalendarEventData(event: {
    id?: string;
    title?: string;
    startDate?: Date | null;
}): string | null {
    if (!event.id) return 'Event ID (d-tag) is required';
    if (!event.title || event.title.trim().length === 0) return 'Event title is required';
    if (!event.startDate) return 'Start date is required';
    const startUnix = event.startDate.getTime();
    if (isNaN(startUnix)) return 'Start date is not a valid date';
    return null;
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
