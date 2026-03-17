/**
 * Playwright E2E test for message deduplication fix.
 *
 * Bug: When sending a NIP-17 DM, the optimistic message (id: 'pending-...')
 * and the relay-echoed message (id: real gift-wrap hex) both appear because
 * the dedup check only compares IDs, which are always different.
 *
 * Fix: When a relay-delivered message matches a pending message's content
 * and partner, replace the pending one instead of adding a duplicate.
 *
 * Strategy: Mock window.nostr (NIP-07) and WebSocket to control the full
 * message flow without real relay connections. After a message is sent,
 * deliver a properly signed gift-wrap through the mock relay that
 * decrypts to the same content — the dedup logic should keep count at 1.
 */

import { test, expect } from '@playwright/test';

// Valid secp256k1 public keys (private key 1 → G, private key 2 → 2G)
const SENDER_PK = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const RECIPIENT_PK = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';

// Fake user for the demo-token auth bypass
const FAKE_USER = {
    id: 'test-dedup-user',
    email: 'dedup@test.local',
    role: 'BUILDER',
    nostrPubkey: SENDER_PK,
    profile: { name: 'Dedup Tester' },
};

/**
 * Build a signed gift-wrap event using nostr-tools (runs in Node.js).
 * Content is btoa-encoded so the page-side mock decrypt can handle it.
 */
async function buildSignedGiftWrap(senderPk, recipientPk, messageContent) {
    const { finalizeEvent, generateSecretKey, getPublicKey } = await import('nostr-tools');

    const encode = (str) => Buffer.from(str, 'utf8').toString('base64');
    const now = Math.floor(Date.now() / 1000);

    const rumor = {
        kind: 14,
        content: messageContent,
        created_at: now,
        tags: [['p', recipientPk]],
        pubkey: senderPk,
    };

    const seal = {
        kind: 13,
        content: encode(JSON.stringify(rumor)),
        pubkey: senderPk,
        created_at: now,
        id: 'a'.repeat(64),
        sig: '0'.repeat(128),
    };

    // Generate a throwaway key to sign the gift-wrap (makes it pass verifyEvent)
    const throwawaysk = generateSecretKey();

    const giftWrapUnsigned = {
        kind: 1059,
        content: encode(JSON.stringify(seal)),
        tags: [['p', senderPk]],
        created_at: now,
    };

    // finalizeEvent computes the id (SHA-256 hash) and signs with the throwaway key
    const signedGiftWrap = finalizeEvent(giftWrapUnsigned, throwawaysk);

    return signedGiftWrap;
}

