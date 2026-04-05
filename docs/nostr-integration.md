# Nostr Integration

BIES uses the Nostr protocol as its identity, social, and payment layer. This document covers how each NIP is implemented, the relay strategy, and how Nostr events flow through the system.

## Core Principle

The BIES backend is a **coordination layer**, not a gatekeeper. It stores structured data (projects, investments, events) in a database and issues JWTs for API access, but identity and social interactions are Nostr-native:

- **Identity** = Nostr keypair (not email/password)
- **Authentication** = Signed Nostr events (not passwords)
- **Social graph** = Follow lists on relays (mirrored to DB for queries)
- **Messaging** = NIP-04 encrypted events (DB stores metadata, not plaintext)
- **Payments** = NIP-57 Lightning zaps (receipts on relays)

The backend verifies signatures and indexes data — it never holds private keys or decrypts messages.

## NIP Implementation Reference

### NIP-01: Events and Relay Protocol

**What:** The base Nostr protocol — event format, relay communication, subscriptions.

**How BIES uses it:**

The social feed is built entirely on NIP-01. The frontend maintains WebSocket connections to both the private BIES relay and public relays, subscribing to events by pubkey, kind, and time range.

**Frontend (`src/services/nostrService.js`):**
- Manages a pool of relay connections (private + public)
- Subscribes to kind:1 (text notes) events for the feed
- Maintains a profile cache (kind:0 metadata events) with 1-hour TTL
- Handles reconnection and subscription lifecycle

**Event creation flow:**
1. User composes a note
2. Frontend builds a kind:1 event with content, tags, and created_at
3. `nostrSigner.signEvent()` signs it with the user's private key
4. Event published to selected relays (private only, or private + public)

**Backend (`server/src/services/nostr.service.ts`):**
- Server-side Nostr client for publishing system events (welcome posts, project updates)
- Reads public relay events for profile data enrichment

### NIP-04: Encrypted Direct Messages

**What:** End-to-end encrypted messages using shared ECDH secrets.

**How BIES uses it:**

DMs are NIP-04 encrypted events published to the BIES relay. The backend stores message metadata (sender, recipient, timestamp, read status) but never the plaintext — encryption and decryption happen entirely in the browser.

**Flow:**
1. Sender composes a message
2. `nostrSigner.nip04.encrypt(recipientPubkey, plaintext)` encrypts the content
3. Kind:4 event published to BIES relay
4. Backend WebSocket notifies the recipient in real-time
5. Recipient's client decrypts with `nostrSigner.nip04.decrypt(senderPubkey, ciphertext)`

**Read receipts:** Tracked server-side via the REST API (`POST /api/messages/:id/read`). The receipt is a DB record, not a Nostr event.

### NIP-05: DNS-Based Identity Verification

**What:** Maps human-readable names (`alice@example.com`) to Nostr pubkeys via DNS + HTTP.

**How BIES uses it:**

Every BIES user can claim a NIP-05 identifier: `username@bies.sovit.xyz`. The backend serves the `.well-known/nostr.json` endpoint that maps usernames to hex pubkeys.

**Endpoints:**
- `GET /.well-known/nostr.json?name=alice` — Returns `{ names: { alice: "<hex_pubkey>" }, relays: { ... } }`
- `POST /api/nip05` — Claim or update NIP-05 identifier (authenticated)

**Verification:** Other Nostr clients can verify a BIES user's identity by querying `bies.sovit.xyz/.well-known/nostr.json`.

### NIP-06: Key Generation from Seed Phrases

**What:** Derive Nostr keys from BIP-39 mnemonic seed phrases.

**How BIES uses it:**

During signup, BIES generates a BIP-39 seed phrase (12 or 24 words) and derives the Nostr keypair from it. The seed phrase is shown once for the user to write down — it's the ultimate recovery method.

**Flow:**
1. `generateSeedPhrase()` creates a random BIP-39 mnemonic
2. Seed → master key via BIP-32 derivation
3. Master key → Nostr secret key (secp256k1)
4. Secret key → public key
5. User writes down the seed phrase
6. The keypair is used for all subsequent operations

### NIP-19: Bech32 Key Encoding

**What:** Human-readable encoding for Nostr keys and identifiers.

**How BIES uses it:**

