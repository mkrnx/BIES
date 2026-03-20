import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/',
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
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:3001',
                ws: true,
            },
            '/relay': {
                target: 'ws://localhost:7777',
                ws: true,
                rewrite: () => '/',
            },
            '/uploads': {
                target: 'http://localhost:3001',
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