test.describe('Message deduplication', () => {

    /**
     * Set up page with mocked window.nostr and WebSocket.
     */
    async function setupMockedPage(page) {
        await page.addInitScript(({ senderPk, fakeUser }) => {
            // Set auth before any app code runs
            localStorage.setItem('bies_token', 'demo-token');
            localStorage.setItem('bies_user', JSON.stringify(fakeUser));

            // Track relay subscriptions and published events
            window.__relaySubscriptions = {};
            window.__sentEvents = [];

            // Mock NIP-07 Nostr extension
            const pk = senderPk;
            window.nostr = {
                getPublicKey: async () => pk,
                signEvent: async (event) => ({
                    ...event,
                    id: Array.from(crypto.getRandomValues(new Uint8Array(32)))
                        .map(b => b.toString(16).padStart(2, '0')).join(''),
                    pubkey: pk,
                    sig: '0'.repeat(128),
                }),
                nip44: {
                    encrypt: async (_pk, plaintext) =>
                        btoa(unescape(encodeURIComponent(plaintext))),
                    decrypt: async (_pk, ciphertext) =>
                        decodeURIComponent(escape(atob(ciphertext))),
                },
            };

            // Mock WebSocket to prevent real relay connections
            window.WebSocket = class MockWS extends EventTarget {
                constructor(url) {
                    super();
                    this.url = url;
                    this.readyState = 0;
                    this.CONNECTING = 0;
                    this.OPEN = 1;
                    this.CLOSING = 2;
                    this.CLOSED = 3;
                    this.bufferedAmount = 0;
                    this.extensions = '';
                    this.protocol = '';
                    this.binaryType = 'blob';

                    // Simulate connection open
                    setTimeout(() => {
                        this.readyState = 1;
                        const ev = new Event('open');
                        this.dispatchEvent(ev);
                        if (this.onopen) this.onopen(ev);
                    }, 5);
                }

                send(data) {
                    if (this.readyState !== 1) return;
                    try {
                        const msg = JSON.parse(data);
                        if (msg[0] === 'REQ') {
                            const subId = msg[1];
                            if (!window.__relaySubscriptions[subId]) {
                                window.__relaySubscriptions[subId] = [];
                            }
                            window.__relaySubscriptions[subId].push(this);
                            setTimeout(() =>
                                this._deliver(JSON.stringify(['EOSE', subId])), 10);
                        }
                        if (msg[0] === 'EVENT') {
                            window.__sentEvents.push(msg[1]);
                            setTimeout(() =>
                                this._deliver(JSON.stringify(['OK', msg[1].id, true, ''])), 10);
                        }
                        if (msg[0] === 'CLOSE') {
                            delete window.__relaySubscriptions[msg[1]];
                        }
                    } catch { /* ignore non-JSON */ }
                }

                _deliver(data) {
                    const ev = new MessageEvent('message', { data });
                    this.dispatchEvent(ev);
                    if (this.onmessage) this.onmessage(ev);
                }

                close() {
                    this.readyState = 3;
                    const ev = new CloseEvent('close', { code: 1000, reason: '' });
                    this.dispatchEvent(ev);
                    if (this.onclose) this.onclose(ev);
                }
            };
        }, { senderPk: SENDER_PK, fakeUser: FAKE_USER });

        // Intercept API calls to prevent 401 from clearing the demo auth
        await page.route('**/api/**', (route) => {
            const url = route.request().url();
            if (url.includes('/notifications')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: [], unreadCount: 0, count: 0 }),
                });
            }
            if (url.includes('/auth/me')) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(FAKE_USER),
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        // Navigate to home first to set localStorage on the correct origin
        await page.goto('/');
        await page.evaluate((fakeUser) => {
            localStorage.setItem('bies_token', 'demo-token');
            localStorage.setItem('bies_user', JSON.stringify(fakeUser));
        }, FAKE_USER);

        // Navigate to messages
        await page.goto('/messages');
        await page.waitForSelector('.messages-layout, .connect-container', { timeout: 15_000 });
    }

    /**
     * Deliver a pre-built signed gift-wrap through the mock relay.
     */
    async function deliverGiftWrap(page, signedEvent) {
        await page.evaluate((event) => {
            const subIds = Object.keys(window.__relaySubscriptions);
            for (const subId of subIds) {
                const sockets = window.__relaySubscriptions[subId];
                if (sockets && sockets.length > 0) {
                    sockets[0]._deliver(JSON.stringify(['EVENT', subId, event]));
                    break;
                }
            }
        }, signedEvent);
    }

    test('sent message does not duplicate when relay echoes it back', async ({ page }) => {
        await setupMockedPage(page);

        // Start a new chat with the recipient pubkey
        await page.click('button[title="New conversation"]');
        await page.fill('input[placeholder*="Search by name"]', RECIPIENT_PK);
        await page.keyboard.press('Enter');
        await page.waitForSelector('.chat-input-area', { timeout: 5_000 });

        // Send a message
        const msg = 'hello dedup ' + Date.now();
        await page.fill('.chat-input-area input', msg);
        await page.click('.send-btn');

        // Wait for optimistic message to appear
        await page.waitForSelector('.msg.sent', { timeout: 5_000 });
        expect(await page.locator('.msg.sent').count()).toBe(1);

        // Build a properly signed gift-wrap containing the same message
        const giftWrap = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);

        // Deliver through mock relay — simulates the relay echoing our sent message
        await deliverGiftWrap(page, giftWrap);

        // Give React time to process the state update
        await page.waitForTimeout(1000);

        // Should still be exactly 1 message (dedup replaced the pending one)
        const sentCount = await page.locator('.msg.sent').count();
        expect(sentCount).toBe(1);

        // Verify content is correct
        const msgText = await page.locator('.msg.sent p').textContent();
        expect(msgText).toBe(msg);
    });

    test('multiple rapid messages do not duplicate on relay echo', async ({ page }) => {
        await setupMockedPage(page);

        // Start a new chat
        await page.click('button[title="New conversation"]');
        await page.fill('input[placeholder*="Search by name"]', RECIPIENT_PK);
        await page.keyboard.press('Enter');
        await page.waitForSelector('.chat-input-area', { timeout: 5_000 });

        const messages = [
            'rapid-1-' + Date.now(),
            'rapid-2-' + Date.now(),
            'rapid-3-' + Date.now(),
        ];

        // Send all 3 messages
        for (const msg of messages) {
            await page.fill('.chat-input-area input', msg);
            await page.click('.send-btn');
            await page.waitForTimeout(150);
        }

        // Wait for all 3 optimistic messages
        await expect(page.locator('.msg.sent')).toHaveCount(3, { timeout: 5_000 });

        // Build and deliver signed echoes for all 3
        for (const msg of messages) {
            const gw = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
            await deliverGiftWrap(page, gw);
        }

        await page.waitForTimeout(1000);

        // Should still be exactly 3, not 6
        expect(await page.locator('.msg.sent').count()).toBe(3);
    });
});
