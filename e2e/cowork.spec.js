/**
 * Playwright E2E test for the BIES Cowork page.
 * Verifies the page renders (map thumbnail + Leaflet), the thumbnail expands
 * to the fullscreen map modal, and a user can check in at a curated venue
 * and check out again over the private relay.
 *
 * Requires:
 *   - Docker dev relay on port 7777
 *   - Backend server on port 3001
 *   - Vite dev server on port 5173
 */

import { test, expect } from '@playwright/test';

const API = 'http://localhost:3001/api';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a Nostr keypair using nostr-tools (server-side in Node).
 * Returns { sk (hex), pk (hex), nsec (bech32) }.
 */
async function generateKeypair() {
    const { generateSecretKey, getPublicKey } = await import('nostr-tools/pure');
    const { nip19 } = await import('nostr-tools');
    const sk = generateSecretKey();
    const pk = getPublicKey(sk);
    const nsec = nip19.nsecEncode(sk);
    const skHex = Buffer.from(sk).toString('hex');
    return { sk, skHex, pk, nsec };
}

/**
 * Sign a Nostr event with a secret key.
 */
async function signEvent(event, sk) {
    const { finalizeEvent } = await import('nostr-tools/pure');
    return finalizeEvent(event, sk);
}

/**
 * Do the full nostr challenge-response login via API.
 * Returns { token, user }.
 */
async function nostrLogin(request, sk, pk) {
    // Step 1: Get challenge (GET with query param)
    const challengeRes = await request.get(`${API}/auth/nostr-challenge?pubkey=${pk}`);
    expect(challengeRes.ok(), `Challenge request failed: ${challengeRes.status()}`).toBeTruthy();
    const { challenge } = await challengeRes.json();

    // Step 2: Sign the challenge
    const signed = await signEvent({
        kind: 27235,
        pubkey: pk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: challenge,
    }, sk);

    // Step 3: Login
    const loginRes = await request.post(`${API}/auth/nostr-login`, {
        data: { pubkey: pk, signedEvent: signed },
    });
    expect(loginRes.ok(), `Nostr login failed: ${loginRes.status()}`).toBeTruthy();
    const body = await loginRes.json();
    return { token: body.token, user: body.user };
}

/**
 * Inject auth state into the browser (token, user, nostr signer).
 * The nsecHex is a hex-encoded secret key (not bech32).
 */
async function injectAuth(page, token, user, nsecHex) {
    if (nsecHex) {
        await page.addInitScript(({ nsecHex }) => {
            window.__TEST_NSEC_HEX = nsecHex;
        }, { nsecHex });
    }
    await page.goto('/');
    await page.evaluate(({ token, user }) => {
        localStorage.setItem('bies_token', token);
        localStorage.setItem('bies_user', JSON.stringify(user));
        localStorage.setItem('bies_login_method', 'nsec');
    }, { token, user });
}

/**
 * Re-set the nsec on the in-page signer (it may have been cleared by
 * page navigation). Same pattern as private-relay-feed.spec.js.
 */
