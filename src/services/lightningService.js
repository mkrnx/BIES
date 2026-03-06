import { nostrSigner } from './nostrSigner.js';

/**
 * Resolve a LUD-16 Lightning address to LNURL-pay metadata.
 * e.g. "user@walletofsatoshi.com" → GET https://walletofsatoshi.com/.well-known/lnurlp/user
 * @param {string} lud16 - Lightning address (user@domain)
 * @returns {Promise<{callback: string, minSendable: number, maxSendable: number, metadata: string, allowsNostr?: boolean, nostrPubkey?: string}|null>}
 */
export async function resolveLud16(lud16) {
    if (!lud16 || !lud16.includes('@')) return null;
    const [username, domain] = lud16.split('@');
    if (!username || !domain) return null;

    try {
        const res = await fetch(`https://${domain}/.well-known/lnurlp/${username}`);
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status === 'ERROR') return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * Request a Lightning invoice from an LNURL-pay callback.
 * @param {string} callback - LNURL-pay callback URL
 * @param {number} amountMsats - Amount in millisatoshis
 * @param {string} [zapRequestEvent] - Serialized NIP-57 zap request event (JSON string)
 * @returns {Promise<{pr: string, routes: any[]}|null>} - pr is the bolt11 invoice
 */
export async function requestInvoice(callback, amountMsats, zapRequestEvent) {
    try {
        const url = new URL(callback);
        url.searchParams.set('amount', String(amountMsats));
        if (zapRequestEvent) {
            url.searchParams.set('nostr', zapRequestEvent);
        }
        const res = await fetch(url.toString());
        if (!res.ok) return null;
        const data = await res.json();
        if (data.status === 'ERROR') return null;
        return data;
    } catch {
        return null;
    }
}

/**
 * Pay a Lightning invoice via WebLN (browser extension like Alby).
 * @param {string} bolt11 - Lightning invoice
 * @returns {Promise<{success: boolean, preimage?: string, error?: string}>}
 */
export async function payWithWebLN(bolt11) {
    try {
        if (!window.webln) return { success: false, error: 'WebLN not available' };
        await window.webln.enable();
        const result = await window.webln.sendPayment(bolt11);
        return { success: true, preimage: result?.preimage };
    } catch (err) {
        return { success: false, error: err?.message || 'WebLN payment failed' };
    }
}

/**
 * Check if WebLN is available in the browser.
 */
export function hasWebLN() {
    return typeof window !== 'undefined' && !!window.webln;
}

/**
 * Build a NIP-57 zap request event (Kind 9734).
 * Signs via the nostrSigner (in-memory key or browser extension).
 * @param {Object} params
 * @param {string} params.recipientPubkey - Hex pubkey of the zap recipient
 * @param {number} params.amountMsats - Amount in millisatoshis
 * @param {string[]} params.relays - Relay URLs for the zap receipt
 * @param {string} [params.eventId] - Nostr event ID being zapped (optional)
 * @param {string} [params.content] - Zap comment (optional)
 * @returns {Promise<string|null>} - JSON-serialized signed event, or null if no extension
 */
export async function createZapRequest({ recipientPubkey, amountMsats, relays, eventId, content }) {
    const tags = [
        ['relays', ...relays],
        ['amount', String(amountMsats)],
        ['p', recipientPubkey],
    ];
    if (eventId) {
        tags.push(['e', eventId]);
    }

    const event = {
        kind: 9734,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: content || '',
    };

    try {
        const signed = await nostrSigner.signEvent(event);
        return JSON.stringify(signed);
    } catch {
        return null;
    }
}

/**
 * Execute a full zap flow for one or more recipients.
 * Splits the amount equally among recipients with valid lud16.
 *
 * @param {Object} params
 * @param {Array<{pubkey: string, lud16: string, name: string}>} params.recipients - Recipients with resolved lud16
 * @param {number} params.totalSats - Total amount in satoshis
 * @param {string[]} params.relays - Relay URLs for zap receipts
 * @param {string} [params.eventId] - Nostr event ID being zapped
 * @param {string} [params.content] - Zap comment
 * @param {function} [params.onProgress] - Callback for progress updates: (step, total, recipient)
 * @returns {Promise<{results: Array<{recipient: string, success: boolean, bolt11?: string, preimage?: string, error?: string}>, allPaidViaWebLN: boolean}>}
 */
export async function executeZapFlow({ recipients, totalSats, relays, eventId, content, onProgress }) {
    const validRecipients = recipients.filter(r => r.lud16);
    if (validRecipients.length === 0) {
        return { results: [], allPaidViaWebLN: false };
    }

    const perRecipientSats = Math.floor(totalSats / validRecipients.length);
    const perRecipientMsats = perRecipientSats * 1000;
    const results = [];
    let allPaidViaWebLN = true;

    for (let i = 0; i < validRecipients.length; i++) {
        const recipient = validRecipients[i];
        onProgress?.(i + 1, validRecipients.length, recipient);

        // 1. Resolve LNURL-pay endpoint
        const lnurlData = await resolveLud16(recipient.lud16);
        if (!lnurlData) {
            results.push({ recipient: recipient.name, success: false, error: 'Could not resolve Lightning address' });
            allPaidViaWebLN = false;
            continue;
        }

        // Check amount bounds
        if (perRecipientMsats < lnurlData.minSendable || perRecipientMsats > lnurlData.maxSendable) {
            results.push({
                recipient: recipient.name,
                success: false,
                error: `Amount out of range (${lnurlData.minSendable / 1000}-${lnurlData.maxSendable / 1000} sats)`,
            });
            allPaidViaWebLN = false;
            continue;
        }

        // 2. Create NIP-57 zap request if possible
        let zapRequest = null;
        if (lnurlData.allowsNostr && lnurlData.nostrPubkey) {
            zapRequest = await createZapRequest({
                recipientPubkey: recipient.pubkey,
                amountMsats: perRecipientMsats,
                relays,
                eventId,
                content,
            });
        }

        // 3. Request invoice
        const invoiceData = await requestInvoice(lnurlData.callback, perRecipientMsats, zapRequest);
        if (!invoiceData?.pr) {
            results.push({ recipient: recipient.name, success: false, error: 'Failed to get invoice' });
            allPaidViaWebLN = false;
            continue;
        }

        // 4. Try WebLN payment
        const weblnResult = await payWithWebLN(invoiceData.pr);
        if (weblnResult.success) {
            results.push({ recipient: recipient.name, success: true, preimage: weblnResult.preimage });
        } else {
            // WebLN failed — return bolt11 for QR fallback
            results.push({ recipient: recipient.name, success: false, bolt11: invoiceData.pr, error: weblnResult.error });
            allPaidViaWebLN = false;
        }
    }

    return { results, allPaidViaWebLN };
}
