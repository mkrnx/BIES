import { openExternal } from './openExternal';

/**
 * "Open with" map-app options for a coordinate.
 *
 * The web platform cannot detect which apps are actually installed (browsers
 * block installed-app probing), so availability is inferred from the OS:
 *   - Apple Maps  → Apple devices only (iPhone/iPad/iPod, macOS; iPadOS
 *                   masquerades as Macintosh but exposes touch points).
 *   - Google Maps → every platform.
 *   - Waze        → mobile devices only (no desktop app exists).
 *
 * All three use HTTPS universal links: the OS hands them to the native app
 * when it is installed and falls back to the provider's web page when not —
 * which is the correct behavior for e.g. an Android phone without Waze.
 * (A future native build can upgrade to true detection via
 * @capacitor/app-launcher canOpenUrl + LSApplicationQueriesSchemes.)
 */

function ua() {
    return typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
}

/** iPadOS Safari reports "Macintosh" but, unlike real Macs, is multi-touch. */
function isIpadMasquerade() {
    return /Macintosh/i.test(ua())
        && typeof navigator !== 'undefined'
        && (navigator.maxTouchPoints || 0) > 1;
}

export function isAppleDevice() {
    // iPhone/iPad/iPod, plus macOS (Apple Maps ships on the Mac too).
    return /iPad|iPhone|iPod|Macintosh/i.test(ua());
}

export function isMobileDevice() {
    return /iPad|iPhone|iPod|Android/i.test(ua()) || isIpadMasquerade();
}

/**
 * Ordered list of map apps that make sense on this device.
 * Each entry: { id, label, buildUrl({lat, lng, label}) -> string }.
 */
export function getMapAppOptions() {
    const options = [];
    if (isAppleDevice()) {
        options.push({
            id: 'apple',
            label: 'Apple Maps',
            buildUrl: ({ lat, lng, label }) =>
                `https://maps.apple.com/?ll=${lat},${lng}${label ? `&q=${encodeURIComponent(label)}` : ''}`,
        });
    }
    options.push({
        id: 'google',
        label: 'Google Maps',
        buildUrl: ({ lat, lng }) =>
            `https://www.google.com/maps/search/?api=1&query=${lat}%2C${lng}`,
    });
    if (isMobileDevice()) {
        options.push({
            id: 'waze',
            label: 'Waze',
            buildUrl: ({ lat, lng }) =>
                `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`,
        });
    }
    return options;
}

/** Open one option (from getMapAppOptions) for the given coordinate. */
export function openMapApp(option, { lat, lng, label }) {
    if (!option || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    openExternal(option.buildUrl({ lat, lng, label }));
}
