# BIES Keytr Implementation

## What is keytr?

`@sovit.xyz/keytr` is a NIP-K1 library for passkey-encrypted Nostr private keys. It replaces BIES's original custom `passkeyService.js` (464 lines) with a standardized approach:

- **PRF mode** (the only registration mode since 0.8.0) — the encryption key is derived by the authenticator via the WebAuthn PRF extension and never exposed to page JavaScript; the raw Nostr pubkey is stored as `user.id` for discoverable login. AES-256-GCM, event tag `v=1`.
- **KiH mode** (legacy, decrypt-only) — random 256-bit key in passkey `user.id` (`v=3`). Registration was removed in 0.8.0 because the key travels through the JS-readable `userHandle` (interceptable via XSS or a malicious extension). Existing KiH credentials still log in and are auto-offered migration — see "KiH → PRF migration" below.
- Encrypted keys stored as **kind:31777 events** on public Nostr relays
- Cross-device recovery via WebAuthn discoverable credentials
- Gateway-based registration (app.buildinelsalvador.com primary; keytr.org, nostkey.org backups). On `localhost` the sole rpId is `localhost` so passkeys work in dev/E2E (WebAuthn rejects cross-origin rpIds from a localhost origin).

**PRF requirement:** authenticators without PRF (password-manager extensions like 1Password/Bitwarden, Firefox on Android, some older security keys) cannot *register* new passkeys (`PrfNotSupportedError`); login with existing credentials — including legacy KiH — needs only WebAuthn. UI gates registration surfaces on `keytrService.checkPrfSupport()` / `canRegisterPasskey()`, which are advisory (optimistic without `getClientCapabilities()`); the registration-time error is authoritative.

Current version: `@sovit.xyz/keytr@0.8.0` (pinned exact)

---

## File Map

| File | Role |
|---|---|
| `src/services/keytrService.js` | Adapter layer — wraps keytr library for BIES-specific flows |
| `src/services/authService.js` | `loginWithPasskey()` — dynamic imports keytrService, chains to `loginWithNsec()` |
| `src/services/nostrSigner.js` | Session restore — `_tryReacquire()` re-decrypts nsec via passkey on page refresh |
| `src/pages/Login.jsx` | UI — passkey button always visible when `PASSKEY_ENABLED = true` |
| `src/pages/Settings.jsx` | Passkey management — save, add backup gateway, remove |
| `src/components/PasskeySavePrompt.jsx` | Post-login modal offering to save a passkey |
| `src/components/PasskeyMigratePrompt.jsx` | Post-login modal offering KiH → PRF migration |
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
  → loginWithKeytr(events)              // WebAuthn prompt + decrypt
  → encodeNsec(nsecBytes)               // return bech32 nsec
```

One WebAuthn prompt. Fastest path (~2-5s). Falls through to discoverable if login fails.

### 2. Cached User Path (no credential index, but prior login)

When no keytr credential is indexed but `bies_user` exists in localStorage from a previous login (any method):

```
localStorage('bies_user').nostrPubkey    // hex pubkey from cached BIES user
  → fetchKeytrEvents(nostrPubkey, relays) // targeted relay query
  → loginWithKeytr(events)               // WebAuthn prompt + decrypt
  → index credential locally              // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One WebAuthn prompt. Same speed as fast path. Falls through to discoverable if cached user has no pubkey or no events found.

### 3. Discoverable Path (no stored data)

When neither credential index nor cached user pubkey is available, or when login fails:

```
discover(relays)                         // unified discoverable login
  → extract key from userHandle, query relay by #d tag
  → decrypt nsec
  → index credential locally              // upgrade to fast path next time
  → encodeNsec(nsecBytes)
```

One biometric prompt. Handles credentials transparently.

---

## Registration Flow

### Primary Gateway (keytr.org)

Called via `keytrService.saveWithPasskey(nsec, pubkey)`:

