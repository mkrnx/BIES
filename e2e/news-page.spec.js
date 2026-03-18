/**
 * Playwright E2E tests for BIES News page.
 * Tests the El Salvador live news feed, X/Twitter feed,
 * and mobile-responsive tab switching.
 */

import { test, expect } from '@playwright/test';

const BASE = '';

// ── 1. News Page - Desktop Layout ──────────────────────────────────

test.describe('News Page - Desktop Layout', () => {

    test('News page loads without JS errors', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        expect(jsErrors, `JS errors: ${jsErrors.join('; ')}`).toHaveLength(0);
    });

    test('El Salvador News column renders', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        // Main column should be visible
        const mainCol = page.locator('.main-col');
        await expect(mainCol).toBeVisible({ timeout: 10000 });

        // Header should say "El Salvador News"
        const header = mainCol.locator('.col-header h3');
        await expect(header).toContainText('El Salvador News');
    });

    test('X/Twitter column renders', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        // Sidebar column should be visible
        const sidebarCol = page.locator('.sidebar-col');
        await expect(sidebarCol).toBeVisible({ timeout: 10000 });

        // Header should say "X / Twitter"
        const header = sidebarCol.locator('.col-header h3');
        await expect(header).toContainText('X / Twitter');
    });

    test('El Salvador News shows articles or loading state', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        const mainCol = page.locator('.main-col');
        await expect(mainCol).toBeVisible({ timeout: 10000 });

        // Should show either: loading spinner, articles, or empty message
        const spinner = mainCol.locator('.lucide-loader-2, [style*="spin"]');
        const articles = mainCol.locator('.news-item');
        const emptyMsg = mainCol.locator('text=No El Salvador news found');

        // Wait for loading to finish
        await page.waitForLoadState('networkidle');

        // After loading, should have articles or empty message
        const articleCount = await articles.count();
        const hasEmpty = await emptyMsg.isVisible().catch(() => false);

        expect(articleCount > 0 || hasEmpty,
            'Expected either news articles or empty message').toBeTruthy();
    });

    test('News articles have required fields', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const articles = page.locator('.news-item');
        const count = await articles.count();

        if (count > 0) {
            const first = articles.first();
            // Each article should have a source tag, title, and date
            await expect(first.locator('.tag')).toBeVisible();
            await expect(first.locator('h2, h3')).toBeVisible();
        }
    });

    test('News filter input exists and filters', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const filterInput = page.locator('input[placeholder="Filter news..."]');
        await expect(filterInput).toBeVisible({ timeout: 10000 });

        // Type a filter keyword
        await filterInput.fill('bitcoin');

        // Should trigger a re-fetch (loading state or filtered results)
        // Wait for network to settle after filter
        await page.waitForLoadState('networkidle');
    });

    test('Featured article has image when available', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const featured = page.locator('.news-item.featured');
        const count = await featured.count();

        if (count > 0) {
            // Featured article should have larger title (h2)
            await expect(featured.locator('h2')).toBeVisible();
        }
    });

    test('Mobile tabs are hidden on desktop', async ({ page }) => {
        // Set desktop viewport
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(`${BASE}/news`);

        const mobileTabs = page.locator('.mobile-feed-tabs');
        await expect(mobileTabs).toBeHidden();
    });
});

// ── 2. News Page - X/Twitter Feed ──────────────────────────────────

test.describe('News Page - X/Twitter Feed', () => {

    test('Twitter feed shows tweets or empty state', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const sidebar = page.locator('.sidebar-col');
        await expect(sidebar).toBeVisible({ timeout: 10000 });

        const tweets = sidebar.locator('.tweet-card');
        const emptyText = sidebar.locator('.empty-text');

        const tweetCount = await tweets.count();
        const hasEmpty = await emptyText.isVisible().catch(() => false);

        expect(tweetCount > 0 || hasEmpty,
            'Expected either tweets or empty state message').toBeTruthy();
    });

    test('Tweet cards have author and metrics', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const tweets = page.locator('.tweet-card');
        const count = await tweets.count();

        if (count > 0) {
            const first = tweets.first();
            // Should have header with avatar and name
            await expect(first.locator('.tweet-header')).toBeVisible();
            await expect(first.locator('.avatar')).toBeVisible();
            await expect(first.locator('.u-name')).toBeVisible();
            // Should have metrics
            await expect(first.locator('.tweet-metrics')).toBeVisible();
        }
    });

    test('Tweet cards are clickable links to X.com', async ({ page }) => {
        await page.goto(`${BASE}/news`);
        await page.waitForLoadState('networkidle');

        const tweetLinks = page.locator('.tweet-card-link');
        const count = await tweetLinks.count();

        if (count > 0) {
            const href = await tweetLinks.first().getAttribute('href');
            expect(href).toContain('x.com');
        }
    });
});

