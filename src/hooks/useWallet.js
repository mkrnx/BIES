/**
 * useWallet — React hook for wallet connectivity.
 *
 * Supports two wallet types:
 *   1. NWC (NIP-47 Nostr Wallet Connect) — client-side, stored in localStorage
 *   2. Coinos — server-side custodial wallet, stored in user profile
 *
 * Provides a unified interface: connect, disconnect, payInvoice, refreshBalance.
 */

import { useState, useEffect, useCallback } from 'react';
import { nwcClient } from '../services/nwcService';
import { walletApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// walletType: 'none' | 'nwc' | 'coinos'

export function useWallet() {
    const { user, refreshUser } = useAuth();
    const [walletType, setWalletType] = useState('none');
    const [connected, setConnected] = useState(false);
    const [balance, setBalance] = useState(null); // sats (coinos) or msats (nwc)
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const coinosUsername = user?.profile?.coinosUsername || null;

    // Auto-restore on mount: check Coinos first (server-side), then NWC (localStorage)
    useEffect(() => {
        if (coinosUsername) {
            setWalletType('coinos');
            setConnected(true);
            walletApi.coinosBalance()
                .then(res => setBalance(res.sats != null ? res.sats * 1000 : null)) // normalize to msats
                .catch(() => {});
            return;
        }

        const restored = nwcClient.restore();
        if (restored) {
            setWalletType('nwc');
            setConnected(true);
            nwcClient.getBalance()
                .then(res => setBalance(res.balance ?? null))
                .catch(() => {});
        }
    }, [coinosUsername]);

    // ─── NWC connect ─────────────────────────────────────────────────────────

    const connectNwc = useCallback(async (nwcUri) => {
        setLoading(true);
        setError(null);
        try {
            nwcClient.connect(nwcUri);
            setWalletType('nwc');
            setConnected(true);

            try {
                const res = await nwcClient.getBalance();
                setBalance(res.balance ?? null);
            } catch {
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

    // ─── Coinos connect (existing account) ───────────────────────────────────

    const connectCoinos = useCallback(async (username, password) => {
        setLoading(true);
        setError(null);
        try {
            await walletApi.connectCoinos(username, password);
            setWalletType('coinos');
            setConnected(true);

            // Refresh user context to pick up coinosUsername on profile
            if (refreshUser) await refreshUser();

            try {
                const res = await walletApi.coinosBalance();
                setBalance(res.sats != null ? res.sats * 1000 : null);
            } catch {
                setBalance(null);
            }
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [refreshUser]);

    // ─── Coinos create (new account, signup flow) ────────────────────────────

    const createCoinos = useCallback(async (username) => {
        setLoading(true);
        setError(null);
        try {
            const result = await walletApi.createCoinos(username);
            setWalletType('coinos');
            setConnected(true);
            setBalance(0);

            if (refreshUser) await refreshUser();
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [refreshUser]);

    // ─── Disconnect (either type) ────────────────────────────────────────────

    const disconnect = useCallback(async () => {
        if (walletType === 'coinos') {
            try {
                await walletApi.disconnectCoinos();
                if (refreshUser) await refreshUser();
            } catch { /* best-effort */ }
        } else {
            nwcClient.disconnect();
        }
        setWalletType('none');
        setConnected(false);
        setBalance(null);
        setError(null);
    }, [walletType, refreshUser]);

    // ─── Pay invoice (unified) ───────────────────────────────────────────────

    const payInvoice = useCallback(async (bolt11) => {
        setLoading(true);
        setError(null);
        try {
            let result;
            if (walletType === 'coinos') {
                result = await walletApi.coinosPay(bolt11);
                // Refresh balance
                walletApi.coinosBalance()
                    .then(res => setBalance(res.sats != null ? res.sats * 1000 : null))
                    .catch(() => {});
            } else {
                result = await nwcClient.payInvoice(bolt11);
                nwcClient.getBalance()
                    .then(res => setBalance(res.balance ?? null))
                    .catch(() => {});
            }
            return result;
        } catch (err) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [walletType]);

    // ─── Refresh balance ─────────────────────────────────────────────────────

    const refreshBalance = useCallback(async () => {
        try {
            if (walletType === 'coinos') {
                const res = await walletApi.coinosBalance();
                setBalance(res.sats != null ? res.sats * 1000 : null);
            } else if (nwcClient.connected) {
                const res = await nwcClient.getBalance();
                setBalance(res.balance ?? null);
            }
        } catch {
            // Ignore — balance may not be supported
        }
    }, [walletType]);

    // Backwards-compatible: `connect` defaults to NWC for existing callers
    const connect = connectNwc;

    return {
        connected,
        walletType,     // 'none' | 'nwc' | 'coinos'
        balance,        // msats (unified)
        loading,
        error,
        connect,        // NWC connect (backwards-compatible)
        connectNwc,
        connectCoinos,
        createCoinos,
        disconnect,
        payInvoice,
        refreshBalance,
    };
}
