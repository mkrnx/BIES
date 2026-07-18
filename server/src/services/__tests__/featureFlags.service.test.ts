/**
 * Unit tests for the runtime feature-toggle service — storage parsing
 * (unknown-slug tolerance, malformed-JSON fail-open), merge validation, and
 * the cached read / invalidating write paths against a mocked Prisma client.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
    default: {
        siteSettings: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import prisma from '../../lib/prisma';
import { cache, cacheKey } from '../redis.service';
import {
    FEATURE_SLUGS,
    defaultFlags,
    parseStoredFlags,
    mergeFlags,
    isValidSlug,
    getFlags,
    isEnabled,
    setFlags,
} from '../featureFlags.service';

const mockedFind = prisma.siteSettings.findUnique as ReturnType<typeof vi.fn>;
const mockedUpsert = prisma.siteSettings.upsert as ReturnType<typeof vi.fn>;

beforeEach(async () => {
    vi.clearAllMocks();
    await cache.del(cacheKey.featureFlags());
});

describe('parseStoredFlags (pure)', () => {
    it('defaults every known slug to enabled when storage is empty', () => {
        for (const raw of [null, undefined, '', '{}']) {
            const flags = parseStoredFlags(raw as string | null | undefined);
            expect(flags).toEqual(defaultFlags());
            for (const slug of FEATURE_SLUGS) expect(flags[slug]).toBe(true);
        }
    });

    it('applies stored booleans and defaults missing slugs to true', () => {
        const flags = parseStoredFlags('{"points":false,"zaps":false}');
        expect(flags.points).toBe(false);
        expect(flags.zaps).toBe(false);
        expect(flags.directories).toBe(true);
        expect(flags.cowork).toBe(true);
    });

    it('ignores unknown slugs in storage (old rows never break)', () => {
        const flags = parseStoredFlags('{"retired_feature":false,"news":false}') as Record<string, boolean>;
        expect(flags.news).toBe(false);
        expect('retired_feature' in flags).toBe(false);
    });

    it('ignores non-boolean values for known slugs', () => {
        const flags = parseStoredFlags('{"points":"off","events":0}');
        expect(flags.points).toBe(true);
        expect(flags.events).toBe(true);
    });

    it('fails open (all enabled) on malformed JSON', () => {
        for (const raw of ['not json', '[1,2]', '"string"', '{broken']) {
            expect(parseStoredFlags(raw)).toEqual(defaultFlags());
        }
    });
});

describe('mergeFlags (pure)', () => {
    it('overlays the partial onto the current map', () => {
        const merged = mergeFlags(defaultFlags(), { points: false });
        expect(merged.points).toBe(false);
        expect(merged.news).toBe(true);
    });

    it('throws on unknown slugs', () => {
        expect(() => mergeFlags(defaultFlags(), { nope: true } as never)).toThrow(/Unknown feature slug/);
    });

    it('throws on non-boolean values', () => {
        expect(() => mergeFlags(defaultFlags(), { points: 'yes' } as never)).toThrow(/must be a boolean/);
    });

    it('does not mutate the input map', () => {
        const current = defaultFlags();
        mergeFlags(current, { points: false });
        expect(current.points).toBe(true);
    });
});

describe('isValidSlug (pure)', () => {
    it('accepts every canonical slug and rejects everything else', () => {
        for (const slug of FEATURE_SLUGS) expect(isValidSlug(slug)).toBe(true);
        expect(isValidSlug('admin')).toBe(false);
        expect(isValidSlug('')).toBe(false);
        expect(isValidSlug('__proto__')).toBe(false);
    });
});

describe('getFlags / isEnabled (service)', () => {
    it('reads from the DB, caches, and serves the cache on the next call', async () => {
        mockedFind.mockResolvedValue({ featureFlags: '{"media":false}' });

        const first = await getFlags();
        expect(first.media).toBe(false);
        expect(mockedFind).toHaveBeenCalledTimes(1);

        const second = await getFlags();
        expect(second.media).toBe(false);
        expect(mockedFind).toHaveBeenCalledTimes(1); // cache hit — no second DB read
    });

    it('defaults to all-enabled when no settings row exists', async () => {
        mockedFind.mockResolvedValue(null);
        expect(await getFlags()).toEqual(defaultFlags());
    });

    it('fails open on a DB error and does not cache the fallback', async () => {
        mockedFind.mockRejectedValueOnce(new Error('db down'));
        expect(await getFlags()).toEqual(defaultFlags());

        // Next read hits the DB again (the error fallback was not cached).
        mockedFind.mockResolvedValueOnce({ featureFlags: '{"news":false}' });
        expect((await getFlags()).news).toBe(false);
    });

    it('isEnabled reflects the stored flag', async () => {
        mockedFind.mockResolvedValue({ featureFlags: '{"messages":false}' });
        expect(await isEnabled('messages')).toBe(false);
        expect(await isEnabled('events')).toBe(true);
    });
});

describe('setFlags (service)', () => {
    it('merges over stored flags, persists the full map, and invalidates the cache', async () => {
        // Prime the cache with the current state.
        mockedFind.mockResolvedValue({ featureFlags: '{"points":false}' });
        expect((await getFlags()).points).toBe(false);

        // Update a different slug — the stored `points:false` must survive.
        const updated = await setFlags({ zaps: false });
        expect(updated.points).toBe(false);
        expect(updated.zaps).toBe(false);

        expect(mockedUpsert).toHaveBeenCalledTimes(1);
        const upsertArg = mockedUpsert.mock.calls[0][0];
        const persisted = JSON.parse(upsertArg.update.featureFlags);
        expect(persisted.points).toBe(false);
        expect(persisted.zaps).toBe(false);
        expect(persisted.directories).toBe(true);

        // Cache was invalidated: the next getFlags re-reads the DB.
        mockedFind.mockResolvedValue({ featureFlags: upsertArg.update.featureFlags });
        const fresh = await getFlags();
        expect(fresh.zaps).toBe(false);
    });

    it('rejects unknown slugs without persisting anything', async () => {
        mockedFind.mockResolvedValue(null);
        await expect(setFlags({ bogus: false } as never)).rejects.toThrow(/Unknown feature slug/);
        expect(mockedUpsert).not.toHaveBeenCalled();
    });
});
