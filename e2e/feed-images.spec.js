import { test, expect } from '@playwright/test';

async function loginAndGoToFeed(page) {
    // Navigate to login page and click demo login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    // Scroll to and click demo login button
    const demoBtn = page.getByRole('button', { name: /Demo Login/i });
    await demoBtn.scrollIntoViewIfNeeded();
    await demoBtn.click();

    // Demo login does window.location.href = '/biestest/feed'
    // which won't exist in dev. Wait for nav then redirect.
    await page.waitForLoadState('load');

    // Now we should have the token in localStorage from the demo login handler
    // Navigate to the correct feed URL
    await page.goto('/feed');
    await page.waitForLoadState('domcontentloaded');

    const publicTab = page.getByTestId('tab-explore');
    await publicTab.waitFor({ timeout: 15000 });
    await publicTab.click();
    await page.waitForSelector('[data-testid="feed-note"]', { timeout: 30000 });
}

test.describe('Feed image display', () => {
    test('images are not cropped — rendered at original aspect ratio within container', async ({ page }) => {
        await loginAndGoToFeed(page);

        const images = page.locator('.note-content img');
        const count = await images.count();

        if (count === 0) {
            test.skip('No images found in feed');
            return;
        }

        for (let i = 0; i < Math.min(count, 5); i++) {
            const img = images.nth(i);
            await img.scrollIntoViewIfNeeded();
            await img.evaluate(el => new Promise((resolve, reject) => {
                if (el.complete && el.naturalWidth > 0) return resolve();
                el.onload = resolve;
                el.onerror = reject;
            }));

            const box = await img.boundingBox();
            const naturalSize = await img.evaluate(el => ({
                naturalWidth: el.naturalWidth,
                naturalHeight: el.naturalHeight,
            }));

            if (!box || !naturalSize.naturalWidth) continue;

            const renderedRatio = box.width / box.height;
            const naturalRatio = naturalSize.naturalWidth / naturalSize.naturalHeight;
            const ratioDiff = Math.abs(renderedRatio - naturalRatio) / naturalRatio;

            expect(ratioDiff, `Image ${i} aspect ratio preserved (natural: ${naturalRatio.toFixed(3)}, rendered: ${renderedRatio.toFixed(3)})`).toBeLessThan(0.02);

            const containerBox = await img.evaluate(el => {
                const parent = el.closest('.note-content');
                if (!parent) return null;
                const r = parent.getBoundingClientRect();
                return { width: r.width };
            });
            if (containerBox) {
                expect(box.width).toBeLessThanOrEqual(containerBox.width + 1);
            }
        }
    });

    test('clicking an image opens fullscreen lightbox', async ({ page }) => {
        await loginAndGoToFeed(page);

        const firstImage = page.locator('.note-content img').first();
        if (!(await firstImage.isVisible({ timeout: 10000 }).catch(() => false))) {
            test.skip('No images in feed');
            return;
        }

        await firstImage.click();

        const lightbox = page.locator('.lightbox-overlay');
        await expect(lightbox).toBeVisible();
        await expect(page.locator('.lightbox-img')).toBeVisible();

        await page.locator('.lightbox-close').click();
        await expect(lightbox).not.toBeVisible();
    });
});