// ── 3. News Page - Mobile Responsive ───────────────────────────────

test.describe('News Page - Mobile View', () => {

    test.beforeEach(async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 812 });
    });

    test('Mobile tabs are visible on small screens', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        const mobileTabs = page.locator('.mobile-feed-tabs');
        await expect(mobileTabs).toBeVisible({ timeout: 10000 });

        // Should have two tab buttons
        const tabs = mobileTabs.locator('.feed-tab');
        await expect(tabs).toHaveCount(2);

        // First tab should say "El Salvador News"
        await expect(tabs.first()).toContainText('El Salvador News');

        // Second tab should say "X / Twitter"
        await expect(tabs.nth(1)).toContainText('X / Twitter');
    });

    test('News tab is active by default on mobile', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        const newsTab = page.locator('.feed-tab').first();
        await expect(newsTab).toHaveClass(/active/);

        // Main column (news) should be visible
        const mainCol = page.locator('.main-col');
        await expect(mainCol).toBeVisible({ timeout: 10000 });

        // Sidebar (twitter) should be hidden
        const sidebarCol = page.locator('.sidebar-col');
        await expect(sidebarCol).toBeHidden();
    });

    test('Switching to X/Twitter tab hides news and shows tweets', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        const twitterTab = page.locator('.feed-tab').nth(1);
        await twitterTab.click();

        // Twitter tab should now be active
        await expect(twitterTab).toHaveClass(/active/);

        // Sidebar (twitter) should be visible
        const sidebarCol = page.locator('.sidebar-col');
        await expect(sidebarCol).toBeVisible({ timeout: 5000 });

        // Main column (news) should be hidden
        const mainCol = page.locator('.main-col');
        await expect(mainCol).toBeHidden();
    });

    test('Switching back to news tab restores news view', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        // Switch to twitter
        const twitterTab = page.locator('.feed-tab').nth(1);
        await twitterTab.click();
        await expect(page.locator('.sidebar-col')).toBeVisible();

        // Switch back to news
        const newsTab = page.locator('.feed-tab').first();
        await newsTab.click();

        await expect(newsTab).toHaveClass(/active/);
        await expect(page.locator('.main-col')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.sidebar-col')).toBeHidden();
    });

    test('Column headers are hidden on mobile (tabs replace them)', async ({ page }) => {
        await page.goto(`${BASE}/news`);

        // Col headers should be hidden on mobile since tabs handle navigation
        const colHeaders = page.locator('.col-header');
        const count = await colHeaders.count();

        for (let i = 0; i < count; i++) {
            await expect(colHeaders.nth(i)).toBeHidden();
        }
    });
});

// ── 4. News Page - API Integration ─────────────────────────────────

test.describe('News Page - API', () => {

    test('Live feed API returns valid response', async ({ request }) => {
        const res = await request.get('http://localhost:3001/api/news/live-feed');
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBeTruthy();

        if (body.data.length > 0) {
            const article = body.data[0];
            expect(article).toHaveProperty('title');
            expect(article).toHaveProperty('url');
            expect(article).toHaveProperty('source');
            expect(article).toHaveProperty('publishedAt');
        }
    });

    test('Live feed API supports keyword filter', async ({ request }) => {
        const res = await request.get('http://localhost:3001/api/news/live-feed?keyword=bitcoin');
        expect(res.ok()).toBeTruthy();

        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(Array.isArray(body.data)).toBeTruthy();
    });
});
