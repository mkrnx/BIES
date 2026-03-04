import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/biestest/',
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
        proxy: {
            '/biestest/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/biestest\/api/, '/api'),
            },
            '/biestest/ws': {
                target: 'ws://localhost:3001',
                ws: true,
                rewrite: (path) => path.replace(/^\/biestest/, ''),
            },
            '/uploads': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
})
