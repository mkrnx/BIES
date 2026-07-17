/**
 * useWallet — React hook for wallet connectivity.
 *
 * Supports two wallet types:
 *   1. NWC (NIP-47 Nostr Wallet Connect) — client-side, stored in localStorage
 *   2. Coinos — server-side custodial wallet, stored in user profile
 *
 * Provides a unified interface: connect, disconnect, payInvoice, refreshBalance.
 *
 * State lives in a module-level store shared by every useWallet() instance
 * (via useSyncExternalStore), so connection status and balance stay consistent
 * across all mounted components. Balance is cached with a short TTL, refreshed
 * after successful payments and on window focus.
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { nwcClient, NWC_CHANGE_EVENT } from '../services/nwcService';
import { walletApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// walletType: 'none' | 'nwc' | 'coinos'

const BALANCE_TTL_MS = 30_000;

// ─── Module-level store (shared across all hook instances) ──────────────────

let state = {
    walletType: 'none',
    connected: false,
    balance: null, // msats (unified)
    loading: false,
    error: null,
};
let balanceFetchedAt = 0;
const listeners = new Set();

function getSnapshot() {
    return state;
}

function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function setState(patch) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
}

// ─── Balance (TTL-cached) ────────────────────────────────────────────────────

async function fetchBalance(force = false) {
    if (!force && balanceFetchedAt && Date.now() - balanceFetchedAt < BALANCE_TTL_MS) {
        return;
    }
    try {
        if (state.walletType === 'coinos') {
            const res = await walletApi.coinosBalance();
            balanceFetchedAt = Date.now();
            setState({ balance: res.sats != null ? res.sats * 1000 : null }); // normalize to msats
        } else if (state.walletType === 'nwc' && nwcClient.connected) {
            // Skip the roundtrip if the wallet told us it can't report balance
            if (nwcClient.capabilities && !nwcClient.capabilities.includes('get_balance')) {
                return;
            }
            const res = await nwcClient.getBalance();
            balanceFetchedAt = Date.now();
            setState({ balance: res.balance ?? null });
        }
    } catch {
        // Ignore — balance may not be supported
    }
}

// ─── Restore / sync (idempotent, safe to call on every mount) ───────────────

// Check Coinos first (server-side), then NWC (localStorage)
function syncFromBackends(coinosUsername) {
    if (coinosUsername) {
        if (state.walletType !== 'coinos' || !state.connected) {
            setState({ walletType: 'coinos', connected: true });
        }
        fetchBalance();
        return;
    }

    const hasNwc = nwcClient.connected || nwcClient.restore();
    if (hasNwc) {
        if (state.walletType !== 'nwc' || !state.connected) {
            setState({ walletType: 'nwc', connected: true });
        }
        fetchBalance();
    } else if (state.connected) {
        // Wallet went away (e.g. logout cleared the NWC secret)
        balanceFetchedAt = 0;
        setState({ walletType: 'none', connected: false, balance: null, error: null });
    }
}

if (typeof window !== 'undefined') {
    // Keep the store in sync when the NWC connection changes outside React
    // (e.g. authService.logout() calls nwcClient.disconnect()). A teardown
    // while walletType is 'coinos' can only mean logout (the coinos
    // disconnect path never touches nwcClient), so reset the whole store —
    // the next user on a shared browser must never see the previous user's
    // connection or balance.
    window.addEventListener(NWC_CHANGE_EVENT, () => {
        if (!nwcClient.connected && state.connected) {
            balanceFetchedAt = 0;
            setState({ walletType: 'none', connected: false, balance: null, error: null });
        } else if (nwcClient.connected && state.walletType !== 'coinos') {
            setState({ walletType: 'nwc', connected: true });
        }
    });

    // Refresh balance when the user returns to the tab (TTL-guarded)
    window.addEventListener('focus', () => {
        if (state.connected) fetchBalance();
    });
}

// ─── Actions ─────────────────────────────────────────────────────────────────

async function connectNwcAction(nwcUri) {
    setState({ loading: true, error: null });
    try {
        // Verified handshake — only resolves after the wallet actually responds
        const result = await nwcClient.connect(nwcUri);
        setState({ walletType: 'nwc', connected: true });

        if (result?.balance != null) {
            // Handshake fell back to get_balance — reuse its result
            balanceFetchedAt = Date.now();
            setState({ balance: result.balance });
        } else {
            await fetchBalance(true);
        }
    } catch (err) {
        // nwcClient restores the previous connection on a failed handshake,
        // so only mark disconnected when nothing was connected before.
        const stillConnected = state.walletType === 'coinos' ? state.connected : nwcClient.connected;
        setState({ error: err.message, connected: stillConnected });
        throw err;
    } finally {
        setState({ loading: false });
    }
}

async function connectCoinosAction(username, password, refreshUser) {
    setState({ loading: true, error: null });
    try {
        await walletApi.connectCoinos(username, password);
        setState({ walletType: 'coinos', connected: true });

        // Refresh user context to pick up coinosUsername on profile
        if (refreshUser) await refreshUser();

        await fetchBalance(true);
    } catch (err) {
        setState({ error: err.message });
        throw err;
    } finally {
        setState({ loading: false });
    }
}

async function createCoinosAction(username, refreshUser) {
    setState({ loading: true, error: null });
    try {
        const result = await walletApi.createCoinos(username);
        balanceFetchedAt = Date.now();
        setState({ walletType: 'coinos', connected: true, balance: 0 });

        if (refreshUser) await refreshUser();
        return result;
    } catch (err) {
        setState({ error: err.message });
        throw err;
    } finally {
        setState({ loading: false });
    }
}

async function disconnectAction(refreshUser) {
    if (state.walletType === 'coinos') {
        try {
            await walletApi.disconnectCoinos();
            if (refreshUser) await refreshUser();
        } catch { /* best-effort */ }
    } else {
        nwcClient.disconnect();
    }
    balanceFetchedAt = 0;
    setState({ walletType: 'none', connected: false, balance: null, error: null });
}