All user-facing key display and input uses NIP-19 encoding:
- `npub1...` for public keys (profile display, sharing)
- `nsec1...` for private keys (login, backup)
- `note1...` for event IDs (note links)

Internal operations use hex encoding; NIP-19 is the presentation layer.

### NIP-42: Relay Authentication

**What:** Challenge-response authentication between clients and relays.

**How BIES uses it:**

The BIES private relay requires NIP-42 auth. The auth proxy sits between the client and strfry, handling the challenge flow:

```
Client ──WebSocket──► Auth Proxy ──WebSocket──► strfry
                         │
                    1. Send AUTH challenge
                    2. Client signs kind:22242 event
                    3. Proxy verifies signature
                    4. Check pubkey against whitelist
                    5. If valid, proxy connection through
```

**Why NIP-42 matters for communities:**
- Only members can read the community feed
- Only members can write to the community relay
- The whitelist is managed by the backend (add on signup, remove on ban)
- Public Nostr clients can't see private community content

### NIP-46: Remote Signing (Browser Extensions)

**What:** Delegate signing to an external application (browser extension).

**How BIES uses it:**

Users with Nostr browser extensions (Alby, nos2x, Nostore) can log in without entering their private key. The extension handles all signing operations.

**Detection:** On login page load, BIES checks for `window.nostr`. If present, the "Extension" login option is shown.

**Signing flow:**
1. `nostrSigner` is set to extension mode
2. All `signEvent()` calls delegate to `window.nostr.signEvent(event)`
3. All `nip04.encrypt/decrypt()` calls delegate to `window.nostr.nip04.*`
4. The extension prompts the user for approval on each operation

### NIP-47: Nostr Wallet Connect

**What:** Control a Lightning wallet via Nostr events.

**How BIES uses it:**

NWC allows users to connect their self-custodial Lightning wallet (Alby Hub, Mutiny, etc.) for zap payments without exposing wallet credentials to BIES.

**Connection:**
1. User pastes an NWC URI (`nostr+walletconnect://...`) in Settings
2. URI stored in localStorage (client-side only)
3. `nwcService.js` parses the URI and establishes a relay connection to the wallet's NWC relay

**Payment flow:**
1. ZapModal creates a BOLT-11 invoice (via LNURL)
2. `nwcService.payInvoice(bolt11)` creates a kind:23194 request event
3. Event encrypted and sent to the NWC relay
4. Wallet processes payment, returns kind:23195 response
5. BIES reads the response and confirms payment

### NIP-49: Encrypted Keyfiles

**What:** Encrypt Nostr private keys with a password using scrypt + XChaCha20-Poly1305.

**How BIES uses it:**

During signup, the user's private key is encrypted into a `.nostrkey` file that they download as a backup. This file can be used to log in on any device.

See [nostrkey-download.md](nostrkey-download.md) for full technical details.

### NIP-52: Calendar Events

**What:** Represent calendar events as Nostr events (kind:31923).

**How BIES uses it:**

BIES events (meetups, hackathons, demo days) are published as kind:31923 events to the community relay. This allows other Nostr calendar clients to discover and display BIES events.

**Event structure:**
- `d` tag: unique event identifier
- `name` tag: event title
- `start` / `end` tags: ISO timestamps
- `location` tag: physical address or online URL
- `p` tags: organizer pubkeys

### NIP-57: Lightning Zaps

**What:** Lightning payments with verifiable receipts published to Nostr relays.

**How BIES uses it:**

Zaps are the native payment mechanism in BIES. Users can zap profiles, notes, and projects.

**Full zap flow:**

1. **Resolve Lightning address:** Parse the recipient's `lud16` field (e.g., `alice@coinos.io`), fetch the LNURL-pay endpoint, get payment parameters
2. **Create zap request:** Build a kind:9734 event with amount, recipient pubkey, relay hints, and optional comment
3. **Request invoice:** Send the zap request to the LNURL callback, receive a BOLT-11 invoice
4. **Pay invoice:** Via Coinos (server-proxied), NWC (relay-based), WebLN (extension), or QR code (manual)
5. **Zap receipt:** The recipient's Lightning provider publishes a kind:9735 receipt event to relays, proving the payment happened

**Backend tracking:** `ZapReceipt` model stores zap metadata (sender, recipient, amount, event reference) for display in notification feeds and profile analytics.

