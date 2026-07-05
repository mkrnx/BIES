# BIES Passkey Implementation — Technical Reference

## Overview

BIES uses a **custom WebAuthn PRF-based passkey system** to encrypt and manage Nostr private keys entirely client-side. This is **not** an implementation of NIP-79 (Nosskey) — it is a purpose-built system specific to BIES.

The core idea: a user's Nostr `nsec` (private key) is encrypted with an AES-256-GCM key derived from the authenticator's PRF (Pseudo-Random Function) output. The encrypted nsec can be stored on the authenticator itself (via largeBlob) and/or in the browser's localStorage. The plaintext nsec is **never persisted** — it only exists in memory during an active session.

No server interaction is required for any passkey operation. The backend remains agnostic to the key management method — it only verifies signed Nostr events via a standard challenge-response protocol.

---

## Architecture

### File Map

| File | Responsibility |
|---|---|
| `src/services/passkeyService.js` | WebAuthn credential creation, PRF-based encryption/decryption, largeBlob storage, device key fallback |
| `src/services/nostrSigner.js` | Unified signing abstraction — holds nsec in memory, delegates to extension or re-acquires from passkey on demand |
| `src/services/keyfileService.js` | NIP-49 encrypted `.nostrkey` file creation, parsing, and decryption (separate from passkey, but complementary) |
| `src/services/authService.js` | Auth flow orchestration — challenge-response against backend, session management |
| `src/pages/Signup.jsx` | 4-step signup flow — key generation, keyfile encryption, passkey save (optional), profile setup |
| `src/pages/Login.jsx` | Multi-method login — passkey, extension, keyfile, nsec, seed phrase |

### Trust Model

```
+-----------------------+
|   Authenticator HW    |
|  (YubiKey, Touch ID,  |
|   Windows Hello, etc) |
|                       |
|  PRF output (secret)  |
|  largeBlob (optional) |
+-----------------------+
         |
         | WebAuthn API
         v
+------------------------+
|   Browser (client)     |
|                        |
|  passkeyService.js     |
|  - AES-256-GCM encrypt |
|  - HKDF key derivation |
|  - localStorage backup |
|                        |
|  nostrSigner.js        |
|  - nsec in memory only |
|  - lazy re-acquire     |
+------------------------+
         |
         | Signed Nostr events (kind:27235)
         v
+------------------------+
|   BIES Backend         |
|                        |
|  - Challenge-response  |
|  - JWT issuance        |
|  - No passkey logic    |
+------------------------+
```

---

## Cryptographic Design

### Key Derivation (PRF Path)

When the authenticator supports the PRF extension, the encryption key is derived as:

```
PRF_INPUT = UTF-8("bies-nostr-key-encryption")
                    |
                    v
         Authenticator PRF
                    |
                    v
           prfOutput (32 bytes)
                    |
     +--------------+--------------+
     |                             |
     v                             v
  HKDF-SHA256                   salt (16 random bytes)
  info = "bies-nsec-v1"
     |
     v
  AES-256-GCM key
     |
     +--- encrypt(nsec, random 12-byte IV) ---> ciphertext
```

The PRF input is a fixed string. The salt is randomly generated per credential and stored alongside the ciphertext. The HKDF info string `bies-nsec-v1` acts as a domain separator.

### Key Derivation (Device Fallback Path)

When PRF is unavailable (e.g., Bitwarden, some password managers):

```
crypto.subtle.generateKey(AES-GCM, 256)
     |
     v
  Random AES key --> exported & stored in localStorage
     |                ("bies_passkey_device_key")
     v
  encrypt(nsec, random 12-byte IV) ---> ciphertext
```

The passkey still gates access — the user must authenticate (biometric/PIN) to use the credential — but the encryption key is device-bound rather than authenticator-derived.

### Encryption Parameters

| Parameter | Value |
|---|---|
| Cipher | AES-256-GCM |
| Key length | 256 bits |
| IV | 12 bytes, random per encryption |
| Salt | 16 bytes, random per credential |
| KDF | HKDF-SHA256 |
| KDF info | `bies-nsec-v1` |
| PRF input | `bies-nostr-key-encryption` |
| Authentication tag | 128 bits (GCM default) |

---

## Storage Architecture

### Primary: Authenticator largeBlob

When supported, the encrypted nsec is stored **on the authenticator hardware** in a binary envelope:

