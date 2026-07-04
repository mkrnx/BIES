import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./version.json', 'utf8'))

// Shared dev-server + preview-server proxy: routes API/websocket/relay/upload
// traffic to the backend (3001) and Nostr relay (7777) so the browser only
// ever talks to Vite's origin.
const proxy = {
    '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
    },
    '/ws': {
        target: process.env.VITE_API_TARGET?.replace('http', 'ws') || 'ws://localhost:3001',
        ws: true,
    },
    '/relay': {
        target: 'ws://localhost:7777',
        ws: true,
        rewrite: () => '/',
        // Suppress error logging when the local relay is not running
        configure: (p) => {
            p.on('error', () => {});
        },
    },
    '/uploads': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
    },
    '/translate': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/translate/, ''),
    },
}

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    define: {
        __APP_VERSION__: JSON.stringify(version),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
        // Ensure Vite resolves shared dependencies (@scure/base etc.)
        // to a single copy when used by both nostr-tools and @sovit.xyz/keytr.
        dedupe: ['@scure/base'],
    },
    plugins: [
        react({
            babel: {
                plugins: ['styled-jsx/babel']
            }
        }),
        nodePolyfills({
            protocolImports: true,
        }),
    ],
    build: {
        // Transpile down to older Safari so the app boots on pre-iOS-16 iPhones.
        target: ['es2019', 'safari13'],
    },
    server: {
        host: true,
        proxy,
    },
    // `vite preview` (serving the production build) needs the same proxy as dev
    // so /api, /ws, /relay and /uploads still reach the backend + relay.
    preview: {
        host: true,
        proxy,
    },
})