## Relay Strategy

BIES uses a dual-relay approach:

### Private Relay (strfry)

- **Purpose:** Community content — feed posts, DMs, member interactions
- **Access:** NIP-42 authenticated, pubkey whitelist
- **Write policy:** Only whitelisted pubkeys can publish
- **Content:** kind:1 (notes), kind:4 (DMs), kind:0 (profiles), community-specific events

### Public Relays

Connected to several public relays for broader Nostr network interaction:

- `wss://relay.damus.io`
- `wss://relay.primal.net`
- `wss://nos.lol`
- `wss://purplepag.es`
- `wss://relay.nostr.band`

**Purpose:**
- Read public profiles (kind:0) for non-BIES Nostr users
- Publish events that should be discoverable globally (project listings, public posts)
- Fetch trending/popular content for the "Explore" feed tab
- Store and retrieve passkey-encrypted keys (kind:31777 via keytr)

### Feed Toggle

The compose box has a relay toggle:
- **Private:** Publish to BIES relay only — content stays within the community
- **Public:** Publish to BIES relay + public relays — content is visible to the wider Nostr network

## Event Kinds Used

| Kind | NIP | Purpose in BIES |
|------|-----|----------------|
| 0 | NIP-01 | User profile metadata |
| 1 | NIP-01 | Text notes (feed posts) |
| 4 | NIP-04 | Encrypted direct messages |
| 7 | NIP-25 | Reactions (likes) |
| 9734 | NIP-57 | Zap requests |
| 9735 | NIP-57 | Zap receipts |
| 22242 | NIP-42 | Relay authentication |
| 23194 | NIP-47 | NWC payment requests |
| 23195 | NIP-47 | NWC payment responses |
| 27235 | NIP-98 | HTTP auth (challenge-response login) |
| 31777 | NIP-K1 | Passkey-encrypted key storage (keytr) |
| 31923 | NIP-52 | Calendar events |

## Signing Abstraction

All Nostr signing goes through `nostrSigner.js`, which provides a unified interface regardless of how the user authenticated:

```
nostrSigner.signEvent(event)
nostrSigner.getPublicKey()
nostrSigner.nip04.encrypt(pubkey, plaintext)
nostrSigner.nip04.decrypt(pubkey, ciphertext)
nostrSigner.nip44.encrypt(pubkey, plaintext)
nostrSigner.nip44.decrypt(pubkey, ciphertext)
```

**Resolution order:**
1. In-memory private key (`_sk`) — fastest, used when key is available
2. Extension mode (`window.nostr`) — delegates to browser extension
3. Passkey re-acquire — triggers WebAuthn prompt to decrypt key from passkey
4. Last-resort extension probe — tries `window.nostr` even without explicit extension mode

The key insight: after a page refresh, the in-memory key is gone. The signer **lazily** re-acquires it on the first signing operation, not on page load. This avoids unnecessary biometric prompts.

## Profile Caching

`nostrService.js` maintains an in-memory profile cache:

- **Cache key:** hex pubkey
- **Cache value:** kind:0 event content (name, about, picture, nip05, lud16, etc.)
- **TTL:** 1 hour
- **Source:** BIES relay first, then public relays as fallback
- **Batch fetching:** When rendering a feed, profiles for all visible pubkeys are fetched in a single subscription

The backend also caches profile data in the `Profile` model, synced from Nostr on login and profile updates.

## Nostrbook Generalization

The Nostr integration in BIES is designed to be generalizable. The community-specific parts (builder/investor roles, project tracking) are in the backend controllers and database models. The Nostr layer is generic:

| Nostr Layer (Reusable) | BIES Layer (Community-Specific) |
|------------------------|--------------------------------|
| Feed (kind:1 events) | Project updates, announcements |
| DMs (kind:4 encrypted) | Investment discussions |
| Profiles (kind:0) | Builder/investor role fields |
| Zaps (kind:9734/9735) | Project funding |
| Events (kind:31923) | Demo days, hackathons |
| Private relay (NIP-42) | Community membership boundary |
| Identity (NIP-05) | `username@community.tld` |
| Key management (passkeys) | Same for any community |

A future nostrbook framework would extract the left column as a reusable foundation, with the right column as pluggable community modules.
