/**
 * Playwright E2E test for Messages page layout constraints.
 *
 * Verifies that the messages page fills exactly the viewport height below
 * the navbar with NO page-level scrolling. Only two things scroll:
 *   1. The conversation list in the left sidebar (independently)
 *   2. The chat messages in the right panel (independently)
 *
 * The message compose box and all headers must stay fixed in place.
 *
 * Strategy: Mock window.nostr (NIP-07) and WebSocket, then deliver many
 * gift-wrapped DMs to generate enough conversations and messages to
 * overflow both scroll containers.
 */

import { test, expect } from '@playwright/test';

const TEST_USER_PK = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

const FAKE_USER = {
    id: 'test-layout-user',
    email: 'layout@test.local',
    role: 'BUILDER',
    nostrPubkey: TEST_USER_PK,
    profile: { name: 'Layout Tester' },
};

/** Generate a deterministic 64-char hex pubkey from an index. */
function fakePubkey(index) {
    const hex = (index + 10).toString(16).padStart(2, '0');
    return hex.repeat(32);
}

/**
 * Build a signed gift-wrap representing an incoming message FROM fromPk TO toPk.
 */
async function buildIncomingGiftWrap(fromPk, toPk, content, createdAt) {
    const { finalizeEvent, generateSecretKey } = await import('nostr-tools');
    const encode = (str) => Buffer.from(str, 'utf8').toString('base64');
    const now = createdAt || Math.floor(Date.now() / 1000);

    const rumor = {
        kind: 14,
        content,
        created_at: now,
        tags: [['p', toPk]],
        pubkey: fromPk,
    };

    const seal = {
        kind: 13,
        content: encode(JSON.stringify(rumor)),
        pubkey: fromPk,
        created_at: now,
        id: Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
        ).join(''),
        sig: '0'.repeat(128),
    };

    const giftWrapUnsigned = {
        kind: 1059,
        content: encode(JSON.stringify(seal)),
        tags: [['p', toPk]],
        created_at: now,
    };

    return finalizeEvent(giftWrapUnsigned, generateSecretKey());
}

