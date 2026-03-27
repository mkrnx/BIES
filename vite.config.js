import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
    resolve: {
        // @scure/base is used by both nostr-tools (v2) and @sovit.xyz/keytr (v1).
        // Without deduplication Vite can bundle two copies whose internal
        // bech32 instances are distinct objects, leading to cross-version type
        // mismatches ("e is not iterable").  The v1 and v2 APIs are identical,
        // so forcing a single copy is safe.
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
    server: {
        host: true,
        proxy: {
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
        },
    },
})
