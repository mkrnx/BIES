/**
 * Unit tests for the keytr gateway (WebAuthn rpId) ordering — the logic that
 * decides which rpId new passkeys register on (index 0) — and for the tier-3
 * discoverable-login fall-through chain (discoverThroughGateways), including
 * the cancellation-vs-empty-prompt semantics.
 *
 * Run with the built-in Node test runner (no browser, no extra deps):
 *   npm run test:unit        (or: node --test src/services/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGateways, discoverThroughGateways } from './gatewayOrder.js';

// Mirrors KEYTR_GATEWAYS from @sovit.xyz/keytr 0.8.0 (pinned dependency).
const PUBLIC_GATEWAYS = Object.freeze(['keytr.org', 'nostkey.org']);

test('Miami (app.buildinelsalvador.com) keeps the exact pre-fix production order', () => {
    assert.deepEqual(
        orderGateways('app.buildinelsalvador.com', PUBLIC_GATEWAYS),
        ['app.buildinelsalvador.com', 'keytr.org', 'nostkey.org'],
    );
});

test('self-hosted bies.sovit.xyz puts itself first, public gateways as backups', () => {
    assert.deepEqual(
        orderGateways('bies.sovit.xyz', PUBLIC_GATEWAYS),
        ['bies.sovit.xyz', 'keytr.org', 'nostkey.org'],
    );
});

test('a future domain not in the static gateway list still self-prioritizes', () => {
    assert.deepEqual(
        orderGateways('builders.example.org', PUBLIC_GATEWAYS),
        ['builders.example.org', 'keytr.org', 'nostkey.org'],
    );
});

test('a hostname that IS a public gateway is not duplicated', () => {
    assert.deepEqual(
        orderGateways('keytr.org', PUBLIC_GATEWAYS),
        ['keytr.org', 'nostkey.org'],
    );
});

test('localhost (dev/E2E) is the sole rpId — cross-origin rpIds are untestable there', () => {
    assert.deepEqual(orderGateways('localhost', PUBLIC_GATEWAYS), ['localhost']);
});

test('no hostname (no window) falls back to the public gateways only', () => {
    assert.deepEqual(orderGateways(undefined, PUBLIC_GATEWAYS), ['keytr.org', 'nostkey.org']);
});

test('no arguments at all yields an empty list rather than throwing', () => {
    assert.deepEqual(orderGateways(undefined), []);
});

test('never mutates the (readonly) gateway list from the keytr package', () => {
    const frozen = Object.freeze(['keytr.org', 'nostkey.org']);
    const out = orderGateways('bies.sovit.xyz', frozen); // throws if it mutates
    assert.notEqual(out, frozen); // always a fresh array
    assert.deepEqual(frozen, ['keytr.org', 'nostkey.org']);
});

test('registration/backup split: [0] is the origin rpId, slice(1) the backups', () => {
    const gws = orderGateways('bies.sovit.xyz', PUBLIC_GATEWAYS);
    assert.equal(gws[0], 'bies.sovit.xyz'); // saveWithPasskey → rpId === origin
    assert.deepEqual(gws.slice(1), ['keytr.org', 'nostkey.org']); // addBackupGateway
});

// ─── discoverThroughGateways — tier-3 discoverable-login fall-through ────────
//
// Fakes: a "cancel" error mimics the browser's NotAllowedError (dismissed
// prompt OR cancelled picker — indistinguishable by design), a "hard" error
// mimics SecurityError from an rpId that doesn't whitelist the origin.
const isCancel = (err) => err?.name === 'NotAllowedError';
const cancelErr = () => Object.assign(new Error('operation not allowed'), { name: 'NotAllowedError' });
const hardErr = (msg) => Object.assign(new Error(msg), { name: 'SecurityError' });

test('discover: first gateway succeeds — later gateways never prompted', async () => {
    const tried = [];
    const result = await discoverThroughGateways(
        ['bies.sovit.xyz', 'keytr.org', 'nostkey.org'],
        async (rpId) => { tried.push(rpId); return `nsec-via-${rpId}`; },
        isCancel,
    );
    assert.equal(result, 'nsec-via-bies.sovit.xyz');
    assert.deepEqual(tried, ['bies.sovit.xyz']); // single prompt for local credentials
});

test('discover: dismissing the empty serving-domain prompt still reaches the backup gateway (bies.sovit.xyz regression)', async () => {
    // The confirmed-finding scenario: user's passkey lives only under
    // keytr.org/nostkey.org rpIds; on bies.sovit.xyz the first (valid but
    // credential-empty) prompt is dismissed → NotAllowedError. That must NOT
    // abort the chain, or this cohort is hard-blocked on the self-hosted domain.
    const tried = [];
    const result = await discoverThroughGateways(
        ['bies.sovit.xyz', 'keytr.org', 'nostkey.org'],
        async (rpId) => {
            tried.push(rpId);
            if (rpId === 'bies.sovit.xyz') throw cancelErr(); // dismissed empty prompt
            return `nsec-via-${rpId}`;
        },
        isCancel,
    );
    assert.equal(result, 'nsec-via-keytr.org');
    assert.deepEqual(tried, ['bies.sovit.xyz', 'keytr.org']);
});

test('discover: hard errors (invalid rpId, no UI) fall through — pre-fix behaviour preserved', async () => {
    const result = await discoverThroughGateways(
        ['app.buildinelsalvador.com', 'keytr.org'],
        async (rpId) => {
            if (rpId === 'app.buildinelsalvador.com') throw hardErr('SecurityError: invalid rpId');
            return 'nsec-via-keytr.org';
        },
        isCancel,
    );
    assert.equal(result, 'nsec-via-keytr.org');
});

test('discover: cancelling every gateway classifies as user cancellation (silent in UI)', async () => {
    await assert.rejects(
        discoverThroughGateways(
            ['bies.sovit.xyz', 'keytr.org', 'nostkey.org'],
            async () => { throw cancelErr(); },
            isCancel,
        ),
        (err) => {
            assert.equal(err.cancelled, true);
            assert.equal(err.message, 'User cancelled passkey selection'); // exact UI contract
            return true;
        },
    );
});

test('discover: a cancellation anywhere outranks later hard errors — user already opted out', async () => {
    await assert.rejects(
        discoverThroughGateways(
            ['bies.sovit.xyz', 'keytr.org'],
            async (rpId) => {
                if (rpId === 'bies.sovit.xyz') throw cancelErr();
                throw hardErr('relay unreachable');
            },
            isCancel,
        ),
        (err) => err.cancelled === true,
    );
});

test('discover: all hard errors, no cancellation — the last error surfaces to the UI', async () => {
    await assert.rejects(
        discoverThroughGateways(
            ['keytr.org', 'nostkey.org'],
            async (rpId) => { throw hardErr(`fail:${rpId}`); },
            isCancel,
        ),
        (err) => {
            assert.equal(err.message, 'fail:nostkey.org');
            assert.notEqual(err.cancelled, true); // NOT silently swallowed
            return true;
        },
    );
});

test('discover: empty gateway list yields "no passkey found", not a cancellation', async () => {
    await assert.rejects(
        discoverThroughGateways([], async () => 'unreachable', isCancel),
        (err) => {
            assert.equal(err.message, 'No discoverable passkey found');
            assert.notEqual(err.cancelled, true);
            return true;
        },
    );
});

test('discover: gateways are attempted strictly in priority order', async () => {
    const tried = [];
    await assert.rejects(
        discoverThroughGateways(
            ['bies.sovit.xyz', 'keytr.org', 'nostkey.org'],
            async (rpId) => { tried.push(rpId); throw hardErr('nope'); },
            isCancel,
        ),
    );
    assert.deepEqual(tried, ['bies.sovit.xyz', 'keytr.org', 'nostkey.org']);
});