test.describe('Messages layout', () => {

    /**
     * Set up page with mocked auth, window.nostr, and WebSocket.
     */
    async function setupMockedPage(page) {
        await page.addInitScript(({ testUserPk, fakeUser }) => {
            localStorage.setItem('bies_token', 'demo-token');
            localStorage.setItem('bies_user', JSON.stringify(fakeUser));

            window.__relaySubscriptions = {};
            window.__sentEvents = [];

            // Mock NIP-07
            window.nostr = {
                getPublicKey: async () => testUserPk,
                signEvent: async (event) => ({
                    ...event,
                    id: Array.from(crypto.getRandomValues(new Uint8Array(32)))
                        .map(b => b.toString(16).padStart(2, '0')).join(''),
                    pubkey: testUserPk,
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
        }, { testUserPk: TEST_USER_PK, fakeUser: FAKE_USER });

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
        }, FAKE_USER);

        await page.goto('/messages');
        await page.waitForSelector('.messages-layout', { timeout: 15_000 });
    }

    /**
     * Deliver an array of gift-wrap events through the mock relay in one batch.
     */
    async function deliverBatch(page, events) {
        await page.evaluate((evts) => {
            const subIds = Object.keys(window.__relaySubscriptions);
            for (const event of evts) {
                for (const subId of subIds) {
                    const sockets = window.__relaySubscriptions[subId];
                    if (sockets && sockets.length > 0) {
                        sockets[0]._deliver(JSON.stringify(['EVENT', subId, event]));
                        break;
                    }
                }
            }
        }, events);
    }

    test('no page-level scroll with many conversations; sidebar scrolls independently', async ({ page }) => {
        await setupMockedPage(page);

        // Generate 30 conversations from different senders
        const now = Math.floor(Date.now() / 1000);
        const convos = await Promise.all(
            Array.from({ length: 30 }, (_, i) =>
                buildIncomingGiftWrap(
                    fakePubkey(i),
                    TEST_USER_PK,
                    `Conversation starter ${i + 1}`,
                    now - (30 - i) * 60,
                )
            )
        );

        await deliverBatch(page, convos);
        // Allow React to process all state updates
        await page.waitForTimeout(3000);

        // 1. Conversations should be rendered
        const convoCount = await page.locator('.chat-item').count();
        expect(convoCount).toBeGreaterThanOrEqual(20);

        // 2. No page-level scrollbar
        const noPageScroll = await page.evaluate(() => {
            return document.documentElement.scrollHeight <= window.innerHeight;
        });
        expect(noPageScroll).toBe(true);

        // 3. Sidebar conversation-list IS scrollable (content overflows)
        const sidebarScrollable = await page.evaluate(() => {
            const list = document.querySelector('.conversation-list');
            if (!list) return false;
            return list.scrollHeight > list.clientHeight;
        });
        expect(sidebarScrollable).toBe(true);

        // 4. Sidebar header stays visible at top
        const headerVisible = await page.evaluate(() => {
            const header = document.querySelector('.sidebar-header');
            if (!header) return false;
            const rect = header.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        expect(headerVisible).toBe(true);

        // 5. Sidebar can scroll: scroll to bottom and verify it moved
        const scrolled = await page.evaluate(() => {
            const list = document.querySelector('.conversation-list');
            if (!list) return false;
            list.scrollTop = list.scrollHeight;
            return list.scrollTop > 0;
        });
        expect(scrolled).toBe(true);
    });

    test('chat messages scroll independently; input stays pinned at bottom', async ({ page }) => {
        await setupMockedPage(page);

        // Create one conversation first
        const senderPk = fakePubkey(0);
        const startMsg = await buildIncomingGiftWrap(
            senderPk, TEST_USER_PK, 'Initial message', Math.floor(Date.now() / 1000) - 3600,
        );
        await deliverBatch(page, [startMsg]);
        await page.waitForTimeout(1000);

        // Open the conversation
        await page.click('.chat-item');
        await page.waitForSelector('.active-chat-content', { timeout: 5_000 });

        // Deliver 50 messages into this conversation
        const now = Math.floor(Date.now() / 1000);
        const messages = await Promise.all(
            Array.from({ length: 50 }, (_, i) =>
                buildIncomingGiftWrap(
                    senderPk,
                    TEST_USER_PK,
                    `Test message number ${i + 1} — ${Date.now()}`,
                    now - (50 - i) * 30,
                )
            )
        );
        await deliverBatch(page, messages);
        await page.waitForTimeout(3000);

        // 1. Messages should be rendered
        const msgCount = await page.locator('.msg').count();
        expect(msgCount).toBeGreaterThanOrEqual(40);

        // 2. Chat content area IS scrollable
        const chatScrollable = await page.evaluate(() => {
            const chat = document.querySelector('.active-chat-content');
            if (!chat) return false;
            return chat.scrollHeight > chat.clientHeight;
        });
        expect(chatScrollable).toBe(true);

        // 3. Message input area is visible and within viewport
        const inputInViewport = await page.evaluate(() => {
            const input = document.querySelector('.chat-input-area');
            if (!input) return false;
            const rect = input.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        expect(inputInViewport).toBe(true);

        // 4. Chat header is visible
        const chatHeaderVisible = await page.evaluate(() => {
            const header = document.querySelector('.chat-header');
            if (!header) return false;
            const rect = header.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });
        expect(chatHeaderVisible).toBe(true);

        // 5. No page-level scroll
        const noPageScroll = await page.evaluate(() => {
            return document.documentElement.scrollHeight <= window.innerHeight;
        });
        expect(noPageScroll).toBe(true);

        // 6. Chat can scroll: scroll to top and verify
        const chatScrolled = await page.evaluate(() => {
            const chat = document.querySelector('.active-chat-content');
            if (!chat) return false;
            chat.scrollTop = 0;
            return chat.scrollHeight > chat.clientHeight;
        });
        expect(chatScrolled).toBe(true);
    });

    test('both panels scroll with many conversations AND many messages simultaneously', async ({ page }) => {
        await setupMockedPage(page);

        const now = Math.floor(Date.now() / 1000);

        // Generate 25 conversations
        const convos = await Promise.all(
            Array.from({ length: 25 }, (_, i) =>
                buildIncomingGiftWrap(
                    fakePubkey(i),
                    TEST_USER_PK,
                    `Hello from user ${i + 1}`,
                    now - (25 - i) * 120,
                )
            )
        );
        await deliverBatch(page, convos);
        await page.waitForTimeout(2000);

        // Open the most recent conversation (first in list)
        await page.click('.chat-item:first-child');
        await page.waitForSelector('.active-chat-content', { timeout: 5_000 });

        // Deliver 40 more messages into this conversation
        const activePk = fakePubkey(24); // most recent
        const msgs = await Promise.all(
            Array.from({ length: 40 }, (_, i) =>
                buildIncomingGiftWrap(
                    activePk,
                    TEST_USER_PK,
                    `Follow-up message ${i + 1}`,
                    now + i * 10,
                )
            )
        );
        await deliverBatch(page, msgs);
        await page.waitForTimeout(3000);

        // Assert all layout constraints simultaneously
        const layoutState = await page.evaluate(() => {
            const list = document.querySelector('.conversation-list');
            const chat = document.querySelector('.active-chat-content');
            const input = document.querySelector('.chat-input-area');
            const sidebarHeader = document.querySelector('.sidebar-header');
            const chatHeader = document.querySelector('.chat-header');

            const inputRect = input?.getBoundingClientRect();
            const sidebarHeaderRect = sidebarHeader?.getBoundingClientRect();
            const chatHeaderRect = chatHeader?.getBoundingClientRect();

            return {
                pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
                sidebarScrollable: list ? list.scrollHeight > list.clientHeight : false,
                chatScrollable: chat ? chat.scrollHeight > chat.clientHeight : false,
                inputVisible: inputRect
                    ? inputRect.top >= 0 && inputRect.bottom <= window.innerHeight
                    : false,
                sidebarHeaderVisible: sidebarHeaderRect
                    ? sidebarHeaderRect.top >= 0 && sidebarHeaderRect.bottom <= window.innerHeight
                    : false,
                chatHeaderVisible: chatHeaderRect
                    ? chatHeaderRect.top >= 0 && chatHeaderRect.bottom <= window.innerHeight
                    : false,
            };
        });

        expect(layoutState.pageScrollable).toBe(false);
        expect(layoutState.sidebarScrollable).toBe(true);
        expect(layoutState.chatScrollable).toBe(true);
        expect(layoutState.inputVisible).toBe(true);
        expect(layoutState.sidebarHeaderVisible).toBe(true);
        expect(layoutState.chatHeaderVisible).toBe(true);
    });

    test('mobile: sidebar scrolls with many conversations, no page scroll', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 }); // iPhone-sized
        await setupMockedPage(page);

        const now = Math.floor(Date.now() / 1000);
        const convos = await Promise.all(
            Array.from({ length: 30 }, (_, i) =>
                buildIncomingGiftWrap(
                    fakePubkey(i),
                    TEST_USER_PK,
                    `Mobile convo ${i + 1}`,
                    now - (30 - i) * 60,
                )
            )
        );
        await deliverBatch(page, convos);
        await page.waitForTimeout(3000);


        const state = await page.evaluate(() => {
            const list = document.querySelector('.conversation-list');
            const mp = document.querySelector('.messages-page');
            const cs = getComputedStyle(mp);
            return {
                pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
                sidebarScrollable: list ? list.scrollHeight > list.clientHeight : false,
                position: cs.position,
                bottom: cs.bottom,
                overflow: cs.overflow,
                display: cs.display,
            };
        });

        expect(state.position).toBe('fixed');
        expect(state.overflow).toBe('hidden');
        expect(state.display).toBe('flex');
        expect(state.pageScrollable).toBe(false);
        expect(state.sidebarScrollable).toBe(true);
    });

    test('mobile: chat input pinned at bottom with many messages', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await setupMockedPage(page);

        // Create conversation
        const senderPk = fakePubkey(0);
        const startMsg = await buildIncomingGiftWrap(
            senderPk, TEST_USER_PK, 'Hi mobile', Math.floor(Date.now() / 1000) - 3600,
        );
        await deliverBatch(page, [startMsg]);
        await page.waitForTimeout(1000);

        // Open it (mobile view switches to chat)
        await page.click('.chat-item');
        await page.waitForSelector('.active-chat-content', { timeout: 5_000 });

        // Deliver many messages
        const now = Math.floor(Date.now() / 1000);
        const msgs = await Promise.all(
            Array.from({ length: 50 }, (_, i) =>
                buildIncomingGiftWrap(
                    senderPk, TEST_USER_PK,
                    `Mobile msg ${i + 1}`,
                    now - (50 - i) * 30,
                )
            )
        );
        await deliverBatch(page, msgs);
        await page.waitForTimeout(3000);


        const state = await page.evaluate(() => {
            const chat = document.querySelector('.active-chat-content');
            const input = document.querySelector('.chat-input-area');
            const header = document.querySelector('.chat-header');
            const inputRect = input?.getBoundingClientRect();
            const headerRect = header?.getBoundingClientRect();
            return {
                pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
                chatScrollable: chat ? chat.scrollHeight > chat.clientHeight : false,
                inputVisible: inputRect
                    ? inputRect.top >= 0 && inputRect.bottom <= window.innerHeight
                    : false,
                headerVisible: headerRect
                    ? headerRect.top >= 0 && headerRect.bottom <= window.innerHeight
                    : false,
            };
        });

        expect(state.pageScrollable).toBe(false);
        expect(state.chatScrollable).toBe(true);
        expect(state.inputVisible).toBe(true);
        expect(state.headerVisible).toBe(true);
    });
});