1. Decode nsec to bytes
2. `registerPasskey()` — WebAuthn credential creation on gateway rpId with the PRF extension; `pubkey` (hex) is required since 0.8.0 and stored as `user.id`. Returns `{ credential, keyMaterial }` (keyMaterial = PRF output). Handles the YubiKey create→get fallback internally and cleans up orphaned credentials via the Signal API before throwing `PrfNotSupportedError`.
3. `encryptNsec()` — AES-256-GCM encryption using keyMaterial with `version: KEYTR_VERSION` (`1`, PRF)
4. `buildKeytrEvent()` — construct kind:31777 event template (with `v=1` tag)
5. Sign event via `nostrSigner.signEvent()`
6. `publishKeytrEvent()` — publish to PUBLIC_RELAYS
7. Index credential in localStorage

`loginWithKeytr(events)` dispatches per event by its `v` tag: `v=1` authenticates via PRF, `v=3` via the legacy KiH path. `discover()` handles both transparently.

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

## KiH → PRF Migration

keytr 0.8.0 deprecated KiH decryption (removal planned upstream), so BIES auto-offers migration to users still holding `v=3` credentials.

**Detection:** after every successful passkey login, `keytrService` parses the user's kind:31777 events and records any `v=3` events (`extractKihInfo()`, exposed via `getLastLoginKihInfo()`). The discover path re-fetches events by the recovered pubkey (best-effort, never blocks login).

**Prompt:** `AuthContext.maybePromptKihMigration()` shows `PasskeyMigratePrompt` after an *explicit* passkey login (never the silent `_tryReacquire` path). Gated on: `PASSKEY_ENABLED`, detected KiH events, session dismissal (`bies_kih_migration_prompt_dismissed`), a 7-day snooze (`bies_kih_migration_snooze_until`), and PRF support (unsupported devices stay silent — KiH login keeps working).

**Flow:** `keytrService.migrateToPrf({ rpId, expectedPubkey })` wraps keytr's `migrateFromKih()`. Per gateway (one rpId per call; the prompt loops multi-gateway users sequentially):

1. Discoverable login with the old KiH passkey (biometric prompt #1)
2. Verify the decrypted pubkey matches the old event author
3. Register a new PRF passkey on the same rpId (biometric prompt #2)
4. Publish the new `v=1` event — **must succeed before anything is deleted**
5. Publish a NIP-09 `kind:5` deletion for the old `v=3` event (soft-fail: `deletionPublished:false`)
6. Signal the old credential as unknown (removes it from the browser's picker)

**Bookkeeping:** migrated dTags are recorded in localStorage `bies_kih_migrated` (`{[pubkey]: [dTag,...]}`) so a failed `kind:5` publish can't re-trigger the prompt for an event whose credential was already signal-removed. Cancelling either ceremony publishes nothing; the user can retry any time.

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
- **keyMaterial zeroed** after encryption
- **No server involvement** — backend only sees signed Nostr events, never keys
- **Gateway rpId separation** — keytr.org and nostkey.org credentials are distinct WebAuthn origins
- **Extension interference detection** — `isLikelyExtensionInterference()` catches password manager conflicts with cross-origin rpId
- **PRF key never in JS-readable fields** — the encryption key is authenticator-derived (unlike legacy KiH, whose key in `user.id`/`userHandle` was interceptable by page-level script; that's why KiH registration was removed in 0.8.0)
- **WebAuthn natives hardening** — keytr routes all WebAuthn calls through references captured at import time and zeroes key buffers with prototype-pollution-resistant helpers

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
| 0.7.1 | Removed PRF mode (KiH-only), dropped `registerKihPasskey`/`PrfNotSupportedError`/`checkPrfSupport`, `registerPasskey` now returns `keyMaterial`, `KEYTR_KIH_VERSION` → `KEYTR_VERSION`, `nsecToHexPubkey` → `nsecToPublicKey` |
| 0.8.0 | PRF-only registration (KiH register throws `KihRegistrationDisabledError`; decrypt still works, deprecated). `KEYTR_VERSION` → `1` (PRF), `KEYTR_KIH_VERSION` = `3`. `RegisterOptions.pubkey` required. Added `migrateFromKih`, `buildKeytrDeletionEvent`, `checkPrfSupport`/`checkCapabilities`, Signal APIs, restored `PrfNotSupportedError`. BIES: KiH→PRF auto-migration prompt, PRF gating on registration UI, localhost rpId for dev/E2E. |
