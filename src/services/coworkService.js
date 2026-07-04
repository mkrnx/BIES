// Cowork check-in domain logic — pure Nostr, BIES private relay only.
//
// Check-ins are addressable (parameterized replaceable) events with a constant
// `d` tag, so the relay natively keeps exactly one check-in per user (the
// newest created_at replaces older ones). Check-out is a replacement event
// with status "ended" — it flows through the same replaceable-dedup path.
import { nostrService } from './nostrService';
import { nostrSigner } from './nostrSigner';
import { encodeGeohash } from '../utils/geohash';

// Kind 31980 is unregistered — events stay on the private BIES relay, so
// collision impact is negligible; keep the constant in one place for migration.
export const COWORK_KIND = 31980;
export const COWORK_D_TAG = 'cowork';
export const COWORK_DEFAULT_DURATION_H = 8;
// Ignore anything older than 12h even if the relay ignores NIP-40 expiration.
export const COWORK_MAX_AGE_S = 12 * 3600;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * Build an unsigned kind-31980 check-in event.
 *
 * @param {string} pubkey - hex pubkey of the author
 * @param {Object} data
 * @param {string} data.venueName - REQUIRED display name of the spot
 * @param {string} [data.venueId] - curated coworkSpots.js id
 * @param {string} [data.city]
 * @param {number} data.lat
 * @param {number} data.lng
 * @param {string} [data.note] - free-text note (0-280 chars)
 * @param {number} [data.spaces] - free seats
 * @param {string} [data.menu] - 'good' | 'ok' | 'basic'
 * @param {string} [data.coffee] - 'yes'
 * @param {string} [data.food] - 'yes'
 * @param {string} [data.wifi] - 'fast' | 'ok' | 'slow'
 * @param {number} [data.durationHours] - 2 | 4 | 8 (default 8)
 * @returns {Object} unsigned Nostr event
 */
export function buildCheckInEvent(pubkey, {
    venueName,
    venueId,
    city,
    lat,
    lng,
    note,
    spaces,
    menu,
    coffee,
    food,
    wifi,
    durationHours = COWORK_DEFAULT_DURATION_H,
}) {
    const nowSec = nowSeconds();
    const tags = [
        ['d', COWORK_D_TAG],
        ['status', 'active'],
        ['location', venueName],
    ];
    if (venueId) tags.push(['venue', venueId]);
    if (city) tags.push(['city', city]);
    tags.push(['latlng', lat.toFixed(6), lng.toFixed(6)]);
    tags.push(['g', encodeGeohash(lat, lng, 9)]);
    if (spaces != null) tags.push(['spaces', String(spaces)]);
    if (menu != null) tags.push(['menu', menu]);
    if (coffee != null) tags.push(['coffee', coffee]);
    if (food != null) tags.push(['food', food]);
    if (wifi != null) tags.push(['wifi', wifi]);
    tags.push(['expiration', String(nowSec + durationHours * 3600)]);
    tags.push(['t', 'bies-cowork']);

    return {
        kind: COWORK_KIND,
        pubkey,
        created_at: nowSec,
        content: note || '',
        tags,
    };
}

/**
 * Build an unsigned check-out event (replaces the active check-in).
 */
export function buildCheckOutEvent(pubkey) {
    const nowSec = nowSeconds();
    return {
        kind: COWORK_KIND,
        pubkey,
        created_at: nowSec,
        content: '',
        tags: [
            ['d', COWORK_D_TAG],
            ['status', 'ended'],
            ['expiration', String(nowSec + 300)],
            ['t', 'bies-cowork'],
        ],
    };
}

/**
 * Parse a raw Nostr event into a cowork session object.
 * Returns null for malformed / hostile events (the relay does no kind
 * validation, so never trust incoming payloads).
 */
export function parseCoworkEvent(evt) {
    if (!evt || evt.kind !== COWORK_KIND) return null;

    const tagMap = new Map();
    for (const tag of evt.tags || []) {
        if (Array.isArray(tag) && typeof tag[0] === 'string' && !tagMap.has(tag[0])) {
            tagMap.set(tag[0], tag);
        }
    }

    if (tagMap.get('d')?.[1] !== COWORK_D_TAG) return null;

    const createdAt = evt.created_at;
    // Clock-skew clamp: reject events "from the future".
    if (!Number.isFinite(createdAt) || createdAt > nowSeconds() + 900) return null;

    const status = tagMap.get('status')?.[1] || '';
    const latlng = tagMap.get('latlng');
    const lat = Number(latlng?.[1]);
    const lng = Number(latlng?.[2]);
    const venueName = tagMap.get('location')?.[1] || '';

    if (status === 'active' && (!Number.isFinite(lat) || !Number.isFinite(lng) || !venueName)) {
        return null;
    }

    const spacesRaw = tagMap.get('spaces')?.[1];
    const expirationRaw = tagMap.get('expiration')?.[1];

    return {
        id: evt.id,
        pubkey: evt.pubkey,
        createdAt,
        status,
        venueName,
        venueId: tagMap.get('venue')?.[1] || '',
        city: tagMap.get('city')?.[1] || '',
        lat,
        lng,
        note: typeof evt.content === 'string' ? evt.content : '',
        spaces: spacesRaw != null ? Number(spacesRaw) : null,
        menu: tagMap.get('menu')?.[1] || '',
        coffee: tagMap.get('coffee')?.[1] || '',
        food: tagMap.get('food')?.[1] || '',
        wifi: tagMap.get('wifi')?.[1] || '',
        expiration: expirationRaw != null ? Number(expirationRaw) : null,
    };
}

/**
 * Client-side active predicate — the relay may ignore NIP-40 expiration.
 */
export function isActive(session, nowSec) {
    return (
        session.status === 'active' &&
        (!session.expiration || session.expiration > nowSec) &&
        session.createdAt > nowSec - COWORK_MAX_AGE_S
    );
}

/**
 * Sign and publish a check-in to the BIES relay.
 * Returns the built (unsigned) event so callers can optimistically insert it.
 */
export async function checkIn(data) {
    const pubkey = await nostrSigner.getPublicKey();
    const event = buildCheckInEvent(pubkey, data);
    await nostrService.publishToBiesRelay(event);
    return event;
}

/**
 * Sign and publish a check-out (status "ended" replacement) to the BIES relay.
 */
export async function checkOut() {
    const pubkey = await nostrSigner.getPublicKey();
    const event = buildCheckOutEvent(pubkey);
    await nostrService.publishToBiesRelay(event);
    return event;
}

/**
 * Subscribe to cowork check-ins on the BIES relay (last 12h window).
 * Returns the subscription handle ({ close() }).
 */
export function subscribe(onEvent) {
    const nowSec = nowSeconds();
    return nostrService.subscribeToBiesRelay(
        {
            kinds: [COWORK_KIND],
            '#d': [COWORK_D_TAG],
            since: nowSec - COWORK_MAX_AGE_S,
            limit: 200,
        },
        onEvent,
    );
}

export const coworkService = {
    checkIn,
    checkOut,
    subscribe,
};
