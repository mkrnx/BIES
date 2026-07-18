/**
 * Blink Service — server-side wrapper for the Blink (Galoy) GraphQL API.
 *
 * The user supplies an API key created at dashboard.blink.sv (Read + Write
 * scopes). BIES talks to the Galoy GraphQL API server-side; the key is stored
 * encrypted (AES-256-GCM) on the Profile and NEVER logged or sent to clients.
 */

import { config } from '../config';
import prisma from '../lib/prisma';
import { encryptToken, decryptToken } from './coinos.service';

const API = config.blinkApiUrl;
const TIMEOUT_MS = 15_000;

// ─── GraphQL helpers ─────────────────────────────────────────────────────────

/**
 * POST a GraphQL request to the Blink API.
 * Defensive: timeouts, HTTP errors, invalid JSON, and top-level GraphQL
 * errors all throw. The API key only ever travels in the X-API-KEY header —
 * it is never interpolated into messages or logged.
 */
async function gqlFetch(apiKey: string, query: string, variables?: Record<string, any>): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(API, {
            method: 'POST',
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables: variables ?? {} }),
            signal: controller.signal,
        });
    } catch (e: any) {
        const err: any = new Error(e?.name === 'AbortError' ? 'Blink API timed out' : 'Blink API unreachable');
        err.status = 502;
        throw err;
    } finally {
        clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) {
        const err: any = new Error('Blink API key was rejected');
        err.status = 401;
        throw err;
    }
    if (!res.ok) {
        // Do not echo the response body — keep upstream errors bounded and key-free
        const err: any = new Error(`Blink API error (${res.status})`);
        err.status = res.status;
        throw err;
    }

    let body: any;
    try {
        body = await res.json();
    } catch {
        throw new Error('Blink API returned invalid JSON');
    }

    if (Array.isArray(body?.errors) && body.errors.length > 0) {
        const msg = String(body.errors[0]?.message || 'Blink API error').slice(0, 200);
        const err: any = new Error(msg);
        // Galoy reports auth failures as 200 + GraphQL errors
        if (/not authorized|unauthenticated|unauthorized|invalid.*(key|token)/i.test(msg)) {
            err.status = 401;
        }
        throw err;
    }

    return body?.data ?? {};
}

const ME_QUERY = `
query BiesMe {
  me {
    username
    defaultAccount {
      wallets {
        id
        walletCurrency
        balance
      }
    }
  }
}`;

/** Extract the BTC wallet from a `me` query result. Throws when absent. */
function pickBtcWallet(me: any): { id: string; balance: number } {
    const wallets = me?.defaultAccount?.wallets;
    const btc = Array.isArray(wallets)
        ? wallets.find((w: any) => w?.walletCurrency === 'BTC' && typeof w?.id === 'string' && w.id)
        : undefined;
    if (!btc) throw new Error('No BTC wallet found on this Blink account');
    return { id: btc.id, balance: Math.floor(Number(btc.balance) || 0) };
}

/**
 * Get the decrypted Blink API key + wallet id for a user.
 * Throws if no Blink wallet is connected.
 */
async function getCredentials(userId: string): Promise<{ apiKey: string; walletId: string }> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { blinkApiKey: true, blinkWalletId: true },
    });
    if (!profile?.blinkApiKey || !profile?.blinkWalletId) {
        throw new Error('No Blink wallet connected');
    }
    return { apiKey: decryptToken(profile.blinkApiKey), walletId: profile.blinkWalletId };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Validate a user-supplied Blink API key and persist the connection.
 * Picks the BTC wallet from the account (rejects if there is none) and stores
 * the encrypted key + wallet id + username on the Profile.
 *
 * Deliberately unlike Coinos: profile.lightningAddress is only set to
 * `<username>@blink.sv` when it is currently empty — a custom address the
 * user typed is never clobbered.
 */
