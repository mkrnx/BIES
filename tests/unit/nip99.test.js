/**
 * Fixture tests for src/utils/nip99.js (NIP-99 / Shopstr marketplace helpers).
 *
 * Run: npm run test:unit   (node --test — no network, no relays, pure fixtures)
 *
 * The fixtures mirror the real event shapes BIES interoperates with:
 *  - a Shopstr-style kind:30402 classified listing (shopstr-eng/shopstr tag
 *    vocabulary: d/title/summary/published_at/price/image/location/status/t,
 *    plus tags our parser must ignore: alt, g, shipping)
 *  - BIES directory 30402s (publishDirectoryListing — t:directory, no price)
 *  - BIES course-lesson teasers (publishPaidLessonTeaser — t:education WITH
 *    title+price, the cross-contamination case introduced by PR #333)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nip19 } from 'nostr-tools';
import {
    MARKETPLACE_KIND,
    SHOPSTR_BASE,
    buildListingTags,
    parseListingEvent,
    dedupeListings,
    listingNaddr,
    shopstrUrl,
    isBlocked,
} from '../../src/utils/nip99.js';

const SELLER_PUBKEY = 'e8b487c079b0f67c695ae6c4c2552a47f38adfa2533cc5926bd2c102942fdcb7';
const OTHER_PUBKEY = '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245';
const EVENT_ID_A = '43f02c04e17bcd5f8d4b160b719a8f9b394a2a5f14fca1d4e2b6f9e0a4c8d301';
const EVENT_ID_B = '7d6f0e2ab9c1543ef8a2b7d90c34e6f15a8b29d7e4c1f0a3b6d95e82c7f41d09';

const HINT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es', 'wss://relay.nostr.band'];

/** Shopstr-shaped classified listing (kind 30402). */
const shopstrEvent = {
    id: EVENT_ID_A,
    pubkey: SELLER_PUBKEY,
    kind: 30402,
    created_at: 1752300000,
    content: 'Hand-poured beeswax candles from El Zonte. Ships anywhere in El Salvador.',
    sig: 'f'.repeat(128),
    tags: [
        ['d', '9a2e64c1-30dc-4f2a-b21e-8f6e3f8c2f11'],
        ['alt', 'Classified listing: Beeswax candles (set of 4)'],
        ['title', 'Beeswax candles (set of 4)'],
        ['summary', 'Hand-poured beeswax candles from El Zonte.'],
        ['published_at', '1752290000'],
        ['price', '21000', 'sats'],
        ['image', 'https://image.nostr.build/candles-main.jpg'],
        ['image', 'https://image.nostr.build/candles-detail.jpg'],
        ['location', 'El Zonte, La Libertad'],
        ['status', 'active'],
        ['g', '9q5c'],
        ['shipping', '2500', 'SATS'],
        ['t', 'shopstr'],
        ['t', 'handmade'],
        ['t', 'home'],
    ],
};

/** BIES directory listing (publishDirectoryListing) — never a product. */
const directoryEvent = {
    id: EVENT_ID_B,
    pubkey: SELLER_PUBKEY,
    kind: 30402,
    created_at: 1752300001,
    content: 'Regenerative farm collective.',
    sig: 'f'.repeat(128),
    tags: [
        ['d', 'dir-listing-1'],
        ['title', 'Finca Esperanza'],
        ['summary', 'Regenerative farm collective.'],
        ['t', 'bies'],
        ['t', 'directory'],
        ['t', 'farm'],
        // give it a price so the test proves the t-tag exclusion alone rejects it
        ['price', '100', 'USD'],
    ],
};

/** BIES paid-course lesson teaser (publishPaidLessonTeaser, PR #333). */
const courseTeaserEvent = {
    id: EVENT_ID_B,
    pubkey: SELLER_PUBKEY,
    kind: 30402,
    created_at: 1752300002,
    content: 'Learn Bitcoin self-custody basics.',
    sig: 'f'.repeat(128),
    tags: [
        ['d', 'lesson-cuid-123'],
        ['title', 'Lesson 3: Hardware wallets'],
        ['summary', 'Learn Bitcoin self-custody basics.'],
        ['published_at', '1752290002'],
        ['price', '5000', 'SATS'],
        ['t', 'bies'],
        ['t', 'education'],
        ['t', 'bitcoin'],
    ],
};

