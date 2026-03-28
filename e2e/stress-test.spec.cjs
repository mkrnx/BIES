/**
 * BIES Platform — Comprehensive Stress Test & Audit
 *
 * Tests every page, checks for console errors, broken images,
 * layout issues, dark mode consistency, responsive breakpoints,
 * navigation flows, and simulates concurrent usage.
 */

const { test, expect, chromium } = require('@playwright/test');

const BASE = 'http://localhost:5173';

// All public routes to audit
const PUBLIC_ROUTES = [
    { path: '/', name: 'Landing' },
    { path: '/feed', name: 'Feed' },
    { path: '/discover', name: 'Discover' },
    { path: '/events', name: 'Events' },
    { path: '/media', name: 'Media' },
    { path: '/login', name: 'Login' },
    { path: '/signup', name: 'Signup' },
];

// Viewports to test
const VIEWPORTS = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 14 Pro', width: 393, height: 852 },
    { name: 'iPad', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
];

// Collect all findings
const findings = [];

function addFinding(category, severity, page, description, details = '') {
    findings.push({ category, severity, page, description, details });
}

test.describe('BIES Platform Stress Test & Audit', () => {

    // ═══════════════════════════════════════════════════════════════════
    // 1. CONSOLE ERRORS — visit every route and capture JS errors
    // ═══════════════════════════════════════════════════════════════════
    test('1. Console errors on all public pages', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        for (const route of PUBLIC_ROUTES) {
            const errors = [];
            const warnings = [];

            page.on('console', msg => {
                if (msg.type() === 'error') errors.push(msg.text());
                if (msg.type() === 'warning') warnings.push(msg.text());
            });
            page.on('pageerror', err => errors.push(err.message));

            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);

            if (errors.length > 0) {
                addFinding('Console Error', 'HIGH', route.name,
                    `${errors.length} JS error(s)`,
                    errors.slice(0, 5).join('\n'));
            }
            if (warnings.length > 0) {
                addFinding('Console Warning', 'LOW', route.name,
                    `${warnings.length} console warning(s)`,
                    warnings.slice(0, 3).join('\n'));
            }

            page.removeAllListeners('console');
            page.removeAllListeners('pageerror');
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 2. BROKEN IMAGES — check every <img> tag on every page
    // ═══════════════════════════════════════════════════════════════════
    test('2. Broken images on all pages', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        for (const route of PUBLIC_ROUTES) {
            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);

            const brokenImages = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                const broken = [];
                imgs.forEach(img => {
                    if (img.src && !img.src.startsWith('data:') && (img.naturalWidth === 0 || img.complete === false)) {
                        broken.push(img.src);
                    }
                });
                return broken;
            });

            if (brokenImages.length > 0) {
                addFinding('Broken Image', 'MEDIUM', route.name,
                    `${brokenImages.length} broken image(s)`,
                    brokenImages.slice(0, 5).join('\n'));
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 3. HORIZONTAL OVERFLOW — check every page at every viewport
    // ═══════════════════════════════════════════════════════════════════
    test('3. Horizontal overflow on all viewports', async ({ browser }) => {
        for (const vp of VIEWPORTS) {
            const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
            const page = await context.newPage();

            for (const route of PUBLIC_ROUTES) {
                await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(1000);

                const overflow = await page.evaluate(() => {
                    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
                });

                if (overflow) {
                    // Find which elements overflow
                    const overflowers = await page.evaluate(() => {
                        const elems = [];
                        document.querySelectorAll('*').forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (rect.right > window.innerWidth + 5) {
                                elems.push(`${el.tagName}.${el.className?.split(' ')[0] || '(no-class)'} → right: ${Math.round(rect.right)}px (viewport: ${window.innerWidth}px)`);
                            }
                        });
                        return elems.slice(0, 5);
                    });

                    addFinding('Horizontal Overflow', 'HIGH', `${route.name} @ ${vp.name}`,
                        `Page scrolls horizontally`,
                        overflowers.join('\n'));
                }
            }

            await context.close();
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // 4. DARK MODE CONSISTENCY — check for hardcoded colors
    // ═══════════════════════════════════════════════════════════════════
    test('4. Dark mode audit on all pages', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            colorScheme: 'dark',
        });
        const page = await context.newPage();

        // Set dark theme
        await page.goto(`${BASE}/feed`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.evaluate(() => {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        });

        for (const route of PUBLIC_ROUTES) {
            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
            await page.waitForTimeout(1500);

            // Find elements with hardcoded white/light backgrounds
            const hardcodedBgs = await page.evaluate(() => {
                const issues = [];
                document.querySelectorAll('*').forEach(el => {
                    const style = window.getComputedStyle(el);
                    const bg = style.backgroundColor;
                    const color = style.color;
                    const rect = el.getBoundingClientRect();

                    // Skip invisible elements
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.top > window.innerHeight) return;

                    // Check for white or near-white backgrounds in dark mode
                    if (bg === 'rgb(255, 255, 255)' || bg === 'rgb(249, 250, 251)' || bg === 'rgb(248, 249, 250)') {
                        const tag = el.tagName.toLowerCase();
                        const cls = el.className?.toString().split(' ').slice(0, 2).join('.') || '';
                        // Skip tiny elements, inputs, and known exceptions
                        if (rect.width > 50 && rect.height > 30 && tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
                            issues.push(`${tag}.${cls} (${Math.round(rect.width)}x${Math.round(rect.height)}) bg: ${bg}`);
                        }
                    }

                    // Check for very dark text on dark background
                    if (bg && color) {
                        const bgMatch = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        const colorMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                        if (bgMatch && colorMatch) {
                            const bgLum = (parseInt(bgMatch[1]) + parseInt(bgMatch[2]) + parseInt(bgMatch[3])) / 3;
                            const textLum = (parseInt(colorMatch[1]) + parseInt(colorMatch[2]) + parseInt(colorMatch[3])) / 3;
                            // Both dark = unreadable text
                            if (bgLum < 60 && textLum < 60 && rect.width > 50 && rect.height > 15) {
                                const text = el.textContent?.trim().substring(0, 40);
                                if (text && text.length > 2) {
                                    const tag = el.tagName.toLowerCase();
                                    const cls = el.className?.toString().split(' ').slice(0, 2).join('.') || '';
                                    issues.push(`LOW CONTRAST: ${tag}.${cls} text="${text}" (text: ${color}, bg: ${bg})`);
                                }
                            }
                        }
                    }
                });
                return [...new Set(issues)].slice(0, 10);
            });

            if (hardcodedBgs.length > 0) {
                addFinding('Dark Mode', 'MEDIUM', route.name,
                    `${hardcodedBgs.length} element(s) with dark mode issues`,
                    hardcodedBgs.join('\n'));
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 5. NAVIGATION FLOW — test all nav links work correctly
    // ═══════════════════════════════════════════════════════════════════
    test('5. Navigation flow — desktop navbar', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/feed`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        // Check all navbar links
        const navLinks = await page.evaluate(() => {
            const links = [];
            document.querySelectorAll('nav a, .navbar a').forEach(a => {
                links.push({ href: a.getAttribute('href'), text: a.textContent?.trim() });
            });
            return links;
        });

        for (const link of navLinks) {
            if (!link.href || link.href === '#' || link.href.startsWith('http')) continue;
            const resp = await page.goto(`${BASE}${link.href}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(e => ({ status: () => 0, error: e.message }));
            const status = typeof resp?.status === 'function' ? resp.status() : 0;

            // Check if page rendered (not blank)
            const hasContent = await page.evaluate(() => {
                const root = document.getElementById('root');
                return root && root.innerHTML.length > 100;
            });

            if (!hasContent) {
                addFinding('Navigation', 'HIGH', `Nav → ${link.text}`,
                    `Clicking "${link.text}" leads to blank/empty page`,
                    `href: ${link.href}`);
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 6. MOBILE BOTTOM NAV — test all bottom nav items
    // ═══════════════════════════════════════════════════════════════════
    test('6. Mobile bottom nav flow', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/feed`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const bottomNavLinks = await page.evaluate(() => {
            const links = [];
            // Bottom nav is typically at the bottom of the page
            document.querySelectorAll('a').forEach(a => {
                const rect = a.getBoundingClientRect();
                if (rect.top > window.innerHeight - 100 && rect.height > 20) {
                    links.push({ href: a.getAttribute('href'), text: a.textContent?.trim() });
                }
            });
            return links;
        });

        for (const link of bottomNavLinks) {
            if (!link.href || link.href === '#') continue;
            await page.goto(`${BASE}${link.href}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(1000);

            const hasContent = await page.evaluate(() => {
                const root = document.getElementById('root');
                return root && root.innerHTML.length > 100;
            });

            if (!hasContent) {
                addFinding('Navigation', 'HIGH', `BottomNav → ${link.text}`,
                    `Tapping "${link.text}" leads to blank page`,
                    `href: ${link.href}`);
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 7. RESPONSIVE LAYOUT — check key elements at mobile breakpoint
    // ═══════════════════════════════════════════════════════════════════
    test('7. Responsive layout checks', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
        const page = await context.newPage();

        for (const route of PUBLIC_ROUTES) {
            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);

            // Check for text truncation / overflow
            const overflowingText = await page.evaluate(() => {
                const issues = [];
                document.querySelectorAll('h1, h2, h3, p, span, a, button').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > window.innerWidth + 2 && el.textContent?.trim().length > 0) {
                        issues.push(`${el.tagName} "${el.textContent.trim().substring(0, 30)}" overflows by ${Math.round(rect.right - window.innerWidth)}px`);
                    }
                });
                return issues.slice(0, 5);
            });

            if (overflowingText.length > 0) {
                addFinding('Responsive', 'MEDIUM', `${route.name} @ 375px`,
                    `Text elements overflow viewport`,
                    overflowingText.join('\n'));
            }

            // Check for overlapping elements
            const touchTargets = await page.evaluate(() => {
                const issues = [];
                const buttons = document.querySelectorAll('button, a, [role="button"]');
                buttons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0 && rect.height < 30 && rect.width < 30) {
                        issues.push(`Small touch target: ${btn.tagName} "${btn.textContent?.trim().substring(0, 20)}" (${Math.round(rect.width)}x${Math.round(rect.height)}px)`);
                    }
                });
                return issues.slice(0, 5);
            });

            if (touchTargets.length > 0) {
                addFinding('Accessibility', 'LOW', `${route.name} @ 375px`,
                    `Small touch targets (< 30px)`,
                    touchTargets.join('\n'));
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 8. NETWORK REQUESTS — check for failed API calls
    // ═══════════════════════════════════════════════════════════════════
    test('8. Failed network requests', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        for (const route of PUBLIC_ROUTES) {
            const failedRequests = [];

            page.on('response', response => {
                const url = response.url();
                const status = response.status();
                if (status >= 400 && !url.includes('favicon') && !url.includes('sw.js') && !url.includes('manifest')) {
                    failedRequests.push(`${status} ${url.replace(BASE, '')}`);
                }
            });

            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(2000);

            if (failedRequests.length > 0) {
                addFinding('Network', 'MEDIUM', route.name,
                    `${failedRequests.length} failed request(s)`,
                    failedRequests.slice(0, 5).join('\n'));
            }

            page.removeAllListeners('response');
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 9. CONCURRENT USERS — simulate 10 users hitting pages at once
    // ═══════════════════════════════════════════════════════════════════
    test('9. Concurrent user simulation (10 users)', async ({ browser }) => {
        const startTime = Date.now();
        const pageTimes = [];
        const errors = [];

        const promises = Array.from({ length: 10 }, async (_, i) => {
            const context = await browser.newContext({
                viewport: VIEWPORTS[i % VIEWPORTS.length],
            });
            const page = await context.newPage();
            const route = PUBLIC_ROUTES[i % PUBLIC_ROUTES.length];

            page.on('pageerror', err => errors.push(`User ${i} on ${route.name}: ${err.message}`));

            const t0 = Date.now();
            try {
                await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 20000 });
                const loadTime = Date.now() - t0;
                pageTimes.push({ user: i, page: route.name, loadTime });

                if (loadTime > 5000) {
                    addFinding('Performance', 'MEDIUM', route.name,
                        `Slow page load under concurrent access: ${loadTime}ms`,
                        `User ${i}, viewport: ${VIEWPORTS[i % VIEWPORTS.length].name}`);
                }
            } catch (e) {
                addFinding('Stability', 'HIGH', route.name,
                    `Page failed to load under concurrent access`,
                    `User ${i}: ${e.message}`);
            }

            await context.close();
        });

        await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        if (errors.length > 0) {
            addFinding('Stability', 'HIGH', 'Concurrent',
                `${errors.length} error(s) during concurrent access`,
                errors.slice(0, 5).join('\n'));
        }

        const avgLoad = pageTimes.reduce((sum, p) => sum + p.loadTime, 0) / pageTimes.length;
        if (avgLoad > 3000) {
            addFinding('Performance', 'MEDIUM', 'All Pages',
                `Average load time ${Math.round(avgLoad)}ms under 10 concurrent users`,
                pageTimes.map(p => `${p.page}: ${p.loadTime}ms`).join('\n'));
        }
    });

    // ═══════════════════════════════════════════════════════════════════
    // 10. SPLASH SCREEN — verify it shows and disappears
    // ═══════════════════════════════════════════════════════════════════
    test('10. Splash screen behavior', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
        const page = await context.newPage();

        // Check splash exists before JS loads
        await page.goto(`${BASE}/feed`, { waitUntil: 'commit' });

        const splashExists = await page.evaluate(() => {
            return document.getElementById('splash') !== null;
        });

        if (!splashExists) {
            addFinding('UX', 'LOW', 'Splash Screen',
                'Splash screen element not found in HTML',
                'The #splash div should exist in index.html');
        }

        // Wait for app to load and check splash is gone
        await page.waitForTimeout(5000);
        const splashGone = await page.evaluate(() => {
            return document.getElementById('splash') === null;
        });

        if (!splashGone) {
            addFinding('UX', 'HIGH', 'Splash Screen',
                'Splash screen is still visible after app loaded',
                'React should replace the #splash content when mounting');
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 11. DISCOVER PAGE — tabs, filters, search
    // ═══════════════════════════════════════════════════════════════════
    test('11. Discover page functionality', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check tabs exist
        const tabs = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            return Array.from(btns)
                .filter(b => b.textContent?.match(/Projects|Builders|Investors|Members/i))
                .map(b => b.textContent.trim());
        });

        if (tabs.length === 0) {
            addFinding('Functionality', 'MEDIUM', 'Discover',
                'No tab buttons found',
                'Expected Projects, Builders, Investors, Members tabs');
        }

        // Click each tab and verify content changes
        for (const tabText of tabs) {
            const btn = page.locator(`button:has-text("${tabText}")`).first();
            if (await btn.isVisible()) {
                await btn.click();
                await page.waitForTimeout(1500);

                const hasContent = await page.evaluate(() => {
                    const cards = document.querySelectorAll('.card, [class*="card"], [class*="grid"] > *');
                    const emptyState = document.querySelector('[class*="empty"], [class*="no-results"]');
                    return cards.length > 0 || emptyState !== null;
                });

                if (!hasContent) {
                    addFinding('Functionality', 'MEDIUM', `Discover → ${tabText}`,
                        `Tab "${tabText}" shows no content or empty state`,
                        'Page may be stuck in loading state');
                }
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 12. MEDIA PAGE — tabs and content
    // ═══════════════════════════════════════════════════════════════════
    test('12. Media page tabs', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        await page.goto(`${BASE}/media`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check all tabs
        const mediaTabs = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            return Array.from(btns)
                .filter(b => b.className?.includes('tab'))
                .map(b => b.textContent.trim());
        });

        for (const tab of mediaTabs) {
            const btn = page.locator(`button:has-text("${tab}")`).first();
            if (await btn.isVisible()) {
                await btn.click();
                await page.waitForTimeout(2000);

                const errors = [];
                page.on('pageerror', err => errors.push(err.message));
                await page.waitForTimeout(500);

                if (errors.length > 0) {
                    addFinding('Functionality', 'HIGH', `Media → ${tab}`,
                        `JS error when clicking ${tab} tab`,
                        errors[0]);
                }
                page.removeAllListeners('pageerror');
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 13. EVENTS PAGE — check rendering
    // ═══════════════════════════════════════════════════════════════════
    test('13. Events page', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto(`${BASE}/events`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        if (errors.length > 0) {
            addFinding('Console Error', 'HIGH', 'Events',
                `JS errors on Events page`,
                errors.slice(0, 3).join('\n'));
        }

        // Check event cards render
        const eventCards = await page.evaluate(() => {
            return document.querySelectorAll('[class*="event"], [class*="card"]').length;
        });

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 14. LOGIN/SIGNUP — form validation
    // ═══════════════════════════════════════════════════════════════════
    test('14. Login and Signup form validation', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        // Test Login page
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const loginFormExists = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            const buttons = document.querySelectorAll('button[type="submit"], button');
            return inputs.length > 0 || buttons.length > 0;
        });

        if (!loginFormExists) {
            addFinding('Functionality', 'HIGH', 'Login',
                'No form elements found on Login page', '');
        }

        // Test Signup page
        await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);

        const signupFormExists = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            return inputs.length > 0;
        });

        if (!signupFormExists) {
            addFinding('Functionality', 'HIGH', 'Signup',
                'No form elements found on Signup page', '');
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 15. FONT CONSISTENCY — check all visible text uses Inter
    // ═══════════════════════════════════════════════════════════════════
    test('15. Font consistency check', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        for (const route of PUBLIC_ROUTES) {
            await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);

            const nonStandardFonts = await page.evaluate(() => {
                const issues = [];
                const allowedFonts = ['inter', 'pp formula narrow', 'system-ui', '-apple-system', 'sans-serif', 'monospace', 'sfmono-regular', 'cascadia code', 'ui-monospace'];
                document.querySelectorAll('h1, h2, h3, h4, p, span, a, button, div, li').forEach(el => {
                    const font = window.getComputedStyle(el).fontFamily.toLowerCase();
                    const rect = el.getBoundingClientRect();
                    if (rect.width === 0 || rect.height === 0) return;
                    if (rect.top > window.innerHeight) return;
                    const text = el.textContent?.trim();
                    if (!text || text.length < 2) return;

                    const fontNames = font.split(',').map(f => f.trim().replace(/['"]/g, ''));
                    const hasNonStandard = fontNames.some(f => !allowedFonts.some(af => f.includes(af)));
                    if (hasNonStandard && fontNames[0] !== 'inter' && !fontNames[0].includes('pp formula')) {
                        issues.push(`"${text.substring(0, 30)}" uses font: ${fontNames[0]}`);
                    }
                });
                return [...new Set(issues)].slice(0, 5);
            });

            if (nonStandardFonts.length > 0) {
                addFinding('Font', 'LOW', route.name,
                    `Non-standard fonts detected`,
                    nonStandardFonts.join('\n'));
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 16. Z-INDEX / OVERLAY STACKING — verify modals and overlays
    // ═══════════════════════════════════════════════════════════════════
    test('16. Z-index and stacking context check', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        await page.goto(`${BASE}/feed`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(2000);

        // Check navbar stays on top when scrolling
        await page.evaluate(() => window.scrollTo(0, 1000));
        await page.waitForTimeout(500);

        const navbarOnTop = await page.evaluate(() => {
            const nav = document.querySelector('nav, .navbar');
            if (!nav) return true;
            const style = window.getComputedStyle(nav);
            const pos = style.position;
            return pos === 'fixed' || pos === 'sticky';
        });

        if (!navbarOnTop) {
            addFinding('UX', 'MEDIUM', 'Feed',
                'Navbar may not stick to top when scrolling', '');
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 17. RAPID NAVIGATION — simulate fast tab switching
    // ═══════════════════════════════════════════════════════════════════
    test('17. Rapid navigation stress test', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        // Rapidly switch between pages
        const routes = ['/feed', '/discover', '/events', '/media', '/feed', '/discover', '/media', '/events', '/feed'];
        for (const path of routes) {
            await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
            await page.waitForTimeout(300); // Barely wait — stress the router
        }

        await page.waitForTimeout(2000);

        if (errors.length > 0) {
            addFinding('Stability', 'HIGH', 'Rapid Navigation',
                `${errors.length} error(s) during rapid page switching`,
                [...new Set(errors)].slice(0, 5).join('\n'));
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // 18. MEMORY LEAK CHECK — revisit pages and monitor heap
    // ═══════════════════════════════════════════════════════════════════
    test('18. Memory usage check', async ({ browser }) => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        // Enable JS heap metrics
        const client = await page.context().newCDPSession(page);
        await client.send('Performance.enable');

        const heapSizes = [];

        for (let i = 0; i < 3; i++) {
            for (const route of PUBLIC_ROUTES) {
                await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(500);
            }

            const metrics = await client.send('Performance.getMetrics');
            const heap = metrics.metrics.find(m => m.name === 'JSHeapUsedSize');
            if (heap) heapSizes.push(Math.round(heap.value / 1024 / 1024));
        }

        if (heapSizes.length >= 3) {
            const growth = heapSizes[2] - heapSizes[0];
            if (growth > 50) { // > 50MB growth over 3 rounds
                addFinding('Performance', 'MEDIUM', 'Memory',
                    `Possible memory leak: heap grew ${growth}MB over 3 navigation rounds`,
                    `Heap sizes: ${heapSizes.join('MB → ')}MB`);
            }
        }

        await context.close();
    });

    // ═══════════════════════════════════════════════════════════════════
    // FINAL REPORT — output all findings
    // ═══════════════════════════════════════════════════════════════════
    test.afterAll(() => {
        console.log('\n\n' + '═'.repeat(70));
        console.log('  BIES PLATFORM AUDIT REPORT');
        console.log('═'.repeat(70));

        const high = findings.filter(f => f.severity === 'HIGH');
        const medium = findings.filter(f => f.severity === 'MEDIUM');
        const low = findings.filter(f => f.severity === 'LOW');

        console.log(`\n  Total findings: ${findings.length}`);
        console.log(`  🔴 HIGH: ${high.length}  |  🟡 MEDIUM: ${medium.length}  |  🔵 LOW: ${low.length}`);

        const printSection = (title, items, emoji) => {
            if (items.length === 0) return;
            console.log(`\n${'─'.repeat(70)}`);
            console.log(`  ${emoji} ${title} (${items.length})`);
            console.log('─'.repeat(70));
            items.forEach((f, i) => {
                console.log(`\n  ${i + 1}. [${f.category}] ${f.page}`);
                console.log(`     ${f.description}`);
                if (f.details) {
                    f.details.split('\n').forEach(line => console.log(`     → ${line}`));
                }
            });
        };

        printSection('HIGH SEVERITY', high, '🔴');
        printSection('MEDIUM SEVERITY', medium, '🟡');
        printSection('LOW SEVERITY', low, '🔵');

        console.log('\n' + '═'.repeat(70));
        console.log('  END OF REPORT');
        console.log('═'.repeat(70) + '\n');
    });
});