```
Byte offset   Field         Size        Description
───────────   ─────         ────        ───────────
0             version       1 byte      0x01
1             method        1 byte      0x01 = PRF, 0x02 = device
2-17          salt          16 bytes    HKDF salt (zeroed if method=device)
18-29         iv            12 bytes    AES-GCM IV
30+           ciphertext    variable    Encrypted nsec (bech32)
```

This enables **cross-device portability** — if the authenticator supports largeBlob (e.g., hardware security keys), the encrypted nsec travels with the authenticator.

### Fallback: localStorage

Always stored regardless of largeBlob success. JSON structure under the key `bies_passkey_credentials`:

```json
[
  {
    "credentialId": "<base64>",
    "pubkey": "<hex>",
    "encryptedNsec": "<base64 ciphertext>",
    "iv": "<base64>",
    "salt": "<base64>",
    "encryptionMethod": "prf" | "device",
    "largeBlobSupported": true | false,
    "createdAt": "2026-03-16T..."
  }
]
```

### In-Memory: Session Runtime

The decrypted nsec is held as a `Uint8Array` in `nostrSigner._sk`. On logout, the bytes are zeroed (`_sk.fill(0)`) before the reference is released — defense-in-depth against memory inspection.

---

## Passkey Registration Flow

`passkeyService.saveWithPasskey(nsec, pubkey)` orchestrates credential creation and encryption.

### Step 1: Create WebAuthn Credential

```javascript
navigator.credentials.create({
  publicKey: {
    challenge: random(32),
    rp: { name: 'BIES', id: window.location.hostname },
    user: {
      id: encode(pubkey.slice(0, 32)),
      name: 'BIES Account',
      displayName: 'BIES Nostr Key',
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },    // ES256
      { type: 'public-key', alg: -257 },   // RS256
    ],
    authenticatorSelection: {
      residentKey: 'required',        // discoverable credential (passkey)
      userVerification: 'required',   // biometric or PIN
    },
    extensions: {
      prf: { eval: { first: PRF_INPUT } },    // request PRF support
      largeBlob: { support: 'preferred' },     // request blob storage
    }
  }
});
```

This triggers the native OS/browser passkey dialog (Touch ID, Windows Hello, security key tap, etc.).

### Step 2: Determine Encryption Method

After credential creation, the code checks the extension results:

1. **PRF available from `create()`** — Use PRF output directly to derive AES key. This is the ideal path.
2. **PRF not available from `create()` but available from `get()`** — Some authenticators only return PRF during assertion. A second WebAuthn prompt (`get()`) is issued to obtain the PRF output.
3. **PRF not available at all** — Fall back to a randomly generated device-bound AES key stored in localStorage.

### Step 3: Encrypt the nsec

Using whichever AES key was obtained:
- Generate a random 12-byte IV
- Encrypt the bech32 nsec string with AES-256-GCM
- Authenticated encryption ensures both confidentiality and integrity

### Step 4: Store the Encrypted nsec

If largeBlob is supported by the authenticator:
- Encode the ciphertext into the binary envelope format
- Write to the authenticator via a `get()` assertion with the `largeBlob.write` extension
- A second biometric prompt may appear for this write operation

Always:
- Store the encrypted credential metadata in localStorage as a fallback
- One credential per pubkey (existing entries for the same pubkey are replaced)

### Prompt Count

| Scenario | Biometric Prompts |
|---|---|
| PRF from create, no largeBlob | 1 |
| PRF from create, largeBlob write | 2 |
| PRF from get, no largeBlob | 2 |
| PRF from get, largeBlob write | 3 |
| Device key fallback, no largeBlob | 1 |
| Device key fallback, largeBlob write | 2 |

---

## Passkey Login Flow

`passkeyService.loginWithPasskey()` decrypts the stored nsec.

### Step 1: WebAuthn Assertion

```javascript
navigator.credentials.get({
  publicKey: {
    challenge: random(32),
    rpId: window.location.hostname,
    allowCredentials: [stored credential IDs],  // or empty for discoverable
    userVerification: 'required',
    extensions: {
      prf: { eval: { first: PRF_INPUT } },
      largeBlob: { read: true },   // if any credential supports it
    }
  }
});
```

### Step 2: Attempt largeBlob Decryption

If the assertion returns a `largeBlob.blob`:
1. Decode the binary envelope (version, method, salt, IV, ciphertext)
2. If `method = PRF`: derive AES key from PRF output + salt
3. If `method = device`: load device key from localStorage
4. Decrypt with AES-256-GCM
5. Return the plaintext nsec

