import { useState, useCallback } from 'react';
import { resolveLud16, requestInvoice, createZapRequest, payWithWebLN } from '../services/lightningService';
import { PUBLIC_RELAYS } from '../services/nostrService';

export function useZap() {
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const clearInvoice = useCallback(() => {
        setInvoice(null);
        setError(null);
    }, []);

    const createZap = useCallback(async ({ recipientPubkey, lud16, amountSats, comment, zappedEventId }) => {
        setLoading(true);
        setError(null);
        setInvoice(null);

        try {
            if (!lud16) {
                throw new Error('No Lightning address available for this recipient.');
            }

            const amountMsats = amountSats * 1000;

            // 1. Resolve LUD-16
            const lnurlData = await resolveLud16(lud16);
            if (!lnurlData) {
                throw new Error('Could not resolve Lightning address.');
            }

            if (amountMsats < lnurlData.minSendable || amountMsats > lnurlData.maxSendable) {
                const minSats = Math.ceil(lnurlData.minSendable / 1000);
                const maxSats = Math.floor(lnurlData.maxSendable / 1000);
                throw new Error(`Amount must be between ${minSats} and ${maxSats} sats.`);
            }

            // 2. Build NIP-57 zap request if Nostr extension + recipient supports it
            let zapRequestEvent = null;
            if (recipientPubkey && lnurlData.allowsNostr && lnurlData.nostrPubkey) {
                zapRequestEvent = await createZapRequest({
                    recipientPubkey,
                    amountMsats,
                    relays: PUBLIC_RELAYS.slice(0, 3),
                    eventId: zappedEventId,
                    content: comment || '',
                });
            }

            // 3. Request bolt11 invoice
            const invoiceData = await requestInvoice(lnurlData.callback, amountMsats, zapRequestEvent);
            if (!invoiceData?.pr) {
                throw new Error('Failed to get Lightning invoice.');
            }

            // 4. Try WebLN auto-payment
            const webLNResult = await payWithWebLN(invoiceData.pr);
            if (webLNResult.success) {
                setLoading(false);
                return { paid: true, preimage: webLNResult.preimage };
            }

            // 5. Fall back to showing invoice (for QR / manual copy)
            setInvoice(invoiceData.pr);
            setLoading(false);
            return { paid: false, bolt11: invoiceData.pr };
        } catch (err) {
            setError(err.message || 'Zap failed');
            setLoading(false);
            return { paid: false, error: err.message };
        }
    }, []);

    return { createZap, invoice, loading, error, clearInvoice };
}
