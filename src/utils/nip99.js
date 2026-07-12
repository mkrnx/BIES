/**
 * NIP-99 (kind:30402) marketplace helpers — Shopstr-compatible.
 *
 * Pure, framework-free utilities shared by the client Nostr layer
 * (nostrService) and unit tests. The server (nostr.service.ts)
 * reimplements buildListingTags 1:1 for the custodial-key path —
 * keep the two builders in sync tag-for-tag.
 *
 * Shopstr conventions (shopstr-eng/shopstr):
 *  - content = description (markdown/plain); d = stable identifier reused on edit
 *  - published_at is set on first publish and PRESERVED on edits
 *  - price = [amount, currency]; one image tag per image URL; status active|sold
 *  - t tags include "shopstr" so listings surface in Shopstr's browse feed
 *  - listing URL: https://shopstr.store/listing/<naddr>
 */
import { nip19 } from 'nostr-tools';

export const MARKETPLACE_KIND = 30402;

export const MARKETPLACE_CATEGORIES = [
    'electronics', 'clothing', 'food', 'services', 'art', 'books', 'home', 'other',
];

export const SHOPSTR_BASE = 'https://shopstr.store/listing/';

// Base t-tags every BIES marketplace listing carries: "shopstr" puts the
// listing in Shopstr's browse feed; "bies" + "marketplace" drive our own
// filtering (and keep products distinct from directory/investment 30402s).
const BASE_TOPIC_TAGS = ['shopstr', 'bies', 'marketplace'];

const MAX_CATEGORY_TAGS = 8;
const MAX_NADDR_RELAY_HINTS = 3;

/** Stable d-tag for a new listing (uuid, per Shopstr convention). */
function newDTag() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (e.g. LAN dev over plain http)
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build the kind:30402 tag array + content for a marketplace listing.
 *
 * MUST stay byte-identical to buildMarketplaceListingTags in
 * server/src/services/nostr.service.ts (custodial twin).
 *
 * @param {Object} form - listing form
 * @param {string} form.title - required product title
 * @param {string} [form.summary] - short blurb (falls back to description)
 * @param {string} [form.description] - full description (becomes content)
 * @param {{amount: number|string, currency?: string}} [form.price]
 * @param {string[]} [form.images] - absolute public image URLs
 * @param {string} [form.location] - free-text location
 * @param {'active'|'sold'} [form.status]
 * @param {string[]} [form.categories] - lowercase category slugs
 * @param {Object} [options]
 * @param {string} [options.dTag] - existing d-tag (edits); omit for new listings
 * @param {number|string} [options.publishedAt] - original published_at (preserved on edits)
 * @returns {{ tags: string[][], content: string, dTag: string }}
 */
export function buildListingTags(form, { dTag, publishedAt } = {}) {
    const d = dTag || newDTag();
    const description = form.description || '';
    const summary = (form.summary || description).slice(0, 200);
    const amount = form.price?.amount ?? form.amount ?? 0;
    const currency = String(form.price?.currency ?? form.currency ?? 'SATS').toUpperCase();

    const tags = [
        ['d', d],
        ['title', form.title],
        ['summary', summary],
        // Set on first publish, preserved on edits (Shopstr convention)
        ['published_at', publishedAt != null && publishedAt !== ''
            ? String(publishedAt)
            : String(Math.floor(Date.now() / 1000))],
        ['price', String(amount), currency],
    ];

    for (const image of form.images || []) {
        if (image) tags.push(['image', image]);
    }
    if (form.location) tags.push(['location', form.location]);
    tags.push(['status', form.status === 'sold' ? 'sold' : 'active']);

    const seen = new Set(BASE_TOPIC_TAGS);
    for (const topic of BASE_TOPIC_TAGS) tags.push(['t', topic]);
    let categoryCount = 0;
    for (const category of form.categories || []) {
        const value = String(category).trim().toLowerCase();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        tags.push(['t', value]);
        if (++categoryCount >= MAX_CATEGORY_TAGS) break;
    }

    return { tags, content: description, dTag: d };
}

/**
 * Compute the shareable naddr for a listing ({ pubkey, dTag }).
 * Relay hints are capped — long hint lists make unwieldy URLs.
 */
export function listingNaddr(listing, relays = []) {
    return nip19.naddrEncode({
        kind: MARKETPLACE_KIND,
        pubkey: listing.pubkey,
        identifier: listing.dTag,
        ...(relays.length ? { relays: relays.slice(0, MAX_NADDR_RELAY_HINTS) } : {}),
    });
}

