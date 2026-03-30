# BIES Keytr Implementation

## What is keytr?

`@sovit.xyz/keytr` is a NIP-K1 library for passkey-encrypted Nostr private keys. It replaces BIES's original custom `passkeyService.js` (464 lines) with a standardized approach:

- **Two encryption modes:**
  - **PRF mode** — PRF + HKDF-SHA256 + AES-256-GCM (hardware-bound, requires PRF-capable authenticator)
  - **KiH mode** (Key-in-Handle) — random 256-bit key in passkey `user.id` + AES-256-GCM (works with all authenticators including password managers)
- Encrypted keys stored as **kind:31777 events** on public Nostr relays
- Cross-device recovery via WebAuthn discoverable credentials
- Gateway-based registration (keytr.org primary, nostkey.org backup)

Current version: `@sovit.xyz/keytr@0.5.0`

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
  → parseKeytrEvent() to filter PRF events
  → loginWithKeytr(prfEvents)            // WebAuthn prompt + decrypt
  → encodeNsec(nsecBytes)               // return bech32 nsec
```

One WebAuthn prompt. Fastest path (~2-5s). Falls through to discoverable if no PRF events exist or PRF login fails.

### 2. Cached User Path (no credential index, but prior login)

When no keytr credential is indexed but `bies_user` exists in localStorage from a previous login (any method):

```
localStorage('bies_user').nostrPubkey    // hex pubkey from cached BIES user
  → fetchKeytrEvents(nostrPubkey, relays) // targeted relay query
  → parseKeytrEvent() to filter PRF events
  → loginWithKeytr(prfEvents)             // WebAuthn prompt + decrypt
  → index credential locally              // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One WebAuthn prompt. Same speed as fast path. Falls through to discoverable if cached user has no pubkey, no events found, or no PRF events.

### 3. Discoverable Path (no stored data or KiH credentials)

When neither credential index nor cached user pubkey is available, or when PRF login fails:

```
discover(relays)                         // unified discoverable login
  → auto-detects PRF vs KiH from userHandle
  → PRF: step-2 targeted assertion for PRF output
  → KiH: extract key from userHandle, query relay by #d tag
  → decrypt nsec
  → index credential locally with mode    // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One biometric prompt. Handles both PRF and KiH credentials transparently.

---

## Registration Flow

### Primary Gateway (keytr.org)

Called via `keytrService.saveWithPasskey(nsec, pubkey)`:

1. Decode nsec to bytes
2. **Try PRF:** `registerPasskey()` — WebAuthn credential creation with PRF on keytr.org rpId
3. `encryptNsec()` — AES-256-GCM encryption using PRF output
4. **Catch `PrfNotSupportedError` → KiH fallback:**
   - `registerKihPasskey()` — credential creation without PRF, random key in `user.id`
   - `encryptNsec()` with `aadVersion: KEYTR_KIH_VERSION` (prevents cross-mode decryption)
5. `buildKeytrEvent()` — construct kind:31777 event template (with `v=3` tag for KiH)
6. Sign event via `nostrSigner.signEvent()`
7. `publishKeytrEvent()` — publish to PUBLIC_RELAYS
8. Index credential in localStorage with `mode` field

Returns `{ mode: 'prf' | 'kih' }` so callers can display mode-appropriate feedback.

### Backup Gateway (nostkey.org)

Called via `keytrService.addBackupGateway(nsec, pubkey)` — same PRF/KiH fallback flow but uses `KEYTR_GATEWAYS[1]` as rpId. Separate WebAuthn prompt.

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

Both `nostr-tools@2.23.0` and `@sovit.xyz/keytr` depend on `@scure/base@^2.0.0`. The Vite dedupe ensures a single copy is bundled — without it, two instances can cause "e is not iterable" at runtime when bech32 codec objects cross module boundaries.

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
- **PRF output / KiH handleKey zeroed** after encryption
- **No server involvement** — backend only sees signed Nostr events, never keys
- **Gateway rpId separation** — keytr.org and nostkey.org credentials are distinct WebAuthn origins
- **Extension interference detection** — `isLikelyExtensionInterference()` catches password manager conflicts with cross-origin rpId
- **AAD version separation** — PRF (v=1) and KiH (v=3) events use different AAD bytes, preventing cross-mode decryption attacks
- **KiH trade-off** — encryption key lives in passkey `user.id` (not hardware-bound like PRF), but still protected by biometric/PIN authentication. Users with PRF-capable authenticators automatically get the stronger PRF mode.

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
| 0.4.0 | Event kind 30079→31777, loginWithKeytr returns npub instead of pubkey, derive hex pubkey via nsecToHexPubkey |
| 0.5.0 | KiH mode support (PRF-first with automatic fallback), unified discover() for login, expanded authenticator compatibility (password managers, all browsers) |
