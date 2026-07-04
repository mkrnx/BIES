/**
 * BIES issuer identity — a shared server-side Nostr key used to sign events
 * the *platform* (not a member) publishes: NIP-58 badge definitions/awards
 * today, NIP-32 certification labels later (Feature A phase 2).
 *
 * The key comes from `BIES_ISSUER_PRIVKEY` (hex or nsec). When unset or
 * invalid the issuer is disabled: every helper returns null and one warning
 * is logged — in-app behavior is unaffected.
 */

// nostr-tools is ESM-only (@noble/curves has no CJS build);
// use dynamic import() so the compiled CJS output doesn't call require().
import type { EventTemplate } from 'nostr-tools/pure';
import { config } from '../config';
import { addToRelayWhitelist } from '../controllers/auth.controller';

export interface IssuerKeys {
    privkey: Uint8Array;
    pubkey: string; // hex
}

let _pool: InstanceType<Awaited<typeof import('nostr-tools/pool')>['SimplePool']> | null = null;
async function getPool() {
    if (!_pool) {
        const { SimplePool } = await import('nostr-tools/pool');
        _pool = new SimplePool();
    }
    return _pool;
}

const HEX_PRIVKEY_RE = /^[0-9a-f]{64}$/i;

let resolved = false;
let issuerKeys: IssuerKeys | null = null;

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Resolve the issuer key pair from `BIES_ISSUER_PRIVKEY` (hex or nsec).
 * Resolved once and cached; returns null (after a single warn log) when the
 * env var is unset or invalid.
 */
export async function getIssuerKeys(): Promise<IssuerKeys | null> {
    if (resolved) return issuerKeys;
    resolved = true;

    const raw = config.issuerPrivkey.trim();
    if (!raw) {
        console.warn(
            '[Issuer] BIES_ISSUER_PRIVKEY not set — Nostr badge publishing disabled (in-app badges unaffected)'
        );
        return null;
    }

    try {
        let privkey: Uint8Array | null = null;

        if (HEX_PRIVKEY_RE.test(raw)) {
            privkey = hexToBytes(raw.toLowerCase());
        } else if (raw.startsWith('nsec1')) {
            const nip19 = await import('nostr-tools/nip19');
            const decoded = nip19.decode(raw);
            if (decoded.type === 'nsec') {
                privkey = decoded.data;
            }
        }

        if (!privkey) {
            console.warn(
                '[Issuer] BIES_ISSUER_PRIVKEY is not a valid hex key or nsec — Nostr badge publishing disabled'
            );
            return null;
        }

        const { getPublicKey } = await import('nostr-tools/pure');
        issuerKeys = { privkey, pubkey: getPublicKey(privkey) };
        console.log(`[Issuer] Issuer identity loaded (${issuerKeys.pubkey.substring(0, 8)}...)`);
        return issuerKeys;
    } catch {
        // Deliberately not logging the error: bech32/nip19 decode errors can
        // embed the raw input, which may be a mistyped real private key.
        console.warn(
            '[Issuer] Failed to parse BIES_ISSUER_PRIVKEY (malformed hex/nsec) — Nostr badge publishing disabled'
        );
        return null;
    }
}

/** Hex pubkey of the issuer, or null when the issuer is disabled. */
export async function getIssuerPubkey(): Promise<string | null> {
    return (await getIssuerKeys())?.pubkey ?? null;
}

/**
 * Add the issuer pubkey to the relay whitelist file (the same mechanism
 * used for member pubkeys on login) so the strfry write policy accepts the
 * issuer's events. Idempotent; no-op when the issuer is disabled.
 */
export async function ensureIssuerWhitelisted(): Promise<void> {
    const issuer = await getIssuerKeys();
    if (issuer) {
        addToRelayWhitelist(issuer.pubkey);
    }
}

/**
 * Sign an event template with the issuer key and publish it, mirroring
 * `publishEvent` (nostr.service.ts): private relay when configured,
 * otherwise the public relay set. Never throws.
 *
 * @returns the signed event id, or null when disabled or publish failed.
 */
export async function publishAsIssuer(eventTemplate: EventTemplate): Promise<string | null> {
    try {
        const issuer = await getIssuerKeys();
        if (!issuer) return null;

        const { finalizeEvent } = await import('nostr-tools/pure');
        const signedEvent = finalizeEvent(eventTemplate, issuer.privkey);

        const pool = await getPool();
        const relays = config.nostrPrivateRelay
            ? [config.nostrPrivateRelay]
            : config.nostrRelays;
        const results = await Promise.allSettled(pool.publish(relays, signedEvent));

        const published = results.filter((r) => r.status === 'fulfilled').length;
        if (published === 0) {
            console.error(
                `[Issuer] Publish failed on all ${relays.length} relays (kind ${eventTemplate.kind})`
            );
            return null;
        }
        return signedEvent.id;
    } catch (error) {
        console.error('[Issuer] Publish error:', error);
        return null;
    }
}