async function payInvoiceAction(bolt11) {
    setState({ loading: true, error: null });
    try {
        let result;
        if (state.walletType === 'coinos') {
            result = await walletApi.coinosPay(bolt11);
        } else {
            result = await nwcClient.payInvoice(bolt11);
        }
        // Refresh balance after any successful payment (never throws)
        fetchBalance(true);
        return result;
    } catch (err) {
        setState({ error: err.message });
        throw err;
    } finally {
        setState({ loading: false });
    }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWallet() {
    const { user, refreshUser } = useAuth();
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);

    const coinosUsername = user?.profile?.coinosUsername || null;

    // Auto-restore on mount and whenever the coinos profile changes
    useEffect(() => {
        syncFromBackends(coinosUsername);
    }, [coinosUsername]);

    // ─── NWC connect ─────────────────────────────────────────────────────────

    const connectNwc = useCallback((nwcUri) => connectNwcAction(nwcUri), []);

    // ─── Coinos connect (existing account) ───────────────────────────────────

    const connectCoinos = useCallback(
        (username, password) => connectCoinosAction(username, password, refreshUser),
        [refreshUser]
    );

    // ─── Coinos create (new account, signup flow) ────────────────────────────

    const createCoinos = useCallback(
        (username) => createCoinosAction(username, refreshUser),
        [refreshUser]
    );

    // ─── Disconnect (either type) ────────────────────────────────────────────

    const disconnect = useCallback(() => disconnectAction(refreshUser), [refreshUser]);

    // ─── Pay invoice (unified) ───────────────────────────────────────────────

    const payInvoice = useCallback((bolt11) => payInvoiceAction(bolt11), []);

    // ─── Refresh balance ─────────────────────────────────────────────────────

    const refreshBalance = useCallback(() => fetchBalance(true), []);

    // Backwards-compatible: `connect` defaults to NWC for existing callers
    const connect = connectNwc;

    return {
        connected: snapshot.connected,
        walletType: snapshot.walletType,   // 'none' | 'nwc' | 'coinos'
        balance: snapshot.balance,          // msats (unified)
        loading: snapshot.loading,
        error: snapshot.error,
        connect,        // NWC connect (backwards-compatible)
        connectNwc,
        connectCoinos,
        createCoinos,
        disconnect,
        payInvoice,
        refreshBalance,
    };
}
