import { test, expect, devices } from '@playwright/test';

const iPhone = devices['iPhone 13'];
test.use({ ...iPhone });

async function signupAndGoToFeed(page) {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');

    // Step 0: generate keys
    await page.getByRole('button', { name: /Generate My Keys/i }).click();

    // Step 1: continue past backup
    const cont = page.getByRole('button', { name: /^Continue$/i });
    await cont.waitFor({ state: 'visible', timeout: 10000 });
    await cont.click();

    // Step 2: profile
    const nameInput = page.locator('input[placeholder*="Satoshi"]');
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill(`e2e_${Date.now().toString(36)}`);
    await page.getByRole('button', { name: /Enter Dashboard/i }).click();

    await page.waitForURL(url => !url.pathname.includes('/signup'), { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Navigate to feed
    await page.goto('/feed');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click Public tab
    const publicTab = page.locator('button, [role="tab"]').filter({ hasText: /Public/i }).first();
    if (await publicTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await publicTab.click();
    }

    // Wait for content images (not avatars) in the feed
    await page.waitForSelector('.primal-image-grid img', { timeout: 30000 });
    await page.waitForTimeout(1000);
}

test.describe('Lightbox mobile – exit', () => {

    test('close button (✕) exits lightbox on mobile tap', async ({ page }) => {
        await signupAndGoToFeed(page);

        const img = page.locator('.primal-image-grid img').first();
        await img.scrollIntoViewIfNeeded();
        await img.tap();

        // Verify lightbox opened
        const lbImg = page.getByTestId('lightbox-image');
        await expect(lbImg).toBeVisible({ timeout: 5000 });
        await page.screenshot({ path: 'e2e/screenshots/lb-01-open.png' });

        // Tap close button
        await page.getByTestId('lightbox-close').tap();

        // Lightbox should be gone
        await expect(lbImg).not.toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: 'e2e/screenshots/lb-02-closed-btn.png' });
    });

    test('tapping dark overlay closes lightbox on mobile', async ({ page }) => {
        await signupAndGoToFeed(page);

        const img = page.locator('.primal-image-grid img').first();
        await img.scrollIntoViewIfNeeded();
        await img.tap();

        const lbImg = page.getByTestId('lightbox-image');
        await expect(lbImg).toBeVisible({ timeout: 5000 });

        // Tap top-left of overlay (away from image and close button)
        await page.getByTestId('lightbox-overlay').tap({ position: { x: 5, y: 5 } });
        await expect(lbImg).not.toBeVisible({ timeout: 3000 });
        await page.screenshot({ path: 'e2e/screenshots/lb-03-closed-overlay.png' });
    });
});

test.describe('Lightbox desktop – scroll-wheel zoom', () => {

    test('scroll-wheel zooms in and out on lightbox image', async ({ page }) => {
        await signupAndGoToFeed(page);

        const img = page.locator('.primal-image-grid img').first();
        await img.scrollIntoViewIfNeeded();
        await img.click();

        const lbImg = page.getByTestId('lightbox-image');
        await expect(lbImg).toBeVisible({ timeout: 5000 });

        // Initial transform should be identity (scale 1)
        const initial = await lbImg.evaluate(el => el.style.transform);
        await page.screenshot({ path: 'e2e/screenshots/lb-04a-before-zoom.png' });

        // Zoom in heavily via multiple scroll wheel events
        await lbImg.hover();
        for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, -100);
            await page.waitForTimeout(50);
        }
        await page.waitForTimeout(300);

        const zoomedIn = await lbImg.evaluate(el => el.style.transform);
        console.log('[debug] zoomed transform:', zoomedIn);
        expect(zoomedIn).toContain('scale(');
        expect(zoomedIn).not.toEqual(initial);

        // Extract scale value and verify it's > 1
        const scaleMatch = zoomedIn.match(/scale\(([\d.]+)\)/);
        expect(scaleMatch).not.toBeNull();
        const scale = parseFloat(scaleMatch[1]);
        expect(scale).toBeGreaterThan(1.5);

        await page.screenshot({ path: 'e2e/screenshots/lb-04b-zoomed-in.png' });

        // Zoom back out
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(300);
        const zoomedOut = await lbImg.evaluate(el => el.style.transform);
        const outScaleMatch = zoomedOut.match(/scale\(([\d.]+)\)/);
        const outScale = parseFloat(outScaleMatch[1]);
        expect(outScale).toBeLessThan(scale);
    });
});
