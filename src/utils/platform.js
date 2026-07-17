/**
 * Platform detection helpers for Capacitor (native iOS/Android) vs web.
 *
 * IMPORTANT: shared code must never import @capacitor/* at the top level —
 * these helpers rely only on the runtime `window.Capacitor` global that the
 * native shell injects, so the web bundle stays completely unchanged.
 */

/** True when running inside the Capacitor native shell (iOS/Android app). */
export function isNativePlatform() {
    return typeof window !== 'undefined' &&
        !!window.Capacitor?.isNativePlatform?.() &&
        window.Capacitor.isNativePlatform();
}

/** Returns 'ios' | 'android' | 'web'. */
export function getPlatform() {
    if (typeof window !== 'undefined' && typeof window.Capacitor?.getPlatform === 'function') {
        return window.Capacitor.getPlatform();
    }
    return 'web';
}
