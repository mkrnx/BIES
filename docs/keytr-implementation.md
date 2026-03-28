# BIES Keytr Implementation

## What is keytr?

`@sovit.xyz/keytr` is a NIP-K1 library for passkey-encrypted Nostr private keys. It replaces BIES's original custom `passkeyService.js` (464 lines) with a standardized approach:

- **PRF + HKDF-SHA256 + AES-256-GCM** encryption of the nsec
- Encrypted keys stored as **kind:30079 events** on public Nostr relays
- Cross-device recovery via WebAuthn discoverable credentials
- Gateway-based registration (keytr.org primary, nostkey.org backup)

Current version: `@sovit.xyz/keytr@0.3.1`

---

## File Map

| File | Role |
|---|---|
| `src/services/keytrService.js` | Adapter layer — wraps keytr library for BIES-specific flows |
| `src/services/authService.js` | `loginWithPasskey()` — dynamic imports keytrService, chains to `loginWithNsec()` |
| `src/services/nostrSigner.js` | Session restore — `_tryReacquire()` re-decrypts nsec via passkey on page refresh |
| `src/pages/Login.jsx` | UI — passkey button always visible when `PASSKEY_ENABLED = true` |
| `src/pages/Settings.jsx` | Passkey management — save, add backup gateway, remove |
| `src/config/featureFlags.js` | `PASSKEY_ENABLED` flag (currently `true`) |
| `vite.config.js` | `resolve.dedupe: ['@scure/base']` — prevents dual-bundle crash |

---

## Login Flow

`loginWithPasskey()` in keytrService.js has three tiers:

### 1. Fast Path (stored credential index)

When `bies_keytr_credentials` exists in localStorage with a pubkey:

```
stored credential pubkey
  → fetchKeytrEvents(pubkey, relays)     // targeted relay query
  → loginWithKeytr(events)               // WebAuthn prompt + decrypt
  → encodeNsec(nsecBytes)               // return bech32 nsec
```

One WebAuthn prompt. Fastest path (~2-5s).

### 2. Cached User Path (no credential index, but prior login)

When no keytr credential is indexed but `bies_user` exists in localStorage from a previous login (any method):

```
localStorage('bies_user').nostrPubkey    // hex pubkey from cached BIES user
  → fetchKeytrEvents(nostrPubkey, relays) // targeted relay query
  → loginWithKeytr(events)                // WebAuthn prompt + decrypt
  → index credential locally              // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One WebAuthn prompt. Same speed as fast path. Falls through to discoverable if cached user has no pubkey or no events found.

### 3. Discoverable Path (no stored data at all)

When neither credential index nor cached user pubkey is available:

```
fetchKeytrEvents(relays)                 // broad query — all kind:30079 events
  → loginWithKeytr(allEvents)            // browser shows available passkeys
  → recover pubkey from credential       // WebAuthn prompt
  → index credential locally             // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One WebAuthn prompt, but broader relay fetch. Slowest path.

---

## Registration Flow

### Primary Gateway (keytr.org)

Called via `keytrService.saveWithPasskey(nsec, pubkey)`:

1. Decode nsec to bytes
2. `registerPasskey()` — WebAuthn credential creation with PRF on keytr.org rpId
3. `encryptNsec()` — AES-256-GCM encryption using PRF output
4. `buildKeytrEvent()` — construct kind:30079 Nostr event template
5. Sign event via `nostrSigner.signEvent()`
6. `publishKeytrEvent()` — publish to PUBLIC_RELAYS
7. Index credential in localStorage

### Backup Gateway (nostkey.org)

Called via `keytrService.addBackupGateway(nsec, pubkey)` — same flow but uses `KEYTR_GATEWAYS[1]` as rpId. Separate WebAuthn prompt.

---

## Session Restoration

When the page refreshes, `nostrSigner._tryReacquire()`:

1. Checks `storedMethod === 'nsec'` (passkey/nsec/seed all store as 'nsec')
2. Checks `PASSKEY_ENABLED === true`
3. Checks `keytrService.hasCredential()` — any credential in index
4. If all pass: calls `keytrService.loginWithPasskey()` → WebAuthn prompt
5. Sets nsec in memory via `nostrSigner.setNsec()`

This runs lazily — only triggered when an operation actually needs the signing key (getPubkey, signEvent, encrypt, decrypt).

---

## Dependency Note: @scure/base Deduplication

Both `nostr-tools@2.23.0` and `@sovit.xyz/keytr@0.3.1` depend on `@scure/base@^2.0.0`. The Vite dedupe ensures a single copy is bundled — without it, two instances can cause "e is not iterable" at runtime when bech32 codec objects cross module boundaries.

Fix in `vite.config.js`:
```js
resolve: {
    dedupe: ['@scure/base'],
}
```

---

## Security Properties

- **nsec never persisted** — only held in memory during active session
- **nsecBytes zeroed** after use (`.fill(0)` in `finally` blocks)
- **PRF output zeroed** after encryption
- **No server involvement** — backend only sees signed Nostr events, never keys
- **Gateway rpId separation** — keytr.org and nostkey.org credentials are distinct WebAuthn origins
- **Extension interference detection** — `isLikelyExtensionInterference()` catches password manager conflicts with cross-origin rpId

---

## Version History

| Version | Changes |
|---|---|
| 0.1.1 | Initial integration, replaced custom passkeyService |
| 0.1.2 | Bug fixes |
| 0.1.3 | YubiKey PRF registration support |
| 0.2.0 | Discoverable credential flow, always-visible passkey button |
| 0.2.1 | Parallel relay operations (~25s → ~5s login) |
| 0.3.0 | Upgraded to noble/scure v2, internal parallel relay via Promise.allSettled |
| 0.3.1 | Simplified _registerOnGateway using keytr's high-level addBackupGateway |
