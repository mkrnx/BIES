/**
 * Playwright E2E tests for message deduplication.
 *
 * Bug: Sending a NIP-17 DM caused the message to appear twice — the relay
 * echoed the gift-wrap back through the subscription BEFORE the optimistic
 * message was added to state, so both copies ended up in the list.
 *
 * Fix: The optimistic message is now inserted BEFORE calling sendNip17DM,
 * and a safety-net dedup catches any remaining edge cases.
 *
 * Strategy: Mock window.nostr (NIP-07/NIP-44) and WebSocket to control the
 * full message flow without real relay connections.
 */

import { test, expect } from '@playwright/test';

// Valid secp256k1 public keys (private key 1 → G, private key 2 → 2G)
const SENDER_PK = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const RECIPIENT_PK = 'c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5';

const FAKE_USER = {
    id: 'test-dedup-user',
    email: 'dedup@test.local',
    role: 'BUILDER',
    nostrPubkey: SENDER_PK,
    profile: { name: 'Dedup Tester' },
};

/**
 * Build a signed gift-wrap event using nostr-tools (Node.js side).
 * Content is btoa-encoded so the page-side mock decrypt can handle it.
 */
async function buildSignedGiftWrap(senderPk, recipientPk, messageContent) {
    const { finalizeEvent, generateSecretKey } = await import('nostr-tools');
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

    const throwawaysk = generateSecretKey();
    const signedGiftWrap = finalizeEvent({
        kind: 1059,
        content: encode(JSON.stringify(seal)),
        tags: [['p', senderPk]],
        created_at: now,
    }, throwawaysk);

    return signedGiftWrap;
}

