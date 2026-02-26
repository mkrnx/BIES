import { Buffer } from 'buffer';

// Polyfill Buffer
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;

    // Polyfill global
    if (typeof window.global === 'undefined') {
        window.global = window;
    }
}
