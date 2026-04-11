import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    timeout: 120_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:5173',
        browserName: 'chromium',
        headless: true,
        screenshot: 'on',
        trace: 'off',
    },
    // No webServer — use the already-running Vite with live API proxy
});
