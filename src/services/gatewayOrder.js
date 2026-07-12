/**
 * Pure gateway-ordering logic for keytr passkeys, extracted from
 * keytrService.js so it can be unit-tested without a browser.
 *
 * In keytr a "gateway" IS the WebAuthn rpId. WebAuthn only permits an rpId
 * that equals the serving domain (or a registrable suffix of it), unless the
 * rpId's domain authorizes the origin via a /.well-known/webauthn Related
 * Origins file. The primary gateway (index 0) is the rpId new passkeys are
 * registered on, so it must be the serving hostname itself — hardcoding one
 * deployment's domain (app.buildinelsalvador.com) broke passkeys on every
 * other deployment (e.g. bies.sovit.xyz).
 *
 * Ordering contract relied on by keytrService:
 *   [0]      → saveWithPasskey() registration rpId (must equal the origin)
 *   [1..n]   → addBackupGateway() rpIds (need Related-Origins whitelisting)
 *   iteration → loginWithPasskey() tier-3 discoverable fallback chain
 *
 * @param {string|undefined} hostname - serving hostname (window.location.hostname)
 * @param {readonly string[]} [fallbackGateways] - public keytr gateways (backups)
 * @returns {string[]} rpIds in priority order (primary first); never mutates input
 */
export function orderGateways(hostname, fallbackGateways = []) {
    // Dev/E2E: WebAuthn rejects cross-origin rpIds from a localhost origin,
    // so 'localhost' must be the sole rpId for passkeys to be testable.
    if (hostname === 'localhost') return ['localhost'];
    const backups = fallbackGateways.filter(g => g !== hostname);
    // No hostname (no window, e.g. tests/SSR): public gateways only.
    return hostname ? [hostname, ...backups] : backups;
}