If largeBlob decryption fails, fall through to localStorage.

### Step 3: Fallback to localStorage Decryption

1. Match the assertion's credential ID to a stored entry
2. If `encryptionMethod = 'device'`: load device key from localStorage
3. If `encryptionMethod = 'prf'`: derive AES key from PRF output + stored salt
4. Decrypt the stored ciphertext with the stored IV
5. Return the plaintext nsec

### Step 4: Backend Authentication

Once the nsec is decrypted, `authService.loginWithPasskey()` chains into `authService.loginWithNsec()`:
1. Decode nsec to get the secret key bytes
2. Derive the public key
3. Request a challenge from the backend (`POST /auth/nostr/challenge`)
4. Sign a kind:27235 Nostr event containing the challenge
5. Submit the signed event to the backend (`POST /auth/nostr/login`)
6. Backend verifies the signature and returns a JWT + user object

---

## Session Lifecycle

### Login

```
User authenticates (passkey / nsec / seed / extension / keyfile)
    |
    v
nsec decrypted or provided
    |
    v
nostrSigner.setNsec(nsec)       <-- nsec held in memory as Uint8Array
    |
    v
Challenge-response with backend  <-- signs kind:27235 event
    |
    v
JWT stored in localStorage       <-- "bies_token"
Login method stored               <-- "bies_login_method" = "nsec" or "extension"
```

### Page Refresh (Session Restore)

```
App mounts
    |
    v
authService.restoreSession()     <-- validates JWT with GET /auth/me
    |
    v
nostrSigner._sk is null          <-- memory was cleared on page unload
    |
    v
First operation needing signing
    |
    v
nostrSigner._tryReacquire()
    |
    +--> storedMethod === 'nsec'?
    |    passkeyService.hasCredential()?
    |        |
    |        v
    |    passkeyService.loginWithPasskey()  <-- triggers WebAuthn prompt
    |        |
    |        v
    |    nostrSigner.setNsec(decryptedNsec)
    |
    +--> storedMethod === 'extension'?
         window.nostr.signEvent(...)        <-- delegate to browser extension
```

Key insight: the nsec is re-acquired **lazily** — only when the first signing operation occurs after a refresh, not on page load. This avoids unnecessary WebAuthn prompts.

### Logout

```
authService.logout()
    |
    v
nostrSigner.clear()
    |
    v
_sk.fill(0)                     <-- zero out secret key bytes
_sk = null
localStorage.remove("bies_token")
localStorage.remove("bies_user")
localStorage.remove("bies_login_method")
```

Note: passkey credential data (`bies_passkey_credentials`) is **not** removed on logout — it persists for future logins. It can be explicitly removed via `passkeyService.removeCredential(pubkey)` or `passkeyService.removeAll()`.

---

## NostrSigner — Unified Signing Abstraction

`nostrSigner` (`src/services/nostrSigner.js`) provides a single interface for all Nostr operations regardless of how the user logged in.

### Operation Resolution Order

For every operation (`getPublicKey`, `signEvent`, `nip44.encrypt`, `nip44.decrypt`):

1. **In-memory nsec** — If `_sk` is set, use it directly. Fastest path.
2. **Extension mode** — If mode is `'extension'` and `window.nostr` exists, delegate.
3. **Passkey re-acquire** — If stored method is `'nsec'` and a passkey credential exists, trigger `loginWithPasskey()` to re-derive the nsec.
4. **Last-resort extension** — If `window.nostr` exists (even without explicit extension mode), try it.
5. **Error** — No signing method available.

### NIP-44 Support

The signer exposes a `nip44` interface matching the `window.nostr.nip44` shape:

```javascript
nostrSigner.nip44.encrypt(recipientPubkey, plaintext)
nostrSigner.nip44.decrypt(senderPubkey, ciphertext)
```

Uses `nostr-tools/nip44` v2 with conversation keys derived from the in-memory secret key. Falls back to the browser extension's NIP-44 implementation if available.

---

## NIP-49 Keyfile — Complementary Storage

Separate from the passkey system, BIES also supports NIP-49 encrypted keyfiles as a portable backup mechanism.

### Keyfile Structure

```json
{
  "format": "nostrkey",
  "version": 1,
  "npub": "npub1...",
  "ncryptsec": "ncryptsec1...",
  "created_at": "2026-03-16T...",
  "client": "BIES v1.0"
}
```

### Encryption

