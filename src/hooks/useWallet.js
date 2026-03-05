/**
 * useWallet — React hook for NIP-47 Nostr Wallet Connect.
 *
 * Provides connect/disconnect, payInvoice, and optional balance retrieval.
 * Persists the NWC URI in localStorage and auto-reconnects on mount.
 */

import { useState, useEffect, useCallback } from 'react';
import { nwcClient } from '../services/nwcService';

export function useWallet() {
    const [connected, setConnected] = useState(false);
    const [balance, setBalance] = useState(null); // msats or null
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Auto-restore connection on mount
    useEffect(() => {
        const restored = nwcClient.restore();
        setConnected(restored);
        if (restored) {
            // Attempt to fetch balance silently
            nwcClient.getBalance()
                .then(res => setBalance(res.balance ?? null))
                .catch(() => {}); // balance is optional
        }
    }, []);

    /**
     * Connect to a wallet using an NWC URI.
     * Optionally fetches balance to verify the connection works.
     */
    const connect = useCallback(async (nwcUri) => {
        setLoading(true);
        setError(null);
        try {
            nwcClient.connect(nwcUri);
            setConnected(true);

            // Try fetching balance to verify the connection
            try {
                const res = await nwcClient.getBalance();
                setBalance(res.balance ?? null);
            } catch {
                // Balance not supported — connection is still valid
                setBalance(null);
            }
        } catch (err) {
            setError(err.message);
            setConnected(false);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Disconnect the wallet.
     */
    const disconnect = useCallback(() => {
        nwcClient.disconnect();
        setConnected(false);
        setBalance(null);
        setError(null);
    }, []);

    /**
     * Pay a Lightning invoice via the connected wallet.
     * @param {string} bolt11 - BOLT-11 invoice
     * @returns {Promise<{ preimage: string }>}
     */
    const payInvoice = useCallback(async (bolt11) => {
        setLoading(true);
        setError(null);
        try {
            const result = await nwcClient.payInvoice(bolt11);
            // Refresh balance after payment
            nwcClient.getBalance()
                .then(res => setBalance(res.balance ?? null))
                .catch(() => {});
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Refresh the wallet balance.
     */
    const refreshBalance = useCallback(async () => {
        if (!nwcClient.connected) return;
        try {
            const res = await nwcClient.getBalance();
            setBalance(res.balance ?? null);
        } catch {
            // Ignore — balance may not be supported
        }
    }, []);

    return {
        connected,
        balance,
        loading,
        error,
        connect,
        disconnect,
        payInvoice,
        refreshBalance,
    };
}
