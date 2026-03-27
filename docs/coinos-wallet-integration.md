# BIES Coinos Wallet Integration — Technical Reference

## Overview

BIES integrates [Coinos](https://coinos.io) as an optional **custodial Lightning wallet** for users. This provides two capabilities:

1. **Signup wallet provisioning** — New users can opt into an instant Coinos wallet during signup, giving them a Lightning address and the ability to send/receive sats immediately without external wallet setup.
2. **Settings wallet connection** — Existing users can connect their Coinos account in Settings as an alternative to NWC (Nostr Wallet Connect).

Both features are independently controlled by feature flags. The Coinos wallet integrates into the existing payment chain used by the ZapModal — when connected, it takes priority over NWC and WebLN.

---

## Feature Flags

| Flag | File | Default | Controls |
|---|---|---|---|
| `COINOS_SIGNUP_WALLET` | `src/config/featureFlags.js` | `true` | "Enable Instant Wallet" checkbox on signup Step 2 |
| `COINOS_ENABLED` | `src/config/featureFlags.js` | `true` | Coinos tab in Settings wallet section |

To disable the signup wallet without removing code, set `COINOS_SIGNUP_WALLET = false`. The Settings connection (option 3) remains available independently via `COINOS_ENABLED`.

---

## Architecture

### File Map

| File | Responsibility |
|---|---|
| `src/config/featureFlags.js` | Feature flag definitions (`COINOS_SIGNUP_WALLET`, `COINOS_ENABLED`) |
| `src/services/api.js` | Frontend API client — `walletApi` methods for all Coinos endpoints |
| `src/hooks/useWallet.js` | Unified wallet hook — supports NWC and Coinos with a single interface |
| `src/components/WalletConnect.jsx` | Settings UI — tabbed NWC / Coinos connection interface |
| `src/pages/Signup.jsx` | Signup Step 2 — optional Coinos wallet creation (gated by flag) |
| `src/components/ZapModal.jsx` | Payment flow — uses unified `payInvoice` from `useWallet` |
| `server/src/config/index.ts` | Server config — `COINOS_API_URL` environment variable |
| `server/src/services/coinos.service.ts` | Coinos API wrapper — account creation, auth, payments, token encryption |
| `server/src/routes/wallet.routes.ts` | REST endpoints — create, connect, disconnect, balance, pay |
| `server/src/controllers/auth.controller.ts` | Strips `coinosToken` from `/auth/me` responses |
| `server/prisma/schema.prisma` | Profile model — `coinosUsername`, `coinosToken` fields |

### Data Flow

```
+-------------------+         +-------------------+         +-------------------+
|   Browser Client  |         |   BIES Backend    |         |   Coinos API      |
|                   |         |                   |         |   coinos.io/api   |
|  useWallet hook   | ------> |  wallet.routes.ts | ------> |                   |
|  WalletConnect UI |  HTTPS  |  coinos.service   |  HTTPS  |  POST /users      |
|  Signup.jsx       |         |                   |         |  POST /login      |
|  ZapModal.jsx     | <------ |  Encrypted token  | <------ |  POST /payments   |
|                   |         |  in PostgreSQL    |         |  GET /me          |
+-------------------+         +-------------------+         +-------------------+
```

### Trust Model

- **Coinos holds the Lightning funds** — this is a custodial integration. Users trust Coinos with their sats.
- **BIES stores the Coinos JWT** encrypted with AES-256-GCM on the server, keyed by the server's `ENCRYPTION_SECRET`.
- **The Coinos token is never sent to the client** — all payment operations are proxied through the BIES backend.
- **Users can disconnect at any time** via Settings, which deletes the stored token from the database.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `COINOS_API_URL` | `https://coinos.io/api` | Base URL for the Coinos API. Change for self-hosted instances. |
| `ENCRYPTION_SECRET` | (required in prod) | Used to derive the AES-256-GCM key for encrypting Coinos tokens at rest. |

---

## API Endpoints

All endpoints require JWT authentication (`Authorization: Bearer <token>`).

| Method | Path | Body | Response | Description |
|---|---|---|---|---|
| `POST` | `/api/wallet/coinos/create` | `{ username }` | `{ coinosUsername, lightningAddress }` | Create a new Coinos account and link it |
| `POST` | `/api/wallet/coinos/connect` | `{ username, password }` | `{ coinosUsername, lightningAddress }` | Connect an existing Coinos account |
| `POST` | `/api/wallet/coinos/disconnect` | — | `{ ok: true }` | Remove Coinos wallet from profile |
| `GET` | `/api/wallet/coinos/balance` | — | `{ sats }` | Get current wallet balance |
| `POST` | `/api/wallet/coinos/pay` | `{ bolt11 }` | `{ hash }` | Pay a BOLT-11 Lightning invoice |

### Error Responses

- `400` — Invalid input (bad username format, missing bolt11)
- `401` — Invalid Coinos credentials (connect endpoint)
- `409` — Username already taken on Coinos (create endpoint)
- `500` — Coinos API unreachable or internal error

---

## Token Encryption

Coinos JWTs are stored encrypted in `Profile.coinosToken` using AES-256-GCM:

```
ENCRYPTION_SECRET
       |
       | scrypt (salt: "coinos-token-salt", keylen: 32)
       v
   AES-256-GCM key
       |
       +--- IV (12 random bytes)
       +--- Ciphertext
       +--- Auth Tag (16 bytes)
       |
       v
   Stored as: "iv_hex:tag_hex:ciphertext_hex"
```

The key is derived from `config.encryptionSecret` (the same secret used for custodial Nostr private keys). Decryption happens only on the server when a wallet operation is requested — the plaintext token is never persisted outside of a single request scope.

---

## Database Schema

Two fields added to the `Profile` model (`profiles` table):

```sql
ALTER TABLE "profiles" ADD COLUMN "coinos_username" TEXT;
ALTER TABLE "profiles" ADD COLUMN "coinos_token" TEXT;
CREATE UNIQUE INDEX "profiles_coinos_username_key" ON "profiles"("coinos_username");
```

| Column | Type | Constraint | Description |
|---|---|---|---|
| `coinos_username` | `TEXT` | `UNIQUE`, nullable | Coinos account username |
| `coinos_token` | `TEXT` | nullable | AES-256-GCM encrypted Coinos JWT |

When a Coinos wallet is created or connected, `lightningAddress` on the profile is also set to `{username}@coinos.io`.

Migration: `server/prisma/migrations/20260327000000_add_coinos_wallet_fields/migration.sql`

---

## User Flows

### Flow 1: Signup with Instant Wallet

Requires `COINOS_SIGNUP_WALLET = true`.

```
Step 0: Generate Keys
       |
Step 1: Backup Keys (nsec, seed, keyfile, passkey)
       |
Step 2: Complete Profile
       |
       +--- Display Name input
       |
       +--- [x] Enable Instant Wallet (Coinos)    <-- feature-flagged
       |         |
       |         +--- Wallet username input
       |         +--- Preview: "your-name@coinos.io"
       |
       +--- "Enter Dashboard" button
              |
              v
         1. loginWithNsec(keys.nsec)
         2. completeNostrProfile({ name })
         3. walletApi.createCoinos(username)   <-- non-fatal if fails
         4. navigate('/dashboard')
```

The Coinos wallet creation is **non-fatal** — if the Coinos API is down or the username is taken, the user still completes signup successfully. They can set up a wallet later in Settings.

### Flow 2: Connect Existing Account in Settings

Requires `COINOS_ENABLED = true`.

```
Settings > Lightning Wallet
       |
       +--- [NWC] [Coinos] tabs
              |
              v (Coinos tab)
         Username input
         Password input
         "Connect Coinos" button
              |
              v
         POST /api/wallet/coinos/connect
              |
              v
         Connected state:
         - "Coinos Wallet" label
         - Balance display (sats)
         - Refresh / Disconnect buttons
```

### Flow 3: Paying a Zap with Coinos Wallet

The ZapModal payment chain attempts wallets in priority order:

```
User clicks Zap
       |
       v
1. Resolve Lightning address (lud16)
2. Create NIP-57 zap request (kind:9734)
3. Request BOLT-11 invoice from LNURL callback
       |
       v
4. Payment attempt:
   +--- Coinos or NWC connected?
   |    YES --> payInvoice(bolt11) via useWallet hook
   |            |
   |            +--- walletType === 'coinos'?
   |            |    YES --> POST /api/wallet/coinos/pay
   |            |    NO  --> NWC kind:23194 via nwcClient
   |            |
   |            +--- Success? --> next recipient / done
   |            +--- Failure? --> fall through
   |
   +--- Try WebLN (Alby extension)
   |    Success? --> done
   |
   +--- Show QR code for manual payment
```

---

## useWallet Hook API

The `useWallet` hook provides a unified interface for both wallet types:

```javascript
const {
    connected,       // boolean — any wallet connected
    walletType,      // 'none' | 'nwc' | 'coinos'
    balance,         // number | null — millisatoshis (unified)
    loading,         // boolean
    error,           // string | null

    // NWC operations
    connect(nwcUri),       // Connect via NWC URI (backwards-compatible alias)
    connectNwc(nwcUri),    // Explicit NWC connect

    // Coinos operations
    connectCoinos(username, password),  // Connect existing Coinos account
    createCoinos(username),             // Create new Coinos account

    // Shared operations
    disconnect(),          // Disconnect either wallet type
    payInvoice(bolt11),    // Pay invoice via connected wallet
    refreshBalance(),      // Refresh balance from connected wallet
} = useWallet();
```

### Wallet Detection Priority

On mount, `useWallet` checks for wallets in this order:

1. **Coinos** — checks `user.profile.coinosUsername` from AuthContext (server-side)
2. **NWC** — checks localStorage for a saved NWC URI (client-side)

If both exist, Coinos takes priority since it was explicitly connected via the server.

---

## Security Properties

### Protected Against

| Threat | Mitigation |
|---|---|
| Coinos token leaked to client | Token stripped from `/auth/me` response; all operations proxied server-side |
| Token at rest in database | AES-256-GCM encryption with server-derived key |
| Username enumeration on Coinos | Create endpoint only accessible to authenticated BIES users |
| Unauthorized payments | All wallet endpoints require BIES JWT authentication |

### Limitations

| Limitation | Notes |
|---|---|
| Custodial model | Users trust Coinos with their funds — not suitable for large balances |
| Single Coinos instance | Default points to `coinos.io`; change `COINOS_API_URL` for self-hosted |
| No PIN enforcement | Coinos API may require a PIN for payments on some accounts — currently not handled |
| Token refresh | Coinos JWTs may expire; no automatic refresh mechanism yet |
| No withdrawal to external wallet | Users must use Coinos directly for on-chain withdrawals |

---

## Relationship to Existing Wallet Systems

| System | Type | Storage | Use Case |
|---|---|---|---|
| **NWC** (NIP-47) | Self-custodial | localStorage (client-side) | Power users with Alby, Mutiny, etc. |
| **WebLN** | Self-custodial | Browser extension | Users with Alby extension |
| **Coinos** | Custodial | Encrypted on server | New users, quick onboarding |
| **QR fallback** | Manual | N/A | Last resort — scan with any wallet |

All four methods coexist. The user chooses their preferred wallet type, and the ZapModal falls through the chain automatically.