- Algorithm: scrypt + XChaCha20-Poly1305 (per NIP-49 spec, via `nostr-tools/nip49`)
- Configurable scrypt cost: `log_n` = 16 (default, 64 MiB), 18 (256 MiB), or 20 (1 GiB)
- Password chosen by the user during signup

### Relationship to Passkey

| | NIP-49 Keyfile | Passkey |
|---|---|---|
| Purpose | Portable backup | Quick device login |
| Persistence | Downloaded file | Authenticator + localStorage |
| Authentication | Password (user-memorized) | Biometric / PIN (hardware-gated) |
| Cross-device | Yes (file transfer) | Yes (largeBlob on hardware keys) |
| Created during | Signup (mandatory) | Signup or login (optional) |

During signup, the keyfile is created first (step 1-2), then the user is offered to also save a passkey (step 2). The keyfile is the authoritative backup; the passkey is a convenience layer.

---

## User Flows

### New User Signup

```
Step 0: Generate Keys
  - BIP-39 seed phrase generated (NIP-06)
  - Derive secret key and public key
  - Display seed phrase (user should write it down)

Step 1: Encrypt & Download Key File
  - User sets a password (min 8 chars, strength meter shown)
  - Optional: configure scrypt cost (log_n 16/18/20)
  - Secret key encrypted to ncryptsec via NIP-49
  - .nostrkey file auto-downloaded

Step 2: Confirmation & Optional Passkey
  - User confirms they've saved the file
  - If WebAuthn is supported: "Also Save to Passkey" button
    - Calls passkeyService.saveWithPasskey(nsec, pubkey)
    - Note: URL is temporarily changed to /login for RP ID consistency

Step 3: Profile Setup
  - User sets display name and role (Investor / Builder)
  - nsec login triggered → challenge-response with backend
  - JWT issued, user enters dashboard
```

### Returning User Login

```
Quick Login Options (shown as buttons):
  - Extension (if window.nostr detected)
  - Passkey (if credential exists)
  - File (.nostrkey upload)
  - nsec (paste raw nsec)
  - Seed (paste seed phrase)

Post-login:
  - If no passkey exists and WebAuthn is supported:
    "Save a passkey for quick login next time?" prompt
  - User can save or skip
```

---

## Security Properties

### What is protected

| Threat | Mitigation |
|---|---|
| nsec theft from storage | nsec is never stored in plaintext. Encrypted with AES-256-GCM. |
| nsec theft from memory | Bytes zeroed on logout (`_sk.fill(0)`). Only in memory during active session. |
| Unauthorized decryption | Requires biometric/PIN authentication via WebAuthn (`userVerification: 'required'`). |
| Ciphertext tampering | AES-GCM provides authenticated encryption — tampered ciphertext fails decryption. |
| Key derivation weakness | HKDF-SHA256 with random 16-byte salt and domain-separated info string. |
| Cross-origin attacks | WebAuthn credentials are bound to the RP ID (`window.location.hostname`). |
| Server compromise | Server never sees the nsec — only signed events. All crypto is client-side. |

### Limitations

| Limitation | Detail |
|---|---|
| Device-bound fallback | When PRF is unavailable, the AES key is in localStorage — if localStorage is cleared or the device is lost, the passkey credential becomes unusable. The keyfile backup is still valid. |
| localStorage exposure | On a compromised machine, localStorage contents (including encrypted nsec and device key) can be read. The encrypted nsec alone is safe (needs PRF to decrypt), but the device-key path is weaker — an attacker with localStorage access and the ability to trigger WebAuthn could decrypt. |
| No server-side recovery | If the user loses both their keyfile and their passkey, there is no recovery path. This is by design — sovereign key management. |
| Single RP ID | Passkey credentials are bound to the hostname. Changing the domain requires re-registration. |

---

## Comparison with NIP-79 (Nosskey)

| Aspect | NIP-79 (Nosskey) | BIES Implementation |
|---|---|---|
| Specification | Standardized NIP | Custom |
| PRF salt derivation | Standardized | Fixed string `bies-nostr-key-encryption` |
| KDF info | Per-spec | `bies-nsec-v1` |
| Storage | Authenticator-only | largeBlob + localStorage dual-path |
| Non-PRF fallback | Not defined in spec | Device-bound random AES key |
| largeBlob format | Not specified | Custom binary envelope (version + method + salt + IV + ciphertext) |
| Server involvement | None | None |
| Credential discovery | Discoverable | Discoverable (residentKey: required) |
| Cross-device | Via authenticator only | largeBlob (authenticator) or localStorage (same device) |
