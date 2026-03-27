/**
 * authService — bridges the frontend auth flow with the BIES backend.
 *
 * JWT is stored in localStorage under 'bies_token'.
 * User object (without secrets) is cached under 'bies_user'.
 *
 * The service:
 *  - Stores/retrieves JWT
 *  - Calls backend to validate/restore sessions
 *  - Never stores private keys — keys belong in the Nostr extension
 */

import { authApi } from './api.js';
import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools';
import { privateKeyFromSeedWords, validateWords } from 'nostr-tools/nip06';
import { nostrSigner } from './nostrSigner.js';
import { fingerprintService } from './fingerprintService.js';

const TOKEN_KEY = 'bies_token';
const USER_KEY = 'bies_user';

export const authService = {
    // ─── Token management ───────────────────────────────────────────────────

    getToken: () => localStorage.getItem(TOKEN_KEY),

    setToken: (token) => localStorage.setItem(TOKEN_KEY, token),

    clearToken: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    },

    // ─── User cache (lightweight, not authoritative — always re-verify with /me) ─

    getCachedUser: () => {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    setCachedUser: (user) => {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    },

    // ─── Session restore ────────────────────────────────────────────────────

    /**
     * Called on app mount. Returns the user if the token is still valid.
     * Makes a real network request to /auth/me.
     */
    restoreSession: async () => {
        const token = authService.getToken();
        if (!token) return null;

        // TODO: Remove before production — demo bypass
        if (token === 'demo-token') {
            return authService.getCachedUser();
        }

        try {
            const user = await authApi.me();
            authService.setCachedUser(user);
            // Restore client-side signer for custodial users (email login)
            // so the browser can authenticate to the private relay via NIP-42.
            if (user.nostrNsec && !nostrSigner.hasKey) {
                nostrSigner.setNsec(user.nostrNsec);
            }
            return user;
        } catch {
            // Token expired or invalid
            authService.clearToken();
            return null;
        }
    },

    // ─── Nostr login ────────────────────────────────────────────────────────

    /**
     * Login using a Nostr browser extension (Alby, nos2x, etc.).
     * Uses challenge-response: get pubkey → fetch challenge → sign it → verify.
     * Returns the user object + stores JWT.
     */
    loginWithNostr: async () => {
        if (!window.nostr) {
            throw new Error('No Nostr extension found. Please install Alby or nos2x.');
        }

        const pubkey = await window.nostr.getPublicKey();
        const { challenge } = await authApi.nostrChallenge(pubkey);

        const signedEvent = await window.nostr.signEvent({
            kind: 27235,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: challenge,
        });

        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token } = await authApi.nostrLogin(pubkey, signedEvent, fingerprint);

        authService.setToken(token);
        authService.setCachedUser(user);
        nostrSigner.setExtensionMode();
        return user;
    },

    // ─── Nsec login ────────────────────────────────────────────────────────

    /**
     * Login using an nsec key directly.
     * Decodes the nsec, derives the pubkey, then does the same
     * challenge-response flow as extension login.
     * The secret key is never stored — only held in memory during signing.
     */
    loginWithNsec: async (nsecString) => {
        const decoded = nip19.decode(nsecString.trim());
        if (decoded.type !== 'nsec') {
            throw new Error('Invalid nsec key.');
        }
        const sk = decoded.data;
        const pubkey = getPublicKey(sk);

        const { challenge } = await authApi.nostrChallenge(pubkey);

        const signedEvent = finalizeEvent({
            kind: 27235,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: challenge,
        }, sk);

        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token } = await authApi.nostrLogin(pubkey, signedEvent, fingerprint);

        authService.setToken(token);
        authService.setCachedUser(user);
        nostrSigner.setNsec(nsecString);
        return user;
    },

    // ─── Seed phrase login ─────────────────────────────────────────────────

    /**
     * Login using a BIP-39 seed phrase (NIP-06).
     * Derives the Nostr secret key from the mnemonic, then does the same
     * challenge-response flow as extension/nsec login.
     */
    loginWithSeedPhrase: async (mnemonic) => {
        const words = mnemonic.trim().toLowerCase();
        if (!validateWords(words)) {
            throw new Error('Invalid seed phrase.');
        }
        const sk = privateKeyFromSeedWords(words);
        const pubkey = getPublicKey(sk);

        const { challenge } = await authApi.nostrChallenge(pubkey);

        const signedEvent = finalizeEvent({
            kind: 27235,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: challenge,
        }, sk);

        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token } = await authApi.nostrLogin(pubkey, signedEvent, fingerprint);

        authService.setToken(token);
        authService.setCachedUser(user);
        nostrSigner.setNsec(sk);
        return user;
    },

    // ─── Passkey login ──────────────────────────────────────────────────────

    /**
     * Login using a saved passkey.
     * Decrypts the stored nsec via WebAuthn PRF, then does the same
     * challenge-response flow as nsec login.
     */
    loginWithPasskey: async () => {
        const { keytrService } = await import('./keytrService.js');
        const nsec = await keytrService.loginWithPasskey();
        return authService.loginWithNsec(nsec);
    },

    // ─── Bunker login (NIP-46 remote signer) ───────────────────────────────

    /**
     * Login using a NIP-46 remote signer (Amber, nsecBunker, etc.).
     * Connects via bunker:// URI or name@domain, then does the same
     * challenge-response flow — signing happens on the remote device.
     */
    loginWithBunker: async (bunkerInput) => {
        const { nostrConnectService } = await import('./nostrConnectService.js');
        const bunkerSigner = await nostrConnectService.connect(bunkerInput);

        const pubkey = await bunkerSigner.getPublicKey();
        const { challenge } = await authApi.nostrChallenge(pubkey);

        const signedEvent = await bunkerSigner.signEvent({
            kind: 27235,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: challenge,
        });

        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token } = await authApi.nostrLogin(pubkey, signedEvent, fingerprint);

        authService.setToken(token);
        authService.setCachedUser(user);
        nostrSigner.setBunkerMode(pubkey);
        return user;
    },

    // ─── Demo login (temporary — TODO: remove before production) ───────────

    loginWithDemo: async () => {
        const { user, token } = await authApi.demoLogin();
        authService.setToken(token);
        authService.setCachedUser(user);
        return user;
    },

    // ─── Email/password login ───────────────────────────────────────────────

    loginWithEmail: async (email, password) => {
        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token, nostrNsec } = await authApi.login(email, password, fingerprint);
        authService.setToken(token);
        authService.setCachedUser(user);
        // Set up client-side signer so the browser can authenticate to
        // the private relay via NIP-42.
        if (nostrNsec) {
            nostrSigner.setNsec(nostrNsec);
        }
        return user;
    },

    // ─── Registration ────────────────────────────────────────────────────────

    register: async (email, password, role, name) => {
        const fingerprint = await fingerprintService.getFingerprint();
        const { user, token } = await authApi.register(email, password, role, name, fingerprint);
        authService.setToken(token);
        authService.setCachedUser(user);
        return user;
    },

    // ─── Logout ─────────────────────────────────────────────────────────────

    logout: () => {
        authService.clearToken();
        nostrSigner.clear();
    },

    // ─── Role management ────────────────────────────────────────────────────

    updateRole: async (role) => {
        const result = await authApi.updateRole(role);
        // Update cached user
        const cached = authService.getCachedUser();
        if (cached) {
            authService.setCachedUser({ ...cached, role: result.role });
        }
        return result;
    },

    // ─── Nostr signup flow (for new Nostr users filling in profile) ──────────

    /**
     * After Nostr login for new users, complete the profile setup.
     * The backend auto-creates the user on nostrLogin; this just updates the profile.
     */
    completeNostrProfile: async (profileData) => {
        const { profilesApi } = await import('./api.js');
        return profilesApi.update(profileData);
    },
};