async function setSignerKey(page, skHex) {
    await page.evaluate(async ({ skHex }) => {
        const skBytes = new Uint8Array(skHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
        const signerModule = await import('/src/services/nostrSigner.js');
        signerModule.nostrSigner.setNsec(skBytes);
    }, { skHex });
}

// ── Tests ────────────────────────────────────────────────────────────

test.describe('Cowork - map, check-in and check-out', () => {
    let sk, skHex, pk, token, user;

    test.beforeAll(async ({ request }) => {
        const keys = await generateKeypair();
        sk = keys.sk;
        skHex = keys.skHex;
        pk = keys.pk;

        // Login via nostr challenge-response (auto-creates user + whitelists pubkey)
        const auth = await nostrLogin(request, sk, pk);
        token = auth.token;
        user = auth.user;
    });

    test('renders page with map thumbnail and mounted leaflet', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await injectAuth(page, token, user, skHex);
        await page.goto('/cowork');

        // Page shell
        await expect(page.locator('[data-testid="cowork-page"]')).toBeVisible({ timeout: 15000 });

        // Thumbnail expand button overlays the map thumbnail
        await expect(page.locator('[data-testid="cowork-map-thumbnail"]')).toBeVisible({ timeout: 10000 });

        // Leaflet mounted: the tile pane exists in the DOM. Leaflet panes are
        // zero-size positioned containers, so assert attachment on the pane
        // and visibility on an actual tile inside it.
        const tilePane = page.locator('.leaflet-tile-pane').first();
        await tilePane.waitFor({ state: 'attached', timeout: 15000 });
        await expect(page.locator('.leaflet-tile-pane .leaflet-tile').first())
            .toBeVisible({ timeout: 20000 });

        // Check-in CTA (fresh throwaway key => never checked in)
        await expect(page.locator('[data-testid="cowork-checkin-btn"]')).toBeVisible({ timeout: 10000 });

        const relevantErrors = jsErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection')
        );
        expect(relevantErrors, `JS errors: ${relevantErrors.join('; ')}`).toHaveLength(0);
    });

    test('thumbnail expands to fullscreen map modal and closes again', async ({ page }) => {
        await injectAuth(page, token, user, skHex);
        await page.goto('/cowork');

        const thumbnail = page.locator('[data-testid="cowork-map-thumbnail"]');
        await expect(thumbnail).toBeVisible({ timeout: 15000 });
        await thumbnail.click();

        const modal = page.locator('[data-testid="cowork-map-modal"]');
        await expect(modal).toBeVisible({ timeout: 10000 });

        // The fullscreen map mounts its own Leaflet instance
        await modal.locator('.leaflet-tile-pane').first().waitFor({ state: 'attached', timeout: 15000 });

        await page.locator('[data-testid="cowork-map-modal-close"]').click();
        await expect(modal).toBeHidden({ timeout: 10000 });
    });

    test('can check in at a curated venue and check out again', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        // Capture console output to debug relay whitelist/publish issues,
        // same as private-relay-feed.spec.js.
        const consoleLogs = [];
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('[Cowork]') || msg.text().includes('[Nostr]')) {
                consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
            }
        });

        // Accept the window.confirm() shown on check-out.
        page.on('dialog', dialog => dialog.accept());

        await injectAuth(page, token, user, skHex);
        await page.goto('/cowork');

        await expect(page.locator('[data-testid="cowork-page"]')).toBeVisible({ timeout: 15000 });

        // Set the nsec on the signer (it may have been cleared by page navigation)
        await setSignerKey(page, skHex);

        // Open the check-in modal
        const checkinBtn = page.locator('[data-testid="cowork-checkin-btn"]');
        await expect(checkinBtn).toBeVisible({ timeout: 15000 });
        await checkinBtn.click();

        // Curated venue tab is the default: pick a venue from the select
        const venueSelect = page.locator('[data-testid="cowork-venue-select"]');
        await expect(venueSelect).toBeVisible({ timeout: 10000 });
        await venueSelect.selectOption('zonte-point-break');

        // Add a note
        const uniqueNote = `E2E cowork check-in ${Date.now()}`;
        await page.locator('[data-testid="cowork-note-input"]').fill(uniqueNote);

        // Submit (signs + publishes to the private relay)
        const submitBtn = page.locator('[data-testid="cowork-submit"]');
        await expect(submitBtn).toBeEnabled();
        await submitBtn.click();

        // On success the modal closes; on relay rejection an error stays visible.
        // Generous timeout for the relay round-trip.
        await expect(submitBtn, `Check-in publish did not complete. Console: ${consoleLogs.join('\n')}`)
            .toBeHidden({ timeout: 30000 });

        // Our card appears with the You badge (optimistic + relay echo)
        const myCard = page.locator(`[data-testid="cowork-card-${pk}"]`);
        await expect(myCard, `Card never appeared. Console: ${consoleLogs.join('\n')}`)
            .toBeVisible({ timeout: 30000 });
        await expect(myCard.locator('.cw-you-badge')).toBeVisible({ timeout: 10000 });

        // Check out (dialog handler above accepts the confirm)
        const checkoutBtn = myCard.locator('[data-testid="cowork-checkout-btn"]');
        await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
        await checkoutBtn.click();

        // The card disappears once the check-out event is published
        await expect(myCard, `Card never disappeared after check-out. Console: ${consoleLogs.join('\n')}`)
            .toBeHidden({ timeout: 30000 });

        // And the check-in CTA is back
        await expect(page.locator('[data-testid="cowork-checkin-btn"]')).toBeVisible({ timeout: 15000 });

        const relevantErrors = jsErrors.filter(e =>
            !e.includes('ResizeObserver') && !e.includes('Non-Error promise rejection')
        );
        if (relevantErrors.length > 0) {
            console.log('Console logs:', consoleLogs.join('\n'));
        }
        expect(relevantErrors, `JS errors: ${relevantErrors.join('; ')}`).toHaveLength(0);
    });
});
