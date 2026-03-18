/**
 * fingerprintService — collects browser signals and generates a stable hash
 * for ban evasion detection.
 *
 * Signals collected (all non-PII, device/browser characteristics):
 *  - Canvas rendering fingerprint
 *  - WebGL renderer/vendor
 *  - Screen resolution + color depth
 *  - Timezone
 *  - Language preferences
 *  - Platform
 *  - Hardware concurrency (CPU cores)
 *  - Device memory
 *  - Touch support
 *
 * The hash is deterministic for the same browser+device combination.
 */

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('BIES fp', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('BIES fp', 4, 17);

        return canvas.toDataURL();
    } catch {
        return '';
    }
}

function getWebGLInfo() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return { vendor: '', renderer: '' };

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return { vendor: '', renderer: '' };

        return {
            vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '',
            renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '',
        };
    } catch {
        return { vendor: '', renderer: '' };
    }
}

export const fingerprintService = {
    /**
     * Collect browser signals and return a SHA-256 hash.
     * Returns null if fingerprinting fails entirely.
     */
    getFingerprint: async () => {
        try {
            const webgl = getWebGLInfo();
            const canvas = getCanvasFingerprint();

            const signals = [
                `screen:${screen.width}x${screen.height}x${screen.colorDepth}`,
                `tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
                `lang:${navigator.language}`,
                `langs:${(navigator.languages || []).join(',')}`,
                `platform:${navigator.platform || ''}`,
                `cores:${navigator.hardwareConcurrency || 0}`,
                `mem:${navigator.deviceMemory || 0}`,
                `touch:${navigator.maxTouchPoints || 0}`,
                `webgl_vendor:${webgl.vendor}`,
                `webgl_renderer:${webgl.renderer}`,
                `canvas:${canvas}`,
            ];

            return await sha256(signals.join('|'));
        } catch {
            return null;
        }
    },
};
