import { defineConfig } from '@playwright/test';

// Config for running E2E tests against the production Docker setup
// (nginx on localhost:8082, no Vite dev server needed)
export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL: process.env.BIES_BASE_URL || 'http://localhost:8082',
        browserName: 'chromium',
        headless: true,
        screenshot: 'only-on-failure',
    },
    // No webServer — production docker is already running
});