/** Shopstr web URL for a listing naddr. */
export function shopstrUrl(naddr) {
    return SHOPSTR_BASE + naddr;
}

/**
 * Parse a kind:30402 event into a marketplace listing object, or null if it
 * fails the marketplace filter. BIES also publishes directory (t:directory),
 * project (t:investment) and course-teaser (t:education) 30402s — those are
 * never products. Products must carry both a title and a parseable price.
 *
 * @param {Object} event - raw Nostr event
 * @param {string[]} [relayHints] - relays to embed in the computed naddr
 */

// BIES non-product kind:30402 usages, excluded from the marketplace feed:
// directory listings, investment projects, and paid-course lesson teasers
// (publishPaidLessonTeaser tags them t:education).
const EXCLUDED_TOPIC_TAGS = ['directory', 'investment', 'education'];

// Image URLs come from untrusted relay events — only render http(s).
const isSafeImageUrl = (url) => /^https?:\/\//i.test(url);

export function parseListingEvent(event, relayHints = []) {
    if (!event || event.kind !== MARKETPLACE_KIND || !Array.isArray(event.tags)) return null;

    let dTag = null;
    let title = null;
    let summary = '';
    let priceTag = null;
    let location = '';
    let status = 'active';
    let publishedAt = null;
    let contentWarning = false;
    const images = [];
    const topics = [];

    for (const tag of event.tags) {
        switch (tag[0]) {
            case 'd': if (dTag === null) dTag = tag[1] ?? ''; break;
            case 'title': if (title === null) title = tag[1] ?? ''; break;
            case 'summary': if (!summary) summary = tag[1] || ''; break;
            case 'price': if (!priceTag) priceTag = tag; break;
            case 'image': if (tag[1] && isSafeImageUrl(tag[1])) images.push(tag[1]); break;
            case 'location': if (!location) location = tag[1] || ''; break;
            case 'status': status = tag[1] === 'sold' ? 'sold' : 'active'; break;
            case 'published_at': {
                const ts = parseInt(tag[1], 10);
                if (!isNaN(ts)) publishedAt = ts;
                break;
            }
            case 'content-warning': contentWarning = true; break; // NIP-36
            case 't': if (tag[1]) topics.push(tag[1].toLowerCase()); break;
        }
    }

    // Marketplace filter (see module docblock)
    if (dTag === null || !title || !priceTag) return null;
    if (topics.some(t => EXCLUDED_TOPIC_TAGS.includes(t))) return null;

    const amount = Number(priceTag[1]);
    if (!Number.isFinite(amount)) return null;
    const currency = (priceTag[2] || 'SATS').toUpperCase();

    const categories = [...new Set(topics.filter(t => !BASE_TOPIC_TAGS.includes(t)))];

    return {
        id: event.id,
        pubkey: event.pubkey,
        dTag,
        title,
        summary,
        content: event.content || '',
        price: { amount, currency },
        images,
        location,
        status,
        categories,
        contentWarning,
        publishedAt: publishedAt ?? event.created_at,
        createdAt: event.created_at,
        naddr: listingNaddr({ pubkey: event.pubkey, dTag }, relayHints),
    };
}

/**
 * Deduplicate parsed listings, keeping the latest createdAt per
 * (pubkey, dTag) — 30402 is addressable/replaceable, but different relays
 * can hold different revisions.
 */
export function dedupeListings(listings) {
    const latest = new Map();
    for (const listing of listings) {
        const key = `${listing.pubkey}:${listing.dTag}`;
        const existing = latest.get(key);
        if (!existing || listing.createdAt > existing.createdAt) latest.set(key, listing);
    }
    return [...latest.values()];
}

/**
 * Check a parsed listing against a moderation blocklist.
 * @param {Object} listing - parsed listing ({ pubkey, dTag })
 * @param {{ pubkeys?: Set|string[], addresses?: Set|string[] }} blocklist
 *        address form: "30402:<pubkey>:<dTag>"
 */
export function isBlocked(listing, blocklist) {
    if (!listing || !blocklist) return false;
    const pubkeys = blocklist.pubkeys instanceof Set
        ? blocklist.pubkeys : new Set(blocklist.pubkeys || []);
    const addresses = blocklist.addresses instanceof Set
        ? blocklist.addresses : new Set(blocklist.addresses || []);
    return pubkeys.has(listing.pubkey)
        || addresses.has(`${MARKETPLACE_KIND}:${listing.pubkey}:${listing.dTag}`);
}
