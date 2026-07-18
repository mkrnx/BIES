/**
 * useWallet — React hook for wallet connectivity.
 *
 * Supports three wallet types:
 *   1. NWC (NIP-47 Nostr Wallet Connect) — client-side, stored in localStorage
 *   2. Coinos — server-side custodial wallet, stored in user profile
 *   3. Blink — server-side via the user's Galoy API key, stored in user profile
 *
 * Provides a unified interface: connect, disconnect, payInvoice, refreshBalance.
 *
 * State lives in a module-level store shared by every useWallet() instance
 * (via useSyncExternalStore), so connection status and balance stay consistent
 * across all mounted components. Balance is cached with a short TTL, refreshed
 * after successful payments and on window focus.
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { nwcClient, NWC_CHANGE_EVENT, isUnsupportedMethodError } from '../services/nwcService';
import { walletApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// walletType: 'none' | 'nwc' | 'coinos' | 'blink'

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
        } else if (state.walletType === 'blink') {
            const res = await walletApi.blinkBalance();
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

// Restore priority: Coinos (server-side), then Blink (server-side), then NWC
// (localStorage). Both server wallets are detected from the cached user profile.
function syncFromBackends(coinosUsername, blinkConnected) {
    if (coinosUsername) {
        if (state.walletType !== 'coinos' || !state.connected) {
            setState({ walletType: 'coinos', connected: true });
        }
        fetchBalance();
        return;
    }

    if (blinkConnected) {
        if (state.walletType !== 'blink' || !state.connected) {
            setState({ walletType: 'blink', connected: true });
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
    // while walletType is 'coinos'/'blink' can only mean logout (the server
    // wallets' disconnect paths never touch nwcClient), so reset the whole
    // store — the next user on a shared browser must never see the previous
    // user's connection or balance.
    window.addEventListener(NWC_CHANGE_EVENT, () => {
        if (!nwcClient.connected && state.connected) {
            balanceFetchedAt = 0;
            setState({ walletType: 'none', connected: false, balance: null, error: null });
        } else if (nwcClient.connected && state.walletType !== 'coinos' && state.walletType !== 'blink') {
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
        const stillConnected = (state.walletType === 'coinos' || state.walletType === 'blink')
            ? state.connected
            : nwcClient.connected;
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

async function connectBlinkAction(apiKey, refreshUser) {
    setState({ loading: true, error: null });
    try {
        // The server validates the key against the Galoy API and stores it
        // encrypted — the raw key never lives anywhere client-side.
        await walletApi.blinkConnect(apiKey);
        setState({ walletType: 'blink', connected: true });

        // Refresh user context to pick up blinkUsername/blinkWalletId on profile
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
    // Additive action: busy/error state is handled locally by the caller
    // (Wallet.jsx create card). Writing the shared store loading/error here
    // would leak into the embedded WalletConnect / Settings mid-create.
    const result = await walletApi.createCoinos(username);
    balanceFetchedAt = Date.now();
    setState({ walletType: 'coinos', connected: true, balance: 0, error: null });

    if (refreshUser) await refreshUser();
    return result;
}

async function disconnectAction(refreshUser) {
    if (state.walletType === 'coinos') {
        try {
            await walletApi.disconnectCoinos();
            if (refreshUser) await refreshUser();
        } catch { /* best-effort */ }
    } else if (state.walletType === 'blink') {
        try {
            await walletApi.blinkDisconnect();
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
        } else if (state.walletType === 'blink') {
            // Resolves for SUCCESS / ALREADY_PAID / PENDING — the server throws
            // on FAILURE. { status: 'PENDING' } means Galoy accepted the payment
            // and it is settling, which callers treat as success (same contract
            // as the coinos branch: resolution = payment accepted).
            result = await walletApi.blinkPay(bolt11);
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

// ─── Receive / transactions (additive — never touch store loading/error) ─────
//
// These actions are consumed by the /wallet page's own modals, which manage
// their busy/error state locally. Setting the store's `loading`/`error` here
// would leak into ZapModal/TicketPurchaseModal/WalletConnect mid-flow.

async function makeInvoiceAction(amountSats, memo) {
    if (!Number.isInteger(amountSats) || amountSats <= 0) {
        throw new Error('Invalid amount');
    }

    if (state.walletType === 'coinos') {
        const { pr, hash } = await walletApi.coinosInvoice(amountSats, memo);
        return { invoice: pr, hash: hash ?? null };
    }

    if (state.walletType === 'blink') {
        const { pr, hash } = await walletApi.blinkInvoice(amountSats, memo);
        return { invoice: pr, hash: hash ?? null };
    }

    if (state.walletType === 'nwc') {
        // Skip the roundtrip when the wallet told us it can't make invoices;
        // unknown capabilities (no get_info) still get an attempt.
        if (nwcClient.supports('make_invoice') === false) {
            const err = new Error('Your wallet does not support creating invoices');
            err.code = 'UNSUPPORTED';
            throw err;
        }
        try {
            // sats -> msats conversion happens here (nwcService is msats-native)
            const res = await nwcClient.makeInvoice(amountSats * 1000, memo);
            return { invoice: res.invoice, hash: res.payment_hash ?? null };
        } catch (err) {
            if (isUnsupportedMethodError(err)) {
                err.code = 'UNSUPPORTED';
            }
            throw err;
        }
    }

    throw new Error('No wallet connected');
}

async function listTransactionsAction({ limit = 20 } = {}) {
    if (state.walletType === 'coinos') {
        const { transactions } = await walletApi.coinosTransactions(limit);
        return { transactions, supported: true };
    }

    if (state.walletType === 'blink') {
        const { transactions } = await walletApi.blinkTransactions(limit);
        return { transactions, supported: true };
    }

    if (state.walletType === 'nwc') {
        // Conservative: unknown capabilities (no get_info) are treated as
        // unsupported — avoids a guaranteed 15s timeout on wallets that
        // almost never implement list_transactions without get_info.
        if (nwcClient.supports('list_transactions') !== true) {
            return { transactions: [], supported: false };
        }
        try {
            const res = await nwcClient.listTransactions({ limit });
            const raw = Array.isArray(res?.transactions) ? res.transactions : [];
            const transactions = raw.map((tx) => ({
                type: tx.type === 'outgoing' ? 'outgoing' : 'incoming',
                // NIP-47 amounts are msats
                amountSats: Math.floor((Number(tx.amount) || 0) / 1000),
                // NIP-47 timestamps are unix seconds
                createdAt: new Date((tx.settled_at ?? tx.created_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
                memo: (typeof tx.description === 'string' && tx.description) ? tx.description : null,
                hash: tx.payment_hash || null,
            }));
            return { transactions, supported: true };
        } catch (err) {
            // Wallet advertised the method but refused at call time
            if (isUnsupportedMethodError(err)) {
                return { transactions: [], supported: false };
            }
            throw err;
        }
    }

    return { transactions: [], supported: false };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWallet() {
    const { user, refreshUser } = useAuth();
    const snapshot = useSyncExternalStore(subscribe, getSnapshot);

    const coinosUsername = user?.profile?.coinosUsername || null;
    // Blink is detected the same way coinos is: from the sanitized profile
    // (the encrypted API key never reaches the client — only these markers).
    const blinkConnected = !!(user?.profile?.blinkUsername || user?.profile?.blinkWalletId);

    // Auto-restore on mount and whenever the server-wallet profile fields change
    useEffect(() => {
        syncFromBackends(coinosUsername, blinkConnected);
    }, [coinosUsername, blinkConnected]);

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

    // ─── Blink connect (API key, validated server-side) ──────────────────────

    const connectBlink = useCallback(
        (apiKey) => connectBlinkAction(apiKey, refreshUser),
        [refreshUser]
    );

    // ─── Disconnect (either type) ────────────────────────────────────────────

    const disconnect = useCallback(() => disconnectAction(refreshUser), [refreshUser]);

    // ─── Pay invoice (unified) ───────────────────────────────────────────────

    const payInvoice = useCallback((bolt11) => payInvoiceAction(bolt11), []);

    // ─── Refresh balance ─────────────────────────────────────────────────────

    const refreshBalance = useCallback(() => fetchBalance(true), []);

    // ─── Receive: invoice + transactions (additive, no store loading/error) ──

    const makeInvoice = useCallback((amountSats, memo) => makeInvoiceAction(amountSats, memo), []);

    const listTransactions = useCallback((opts) => listTransactionsAction(opts), []);

    // Defense in depth (see coinos.service disconnectWallet): a leftover
    // *.coinos.io profile address with no Coinos account connected points at
    // an orphaned custodial wallet — never advertise it as a receive method.
    // (Applies to blink too: a blink connection never clobbers an existing
    // address, so a pre-fix coinos leftover can survive underneath it. A
    // @blink.sv address is never orphaned this way — the user owns that
    // account directly at blink.sv, BIES never provisions it.)
    const profileLightningAddress = user?.profile?.lightningAddress || null;
    const orphanedCoinosAddress = (snapshot.walletType === 'nwc' || snapshot.walletType === 'blink')
        && !coinosUsername
        && !!profileLightningAddress
        && /@coinos\.io$/i.test(profileLightningAddress);

    // Both server-mediated wallets can always create invoices and list
    // transactions while connected — capability probing is an NWC-only concern.
    const isServerWallet = snapshot.walletType === 'coinos' || snapshot.walletType === 'blink';

    // Derived per render (not stored): nwcClient.capabilities only changes in
    // connect()/disconnect()/restore(), all of which trigger a store update or
    // the NWC_CHANGE_EVENT listener, so this stays in sync.
    const receiveCapabilities = {
        // Unknown capabilities (wallet never answered get_info) still get an
        // attempt — makeInvoiceAction only short-circuits on an explicit false.
        canMakeInvoice: isServerWallet
            ? snapshot.connected
            : (snapshot.walletType === 'nwc' && snapshot.connected && nwcClient.supports('make_invoice') !== false),
        canListTransactions: isServerWallet
            ? snapshot.connected
            : (snapshot.walletType === 'nwc' && snapshot.connected && nwcClient.supports('list_transactions') === true),
        // coinos: `${coinosUsername}@coinos.io` set server-side at create/connect;
        // blink: `${blinkUsername}@blink.sv` set server-side at connect, but only
        //        when the profile address was empty (custom addresses survive);
        // nwc: the user's self-set profile field (may be a different wallet)
        lightningAddress: orphanedCoinosAddress ? null : profileLightningAddress,
    };

    // Backwards-compatible: `connect` defaults to NWC for existing callers
    const connect = connectNwc;

    return {
        connected: snapshot.connected,
        walletType: snapshot.walletType,   // 'none' | 'nwc' | 'coinos' | 'blink'
        balance: snapshot.balance,          // msats (unified)
        loading: snapshot.loading,
        error: snapshot.error,
        connect,        // NWC connect (backwards-compatible)
        connectNwc,
        connectCoinos,
        createCoinos,
        connectBlink,
        disconnect,
        payInvoice,
        refreshBalance,
        makeInvoice,          // (amountSats, memo) -> { invoice, hash }
        listTransactions,     // ({ limit }) -> { transactions, supported }
        receiveCapabilities,  // { canMakeInvoice, canListTransactions, lightningAddress }
    };
}
