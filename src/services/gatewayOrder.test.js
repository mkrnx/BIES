/**
 * Unit tests for the keytr gateway (WebAuthn rpId) ordering — the logic that
 * decides which rpId new passkeys register on (index 0) and the discoverable
 * login fallback chain.
 *
 * Run with the built-in Node test runner (no browser, no extra deps):
 *   npm run test:unit        (or: node --test src/services/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderGateways } from './gatewayOrder.js';

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
