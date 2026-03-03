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

        try {
            const user = await authApi.me();
            authService.setCachedUser(user);
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

        // Step 1: Get pubkey from browser extension
        const pubkey = await window.nostr.getPublicKey();

        // Step 2: Get challenge from backend
        const { challenge } = await authApi.nostrChallenge(pubkey);

        // Step 3: Sign a kind:27235 event with the challenge as content
        const signedEvent = await window.nostr.signEvent({
            kind: 27235,
            pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: challenge,
        });

        // Step 4: Send signed event to backend for verification
        const { user, token } = await authApi.nostrLogin(pubkey, signedEvent);

        authService.setToken(token);
        authService.setCachedUser(user);
        return user;
    },

    // ─── Email/password login ───────────────────────────────────────────────

    loginWithEmail: async (email, password) => {
        const { user, token } = await authApi.login(email, password);
        authService.setToken(token);
        authService.setCachedUser(user);
        return user;
    },

    // ─── Registration ────────────────────────────────────────────────────────

    register: async (email, password, role, name) => {
        const { user, token } = await authApi.register(email, password, role, name);
        authService.setToken(token);
        authService.setCachedUser(user);
        return user;
    },

    // ─── Logout ─────────────────────────────────────────────────────────────

    logout: () => {
        authService.clearToken();
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