// ─── parseListingEvent ────────────────────────────────────────────────────────

test('parseListingEvent extracts a Shopstr-shaped listing', () => {
    const listing = parseListingEvent(shopstrEvent, HINT_RELAYS);
    assert.ok(listing, 'shopstr event should parse');
    assert.equal(listing.id, EVENT_ID_A);
    assert.equal(listing.pubkey, SELLER_PUBKEY);
    assert.equal(listing.dTag, '9a2e64c1-30dc-4f2a-b21e-8f6e3f8c2f11');
    assert.equal(listing.title, 'Beeswax candles (set of 4)');
    assert.equal(listing.summary, 'Hand-poured beeswax candles from El Zonte.');
    assert.equal(listing.content, shopstrEvent.content);
    assert.deepEqual(listing.price, { amount: 21000, currency: 'SATS' }); // currency uppercased
    assert.deepEqual(listing.images, [
        'https://image.nostr.build/candles-main.jpg',
        'https://image.nostr.build/candles-detail.jpg',
    ]);
    assert.equal(listing.location, 'El Zonte, La Libertad');
    assert.equal(listing.status, 'active');
    assert.equal(listing.publishedAt, 1752290000); // from published_at tag, not created_at
    assert.equal(listing.createdAt, 1752300000);
    assert.equal(listing.contentWarning, false);
    // base topic tags stripped from categories, others kept
    assert.deepEqual(listing.categories, ['handmade', 'home']);
});

test('parseListingEvent naddr round-trips through nip19 with capped relay hints', () => {
    const listing = parseListingEvent(shopstrEvent, HINT_RELAYS);
    const decoded = nip19.decode(listing.naddr);
    assert.equal(decoded.type, 'naddr');
    assert.equal(decoded.data.kind, MARKETPLACE_KIND);
    assert.equal(decoded.data.pubkey, SELLER_PUBKEY);
    assert.equal(decoded.data.identifier, listing.dTag);
    assert.deepEqual(decoded.data.relays, HINT_RELAYS.slice(0, 3)); // capped at 3
});

test('parseListingEvent rejects non-marketplace events', () => {
    assert.equal(parseListingEvent(null), null);
    assert.equal(parseListingEvent({ ...shopstrEvent, kind: 30023 }), null);
    assert.equal(parseListingEvent({ ...shopstrEvent, tags: 'nope' }), null);

    // missing title
    const noTitle = { ...shopstrEvent, tags: shopstrEvent.tags.filter((t) => t[0] !== 'title') };
    assert.equal(parseListingEvent(noTitle), null);

    // missing price
    const noPrice = { ...shopstrEvent, tags: shopstrEvent.tags.filter((t) => t[0] !== 'price') };
    assert.equal(parseListingEvent(noPrice), null);

    // unparseable price amount
    const badPrice = {
        ...shopstrEvent,
        tags: shopstrEvent.tags.map((t) => (t[0] === 'price' ? ['price', 'free', 'SATS'] : t)),
    };
    assert.equal(parseListingEvent(badPrice), null);

    // missing d tag
    const noD = { ...shopstrEvent, tags: shopstrEvent.tags.filter((t) => t[0] !== 'd') };
    assert.equal(parseListingEvent(noD), null);
});

test('parseListingEvent excludes BIES directory, investment and course-teaser 30402s', () => {
    assert.equal(parseListingEvent(directoryEvent), null, 't:directory must be excluded');
    assert.equal(parseListingEvent(courseTeaserEvent), null, 't:education (course teaser) must be excluded');

    const investmentEvent = {
        ...directoryEvent,
        tags: directoryEvent.tags.map((t) => (t[1] === 'directory' ? ['t', 'investment'] : t)),
    };
    assert.equal(parseListingEvent(investmentEvent), null, 't:investment must be excluded');
});