export async function connectWallet(userId: string, apiKey: string): Promise<{
    username: string | null;
    walletId: string;
    lightningAddress: string;
}> {
    const data = await gqlFetch(apiKey, ME_QUERY);

    if (!data?.me) {
        const err: any = new Error('Invalid Blink API key');
        err.status = 401;
        throw err;
    }

    const btc = pickBtcWallet(data.me);
    const username = typeof data.me.username === 'string' && data.me.username ? data.me.username : null;

    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { lightningAddress: true },
    });

    // Only fill an EMPTY lightning address — never overwrite a custom one
    const setAddress = !!username && !profile?.lightningAddress;
    const lightningAddress = setAddress ? `${username}@blink.sv` : (profile?.lightningAddress || '');

    await prisma.profile.update({
        where: { userId },
        data: {
            blinkApiKey: encryptToken(apiKey),
            blinkWalletId: btc.id,
            blinkUsername: username,
            ...(setAddress ? { lightningAddress } : {}),
        },
    });

    return { username, walletId: btc.id, lightningAddress };
}

/**
 * Disconnect the Blink wallet from the user's profile.
 *
 * Clears the profile lightningAddress only when it is the one this wallet set
 * (`<blinkUsername>@blink.sv`) — user-typed addresses are left alone
 * (mirrors the Coinos disconnect behavior).
 */
export async function disconnectWallet(userId: string): Promise<void> {
    const profile = await prisma.profile.findUnique({
        where: { userId },
        select: { blinkUsername: true, lightningAddress: true },
    });

    const clearAddress = !!profile?.blinkUsername
        && profile.lightningAddress === `${profile.blinkUsername}@blink.sv`;

    await prisma.profile.update({
        where: { userId },
        data: {
            blinkUsername: null,
            blinkWalletId: null,
            blinkApiKey: null,
            // Schema default is '' (non-nullable) — the client treats '' as "no address"
            ...(clearAddress ? { lightningAddress: '' } : {}),
        },
    });
}

/**
 * Get the BTC wallet balance in sats (Galoy BTC wallets denominate in sats).
 */
export async function getBalance(userId: string): Promise<number> {
    const { apiKey } = await getCredentials(userId);
    const data = await gqlFetch(apiKey, ME_QUERY);
    if (!data?.me) {
        const err: any = new Error('Blink API key was rejected');
        err.status = 401;
        throw err;
    }
    return pickBtcWallet(data.me).balance;
}

/**
 * Pay a BOLT-11 Lightning invoice from the user's Blink BTC wallet.
 * SUCCESS / ALREADY_PAID / PENDING resolve to `{ status }`; anything else throws.
 */
export async function payInvoice(userId: string, bolt11: string): Promise<{ status: string }> {
    const { apiKey, walletId } = await getCredentials(userId);

    const data = await gqlFetch(apiKey, `
mutation BiesLnInvoicePaymentSend($input: LnInvoicePaymentInput!) {
  lnInvoicePaymentSend(input: $input) {
    status
    errors { message }
  }
}`, { input: { walletId, paymentRequest: bolt11 } });

    const payload = data?.lnInvoicePaymentSend;
    const status = payload?.status;

    if (status === 'SUCCESS' || status === 'ALREADY_PAID') return { status };
    if (status === 'PENDING') return { status }; // accepted, settling in-flight

    const msg = payload?.errors?.[0]?.message
        ? String(payload.errors[0].message).slice(0, 200)
        : 'Blink payment failed';
    throw new Error(msg);
}

/**
 * Create a Lightning invoice on the user's Blink BTC wallet.
 * `amount` is sats for BTC wallets.
 */
