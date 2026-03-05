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
): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivkey: true, nostrPubkey: true },
        });

        if (!user || !user.encryptedPrivkey) {
            // Nostr-native user — they sign on the client side
            console.log(`[Nostr] User ${userId} has no custodial key, skipping server-side publish`);
            return false;
        }

        // Decrypt the private key
        const privateKeyHex = decryptPrivateKey(user.encryptedPrivkey);
        const privateKeyBytes = hexToBytes(privateKeyHex);

        // Finalize (sign) the event
        const { finalizeEvent } = await import('nostr-tools/pure');
        const signedEvent = finalizeEvent(eventTemplate, privateKeyBytes);

        // Publish to relays
        const pool = await getPool();
        const results = await Promise.allSettled(
            pool.publish(config.nostrRelays, signedEvent)
        );

        const published = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[Nostr] Published to ${published}/${config.nostrRelays.length} relays`);

        return published > 0;
    } catch (error) {
        console.error('[Nostr] Publish error:', error);
        return false;
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
        website?: string;
    }
): Promise<boolean> {
    const event: EventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
            name: profile.name,
            about: profile.about || '',
            picture: profile.picture || '',
            website: profile.website || '',
        }),
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
): Promise<boolean> {
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
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
