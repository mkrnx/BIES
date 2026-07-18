/**
 * Pure gateway-ordering and discovery-fallthrough logic for keytr passkeys,
 * extracted from keytrService.js so it can be unit-tested without a browser.
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

/**
 * Run a discoverable-login attempt against each gateway rpId in order until
 * one succeeds, with fall-through semantics that keep every credential
 * cohort reachable:
 *
 *   - A non-cancellation failure (e.g. SecurityError from an rpId that does
 *     not whitelist this origin) falls through to the next gateway silently —
 *     the pre-existing behaviour.
 *   - A user cancellation ALSO falls through. This is deliberate: a valid
 *     rpId with zero matching credentials (e.g. the serving domain on a
 *     fresh deployment while the user's passkey lives on keytr.org) still
 *     shows a browser prompt, and dismissing that empty prompt yields the
 *     same NotAllowedError as cancelling a populated picker — WebAuthn makes
 *     them indistinguishable by design (credential anti-enumeration).
 *     Treating cancellation as fatal would therefore hard-block users whose
 *     credentials exist only under a later (backup) gateway. The cost is
 *     that a genuine "never mind" can surface one prompt per remaining
 *     gateway before the flow ends.
 *
 * If no attempt succeeds and at least one failure was a cancellation, the
 * whole login classifies as a user cancellation (error.cancelled === true,
 * which the UI treats as a silent no-op rather than an error) — even if
 * other gateways failed with hard errors, since the user has already
 * deliberately dismissed at least one prompt. Otherwise the last hard error
 * (or a "no passkey found" fallback) is thrown.
 *
 * @param {readonly string[]} gateways - rpIds in priority order
 * @param {(rpId: string) => Promise<T>} attempt - one discover ceremony
 * @param {(err: unknown) => boolean} isCancellation - cancellation detector
 * @returns {Promise<T>} the first successful attempt's result
 * @template T
 */
export async function discoverThroughGateways(gateways, attempt, isCancellation) {
    let lastError;
    let sawCancellation = false;
    for (const rpId of gateways) {
        try {
            return await attempt(rpId);
        } catch (err) {
            if (isCancellation(err)) {
                sawCancellation = true;
                continue;
            }
            lastError = err;
        }
    }
    if (sawCancellation) {
        const cancelled = new Error('User cancelled passkey selection');
        cancelled.cancelled = true;
        throw cancelled;
    }
    throw lastError || new Error('No discoverable passkey found');
}