test('parseListingEvent drops non-http(s) image URLs from untrusted events', () => {
    const evil = {
        ...shopstrEvent,
        tags: [
            ...shopstrEvent.tags,
            ['image', 'javascript:alert(1)'],
            ['image', 'data:text/html,<script>alert(1)</script>'],
            ['image', 'file:///etc/passwd'],
        ],
    };
    const listing = parseListingEvent(evil);
    assert.deepEqual(listing.images, [
        'https://image.nostr.build/candles-main.jpg',
        'https://image.nostr.build/candles-detail.jpg',
    ]);
});

test('parseListingEvent surfaces NIP-36 content-warning', () => {
    const flagged = {
        ...shopstrEvent,
        tags: [...shopstrEvent.tags, ['content-warning', 'adult content']],
    };
    assert.equal(parseListingEvent(flagged).contentWarning, true);
});

test('parseListingEvent normalizes status', () => {
    const sold = {
        ...shopstrEvent,
        tags: shopstrEvent.tags.map((t) => (t[0] === 'status' ? ['status', 'sold'] : t)),
    };
    assert.equal(parseListingEvent(sold).status, 'sold');

    const weird = {
        ...shopstrEvent,
        tags: shopstrEvent.tags.map((t) => (t[0] === 'status' ? ['status', 'pending'] : t)),
    };
    assert.equal(parseListingEvent(weird).status, 'active');
});

// ─── dedupeListings ───────────────────────────────────────────────────────────

test('dedupeListings keeps the latest revision per (pubkey, dTag)', () => {
    const older = parseListingEvent(shopstrEvent);
    const newer = parseListingEvent({ ...shopstrEvent, id: EVENT_ID_B, created_at: 1752400000 });
    const otherSellerSameD = parseListingEvent({ ...shopstrEvent, pubkey: OTHER_PUBKEY });

    const deduped = dedupeListings([older, newer, otherSellerSameD]);
    assert.equal(deduped.length, 2, 'same (pubkey,d) collapses; different pubkey kept');
    const mine = deduped.find((l) => l.pubkey === SELLER_PUBKEY);
    assert.equal(mine.id, EVENT_ID_B);
    assert.equal(mine.createdAt, 1752400000);
});

// ─── buildListingTags ─────────────────────────────────────────────────────────

test('buildListingTags emits the exact Shopstr-compatible tag set', () => {
    const { tags, content, dTag } = buildListingTags(
        {
            title: 'Beeswax candles (set of 4)',
            summary: 'Hand-poured beeswax candles.',
            description: 'Hand-poured beeswax candles from El Zonte.',
            price: { amount: 21000, currency: 'sats' },
            images: ['https://image.nostr.build/a.jpg', '', 'https://image.nostr.build/b.jpg'],
            location: 'El Zonte, La Libertad',
            status: 'sold',
            categories: ['Handmade', 'home', 'handmade', 'bies', ''], // dupes/base/empties dropped
        },
        { dTag: 'fixed-d-tag', publishedAt: 1752290000 }
    );

    assert.equal(dTag, 'fixed-d-tag');
    assert.equal(content, 'Hand-poured beeswax candles from El Zonte.');
    assert.deepEqual(tags, [
        ['d', 'fixed-d-tag'],
        ['title', 'Beeswax candles (set of 4)'],
        ['summary', 'Hand-poured beeswax candles.'],
        ['published_at', '1752290000'],
        ['price', '21000', 'SATS'],
        ['image', 'https://image.nostr.build/a.jpg'],
        ['image', 'https://image.nostr.build/b.jpg'],
        ['location', 'El Zonte, La Libertad'],
        ['status', 'sold'],
        ['t', 'shopstr'],
        ['t', 'bies'],
        ['t', 'marketplace'],
        ['t', 'handmade'],
        ['t', 'home'],
    ]);
});

