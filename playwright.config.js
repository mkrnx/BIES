import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:5173',
        browserName: 'chromium',
        headless: false,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },
    webServer: [
        {
            command: 'cd server && npx tsx src/index.ts',
            port: 3001,
            reuseExistingServer: true,
            timeout: 30_000,
        },
        {
            command: 'npx vite --port 5173',
            port: 5173,
            reuseExistingServer: true,
            timeout: 30_000,
        },
    ],
});