export async function createInvoice(userId: string, amountSats: number, memo?: string): Promise<{ pr: string; hash: string }> {
    const { apiKey, walletId } = await getCredentials(userId);

    const data = await gqlFetch(apiKey, `
mutation BiesLnInvoiceCreate($input: LnInvoiceCreateInput!) {
  lnInvoiceCreate(input: $input) {
    invoice { paymentRequest paymentHash }
    errors { message }
  }
}`, { input: { walletId, amount: amountSats, ...(memo ? { memo } : {}) } });

    const payload = data?.lnInvoiceCreate;
    const invoice = payload?.invoice;

    if (typeof invoice?.paymentRequest !== 'string' || !invoice.paymentRequest) {
        const msg = payload?.errors?.[0]?.message
            ? String(payload.errors[0].message).slice(0, 200)
            : 'Blink did not return an invoice';
        throw new Error(msg);
    }

    return { pr: invoice.paymentRequest, hash: typeof invoice.paymentHash === 'string' ? invoice.paymentHash : '' };
}

/**
 * List recent account transactions, normalized to the shared wallet
 * transaction shape ({ type, amountSats, createdAt, memo, hash }), newest-first.
 * Non-BTC (e.g. USD/Stablesats) rows are skipped defensively.
 */
export async function listTransactions(userId: string, limit = 20): Promise<Array<{
    type: 'incoming' | 'outgoing';
    amountSats: number;
    createdAt: string;
    memo: string | null;
    hash: string | null;
}>> {
    const { apiKey, walletId } = await getCredentials(userId);
    const first = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);

    // Scoped to the stored BTC wallet so USD/Stablesats activity can never
    // crowd BTC rows out of the first:N window.
    const data = await gqlFetch(apiKey, `
query BiesTransactions($first: Int, $walletIds: [WalletId]) {
  me {
    defaultAccount {
      transactions(walletIds: $walletIds, first: $first) {
        edges {
          node {
            direction
            settlementAmount
            settlementCurrency
            status
            createdAt
            memo
            initiationVia {
              __typename
              ... on InitiationViaLn {
                paymentHash
              }
            }
          }
        }
      }
    }
  }
}`, { first, walletIds: [walletId] });

    const edges = data?.me?.defaultAccount?.transactions?.edges;
    if (!Array.isArray(edges)) return [];

    return edges
        .map((e: any) => e?.node)
        .filter((n: any) => n && typeof n === 'object')
        // Skip non-BTC rows (USD/Stablesats) — settlementAmount would not be
        // sats. Defensive: the query is already scoped to the BTC wallet.
        .filter((n: any) => n.settlementCurrency === 'BTC' || n.settlementCurrency === undefined)
        // Failed payment attempts stay in Galoy's transaction list with
        // status FAILURE (the debit is reversed) — never show them as settled.
        .filter((n: any) => n.status !== 'FAILURE')
        .map((n: any) => {
            // Galoy returns createdAt as unix seconds OR an ISO string depending
            // on schema version — normalize both to an ISO string.
            let createdAt: string;
            const rawCreated = n.createdAt;
            if (typeof rawCreated === 'number' && Number.isFinite(rawCreated)) {
                createdAt = new Date(rawCreated * 1000).toISOString();
            } else if (typeof rawCreated === 'string' && rawCreated) {
                const parsed = new Date(/^\d+$/.test(rawCreated) ? Number(rawCreated) * 1000 : rawCreated);
                createdAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
            } else {
                createdAt = new Date().toISOString();
            }

            return {
                type: (n.direction === 'SEND' ? 'outgoing' : 'incoming') as 'incoming' | 'outgoing',
                amountSats: Math.abs(Math.trunc(Number(n.settlementAmount) || 0)),
                createdAt,
                memo: typeof n.memo === 'string' && n.memo ? n.memo : null,
                // Lightning rows expose the payment hash via initiationVia —
                // ReceiveModal matches it against makeInvoice's hash to detect
                // settlement. Non-LN rows (onchain, intraledger) stay null.
                hash: typeof n.initiationVia?.paymentHash === 'string' && n.initiationVia.paymentHash
                    ? n.initiationVia.paymentHash
                    : null,
            };
        })
        .sort((a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, first);
}