test('buildListingTags defaults: fresh uuid d-tag, now() published_at, summary from description, active status', () => {
    const before = Math.floor(Date.now() / 1000);
    const { tags, dTag } = buildListingTags({
        title: 'Item',
        description: 'x'.repeat(300),
        price: { amount: '150', currency: 'usd' },
    });
    const tag = (name) => tags.find((t) => t[0] === name);

    assert.match(dTag, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    assert.equal(tag('summary')[1].length, 200); // description sliced to 200
    assert.ok(Number(tag('published_at')[1]) >= before);
    assert.deepEqual(tag('price'), ['price', '150', 'USD']);
    assert.deepEqual(tag('status'), ['status', 'active']);
});

test('buildListingTags caps category tags at 8', () => {
    const categories = Array.from({ length: 12 }, (_, i) => `cat-${i}`);
    const { tags } = buildListingTags(
        { title: 'Item', price: { amount: 1 }, categories },
        { dTag: 'd', publishedAt: 1 }
    );
    const topicValues = tags.filter((t) => t[0] === 't').map((t) => t[1]);
    assert.deepEqual(topicValues.slice(0, 3), ['shopstr', 'bies', 'marketplace']);
    assert.equal(topicValues.length, 3 + 8);
});

test('buildListingTags → parseListingEvent round-trip', () => {
    const { tags, content } = buildListingTags(
        {
            title: 'Round trip',
            description: 'Desc',
            price: { amount: 42, currency: 'SATS' },
            images: ['https://img.example/1.jpg'],
            location: 'San Salvador',
            categories: ['art'],
        },
        { dTag: 'rt-d', publishedAt: 1752290000 }
    );
    const listing = parseListingEvent({
        id: EVENT_ID_A,
        pubkey: SELLER_PUBKEY,
        kind: 30402,
        created_at: 1752300000,
        content,
        tags,
    });
    assert.ok(listing, 'our own published shape must parse back');
    assert.equal(listing.title, 'Round trip');
    assert.deepEqual(listing.price, { amount: 42, currency: 'SATS' });
    assert.deepEqual(listing.categories, ['art']);
    assert.equal(listing.publishedAt, 1752290000);
    assert.equal(listing.dTag, 'rt-d');
});

// ─── listingNaddr / shopstrUrl ────────────────────────────────────────────────

test('listingNaddr encodes and shopstrUrl prefixes it', () => {
    const naddr = listingNaddr({ pubkey: SELLER_PUBKEY, dTag: 'abc' }, HINT_RELAYS);
    assert.ok(naddr.startsWith('naddr1'));
    const decoded = nip19.decode(naddr);
    assert.equal(decoded.data.identifier, 'abc');
    assert.deepEqual(decoded.data.relays, HINT_RELAYS.slice(0, 3));
    assert.equal(shopstrUrl(naddr), `${SHOPSTR_BASE}${naddr}`);

    // no relays → no relay field
    const bare = nip19.decode(listingNaddr({ pubkey: SELLER_PUBKEY, dTag: 'abc' }));
    assert.ok(!bare.data.relays || bare.data.relays.length === 0);
});

// ─── isBlocked ────────────────────────────────────────────────────────────────

test('isBlocked matches pubkey and address blocks, Sets or arrays', () => {
    const listing = parseListingEvent(shopstrEvent);
    const address = `30402:${SELLER_PUBKEY}:${listing.dTag}`;

    assert.equal(isBlocked(listing, { pubkeys: [SELLER_PUBKEY] }), true);
    assert.equal(isBlocked(listing, { pubkeys: new Set([SELLER_PUBKEY]) }), true);
    assert.equal(isBlocked(listing, { addresses: [address] }), true);
    assert.equal(isBlocked(listing, { addresses: new Set([address]) }), true);
    assert.equal(isBlocked(listing, { pubkeys: [OTHER_PUBKEY], addresses: [`30402:${OTHER_PUBKEY}:x`] }), false);
    assert.equal(isBlocked(listing, null), false);
    assert.equal(isBlocked(null, { pubkeys: [SELLER_PUBKEY] }), false);
});