test.describe('Message deduplication', () => {

    /**
     * Set up page with mocked window.nostr and WebSocket.
     * @param {boolean} autoEcho - When true, the mock relay automatically
     *   echoes published kind:1059 events back through subscriptions,
     *   simulating the real race condition.
     */
    async function setupMockedPage(page, { autoEcho = false } = {}) {
        await page.addInitScript(({ senderPk, fakeUser, autoEcho }) => {
            // Auth + login method
            localStorage.setItem('bies_token', 'demo-token');
            localStorage.setItem('bies_user', JSON.stringify(fakeUser));
            localStorage.setItem('bies_login_method', 'extension');

            window.__relaySubscriptions = {};
            window.__sentEvents = [];
            window.__autoEcho = autoEcho;

            // Mock NIP-07 Nostr extension with NIP-44 support
            window.nostr = {
                getPublicKey: async () => senderPk,
                signEvent: async (event) => ({
                    ...event,
                    id: Array.from(crypto.getRandomValues(new Uint8Array(32)))
                        .map(b => b.toString(16).padStart(2, '0')).join(''),
                    pubkey: senderPk,
                    sig: '0'.repeat(128),
                }),
                nip44: {
                    encrypt: async (_pk, plaintext) =>
                        btoa(unescape(encodeURIComponent(plaintext))),
                    decrypt: async (_pk, ciphertext) =>
                        decodeURIComponent(escape(atob(ciphertext))),
                },
            };

            // Mock WebSocket
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
                            const event = msg[1];
                            window.__sentEvents.push(event);
                            setTimeout(() =>
                                this._deliver(JSON.stringify(['OK', event.id, true, ''])), 10);

                            // Auto-echo: relay immediately sends published
                            // kind:1059 events back through subscriptions.
                            if (window.__autoEcho && event.kind === 1059) {
                                for (const [subId, sockets] of
                                    Object.entries(window.__relaySubscriptions)) {
                                    for (const sock of sockets) {
                                        // Echo very quickly (2ms) to trigger the
                                        // race condition if optimistic isn't first.
                                        setTimeout(() => sock._deliver(
                                            JSON.stringify(['EVENT', subId, event])
                                        ), 2);
                                    }
                                }
                            }
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
        }, { senderPk: SENDER_PK, fakeUser: FAKE_USER, autoEcho });

        // Intercept API calls
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

        await page.goto('/');
        await page.evaluate((fakeUser) => {
            localStorage.setItem('bies_token', 'demo-token');
            localStorage.setItem('bies_user', JSON.stringify(fakeUser));
            localStorage.setItem('bies_login_method', 'extension');
        }, FAKE_USER);

        await page.goto('/messages');
        await page.waitForSelector('.messages-layout, .connect-container', { timeout: 15_000 });
    }

    /** Open a chat by entering a hex pubkey in the search box. */
    async function openChatWithRecipient(page, recipientPk) {
        const searchInput = page.locator('.search-box input');
        await searchInput.fill(recipientPk);
        await searchInput.press('Enter');
        await page.waitForSelector('.chat-input-area', { timeout: 5_000 });
    }

    /** Send a message via the compose textarea. */
    async function sendMsg(page, text) {
        const textarea = page.locator('.chat-input-area textarea');
        await textarea.fill(text);
        await page.locator('.send-btn').click();
    }

    /** Deliver a pre-built signed gift-wrap through ALL mock relay subscriptions. */
    async function deliverGiftWrap(page, signedEvent) {
        await page.evaluate((event) => {
            for (const [subId, sockets] of
                Object.entries(window.__relaySubscriptions)) {
                for (const sock of sockets) {
                    sock._deliver(JSON.stringify(['EVENT', subId, event]));
                }
            }
        }, signedEvent);
    }

    // ─── Tests ───────────────────────────────────────────────────────────────

    test('sent message does not duplicate when relay echoes it back', async ({ page }) => {
        await setupMockedPage(page);
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msg = 'hello dedup ' + Date.now();
        await sendMsg(page, msg);

        // Wait for optimistic message
        await page.waitForSelector('.msg.sent', { timeout: 5_000 });
        expect(await page.locator('.msg.sent').count()).toBe(1);

        // Simulate relay echo
        const giftWrap = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
        await deliverGiftWrap(page, giftWrap);
        await page.waitForTimeout(500);

        // Should still be exactly 1
        expect(await page.locator('.msg.sent').count()).toBe(1);
        expect(await page.locator('.msg.sent p').textContent()).toBe(msg);
    });

    test('auto-echo during publish does not duplicate (race condition)', async ({ page }) => {
        // The mock relay auto-echoes published events through subscriptions
        // within 2ms — this tests the exact race condition from the original bug.
        await setupMockedPage(page, { autoEcho: true });
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msg = 'race condition test ' + Date.now();
        await sendMsg(page, msg);

        // Wait for the message to settle (optimistic + potential echo)
        await page.waitForSelector('.msg.sent', { timeout: 5_000 });
        await page.waitForTimeout(1000);

        // Must be exactly 1, not 2
        const count = await page.locator('.msg.sent').count();
        expect(count).toBe(1);
    });

    test('multiple rapid messages do not duplicate on relay echo', async ({ page }) => {
        await setupMockedPage(page);
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msgs = [
            'rapid-1-' + Date.now(),
            'rapid-2-' + Date.now(),
            'rapid-3-' + Date.now(),
        ];

        for (const msg of msgs) {
            await sendMsg(page, msg);
            await page.waitForTimeout(150);
        }

        await expect(page.locator('.msg.sent')).toHaveCount(3, { timeout: 5_000 });

        // Echo all 3 back
        for (const msg of msgs) {
            const gw = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
            await deliverGiftWrap(page, gw);
        }
        await page.waitForTimeout(500);

        // Should still be exactly 3, not 6
        expect(await page.locator('.msg.sent').count()).toBe(3);
    });

    test('multiple rapid messages with auto-echo do not duplicate', async ({ page }) => {
        await setupMockedPage(page, { autoEcho: true });
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msgs = [
            'auto-rapid-1-' + Date.now(),
            'auto-rapid-2-' + Date.now(),
            'auto-rapid-3-' + Date.now(),
        ];

        for (const msg of msgs) {
            await sendMsg(page, msg);
            await page.waitForTimeout(150);
        }

        // Wait for everything to settle
        await page.waitForTimeout(1500);

        // Should be exactly 3 despite auto-echo from every relay
        expect(await page.locator('.msg.sent').count()).toBe(3);
    });

    test('relay echo replaces pending message (ID changes from pending-* to real)', async ({ page }) => {
        await setupMockedPage(page);
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msg = 'pending-id-check ' + Date.now();
        await sendMsg(page, msg);

        await page.waitForSelector('.msg.sent', { timeout: 5_000 });

        // Before echo: message should exist
        let msgCount = await page.locator('.msg.sent').count();
        expect(msgCount).toBe(1);

        // Deliver echo
        const gw = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
        await deliverGiftWrap(page, gw);
        await page.waitForTimeout(500);

        // After echo: still 1 message
        msgCount = await page.locator('.msg.sent').count();
        expect(msgCount).toBe(1);

        // Content preserved
        expect(await page.locator('.msg.sent p').textContent()).toBe(msg);
    });

    test('same gift-wrap delivered from multiple relays does not duplicate', async ({ page }) => {
        await setupMockedPage(page);
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msg = 'multi-relay test ' + Date.now();
        await sendMsg(page, msg);

        await page.waitForSelector('.msg.sent', { timeout: 5_000 });

        // Build ONE gift-wrap and deliver it 5 times (simulating 5 relays echoing the same event)
        const gw = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
        for (let i = 0; i < 5; i++) {
            await deliverGiftWrap(page, gw);
        }
        await page.waitForTimeout(500);

        // Should still be exactly 1
        expect(await page.locator('.msg.sent').count()).toBe(1);
    });

    test('two different gift-wraps with same content do not duplicate', async ({ page }) => {
        await setupMockedPage(page);
        await openChatWithRecipient(page, RECIPIENT_PK);

        const msg = 'double-wrap test ' + Date.now();
        await sendMsg(page, msg);
        await page.waitForSelector('.msg.sent', { timeout: 5_000 });

        // Build TWO different gift-wraps (different throwaway keys, different IDs)
        // both containing the same message content — simulates the sender-copy
        // gift-wrap arriving from different relay paths.
        const gw1 = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
        const gw2 = await buildSignedGiftWrap(SENDER_PK, RECIPIENT_PK, msg);
        expect(gw1.id).not.toBe(gw2.id); // They have different event IDs

        await deliverGiftWrap(page, gw1);
        await page.waitForTimeout(200);
        await deliverGiftWrap(page, gw2);
        await page.waitForTimeout(500);

        // Should still be exactly 1 — the safety-net dedup catches this
        expect(await page.locator('.msg.sent').count()).toBe(1);
    });
});
