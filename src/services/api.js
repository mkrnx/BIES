/**
 * BIES API Client
 *
 * Centralised HTTP client for all backend communication.
 *
 * Features:
 *  - Automatic JWT injection from localStorage
 *  - 401 auto-logout (token expired / invalid)
 *  - Consistent error format
 *  - All API methods co-located here for easy maintenance
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request(method, path, body = null, options = {}) {
    const token = localStorage.getItem('bies_token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const config = {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    };

    const res = await fetch(`${BASE_URL}${path}`, config);

    // If unauthorized, clear session and reload
    if (res.status === 401) {
        localStorage.removeItem('bies_token');
        localStorage.removeItem('bies_user');
        // Dispatch a custom event so AuthContext can react
        window.dispatchEvent(new CustomEvent('bies:unauthorized'));
    }

    const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));

    if (!res.ok) {
        const error = new Error(data.error || `Request failed (${res.status})`);
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data;
}

const get = (path, params = {}) => {
    const qs = Object.keys(params)
        .filter((k) => params[k] !== undefined && params[k] !== '' && params[k] !== null)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
    return request('GET', qs ? `${path}?${qs}` : path);
};
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

// ─── Form-data upload helper (for files) ─────────────────────────────────────

async function uploadFile(path, formData) {
    const token = localStorage.getItem('bies_token');
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData, // Let browser set Content-Type with boundary
    });

    const data = await res.json().catch(() => ({ error: 'Upload failed' }));
    if (!res.ok) {
        const error = new Error(data.error || 'Upload failed');
        error.status = res.status;
        throw error;
    }
    return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
    register: (email, password, role, name, fingerprint) =>
        post('/auth/register', { email, password, role, name, fingerprint }),

    login: (email, password, fingerprint) =>
        post('/auth/login', { email, password, fingerprint }),

    nostrChallenge: (pubkey) =>
        get('/auth/nostr-challenge', { pubkey }),

    nostrLogin: (pubkey, signedEvent, fingerprint) =>
        post('/auth/nostr-login', { pubkey, signedEvent, fingerprint }),

    demoLogin: () => post('/auth/demo-login'), // TODO: Remove before production

    me: () => get('/auth/me'),

    updateRole: (role) => put('/auth/role', { role }),
};

// ─── Profiles ────────────────────────────────────────────────────────────────

export const profilesApi = {
    list: (params = {}) => get('/profiles', params),
    // params: { role, location, search, page, limit }

    get: (id) => get(`/profiles/${id}`),

    me: () => get('/profiles/me'),

    update: (data) => put('/profiles/me', data),

    // NIP-05 availability check
    checkNip05: (name) => get('/profiles/check-nip05', { name }),

    // Follow system
    follow: (id) => post(`/profiles/${id}/follow`),
    unfollow: (id) => del(`/profiles/${id}/follow`),
    getFollowing: (id, params = {}) => get(`/profiles/${id}/following`, params),
    getFollowers: (id, params = {}) => get(`/profiles/${id}/followers`, params),
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectsApi = {
    list: (params = {}) => get('/projects', params),
    // params: { category, stage, ownerId, search, featured, sort, page, limit }

    get: (id) => get(`/projects/${id}`),

    create: (data) => post('/projects', data),

    update: (id, data) => put(`/projects/${id}`, data),

    delete: (id) => del(`/projects/${id}`),

    getDeck: (id) => get(`/projects/${id}/deck`),

    submit: (id) => put(`/projects/${id}/submit`, {}),

    expressInterest: (id) => post(`/projects/${id}/interest`, {}),

    requestDeck: (id, data) => post(`/projects/${id}/deck/request`, data),

    getAllDeckRequests: () => get('/projects/builder/deck-requests'),

    reviewDeckRequest: (projectId, requestId, status) =>
        put(`/projects/${projectId}/deck/requests/${requestId}`, { status }),

    postUpdate: (id, title, content) =>
        post(`/projects/${id}/updates`, { title, content }),
};

// ─── Upload ───────────────────────────────────────────────────────────────────

export const uploadApi = {
    media: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        return uploadFile('/upload/media', fd);
    },

    deck: (file, projectId) => {
        const fd = new FormData();
        fd.append('file', file);
        return uploadFile(`/upload/deck?projectId=${projectId}`, fd);
    },
};

// ─── Messages ────────────────────────────────────────────────────────────────

export const messagesApi = {
    conversations: () => get('/messages/conversations'),

    thread: (partnerId, params = {}) =>
        get(`/messages/${partnerId}`, params),

    send: (recipientId, content, isEncrypted = true, nostrEventId = null) =>
        post('/messages', { recipientId, content, isEncrypted, nostrEventId }),

    delete: (id) => del(`/messages/${id}`),

    unreadCount: () => get('/messages/unread-count'),
};

// ─── Watchlist ────────────────────────────────────────────────────────────────

export const watchlistApi = {
    list: () => get('/watchlist'),

    add: (projectId, note = '') => post('/watchlist', { projectId, note }),

    remove: (projectId) => del(`/watchlist/${projectId}`),

    updateNote: (projectId, note) => put(`/watchlist/${projectId}/note`, { note }),

    check: (projectId) => get(`/watchlist/check/${projectId}`),
};

// ─── Investments ──────────────────────────────────────────────────────────────

export const investmentsApi = {
    list: (params = {}) => get('/investments', params),
    // params: { status, projectId, page, limit }

    get: (id) => get(`/investments/${id}`),

    create: (projectId, amount, currency = 'USD', terms = '', notes = '') =>
        post('/investments', { projectId, amount, currency, terms, notes }),

    update: (id, data) => put(`/investments/${id}`, data),

    fundingStats: (projectId) => get(`/investments/stats/${projectId}`),
};

// ─── Zaps ─────────────────────────────────────────────────────────────────────

export const zapsApi = {
    projectZaps: (projectId, params = {}) => get(`/zaps/project/${projectId}`, params),
    // params: { page, limit }

    userZaps: (pubkey, params = {}) => get(`/zaps/user/${pubkey}`, params),
    // params: { page, limit }

    projectZapStats: (projectId) => get(`/zaps/stats/${projectId}`),
};

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
    list: (params = {}) => get('/notifications', params),
    // params: { unread, page, limit }

    count: () => get('/notifications/count'),

    markRead: (id) => put(`/notifications/${id}/read`, {}),

    markAllRead: () => put('/notifications/read-all', {}),

    delete: (id) => del(`/notifications/${id}`),

    /**
     * Notify a BIES user about a feed interaction (comment, like, reply).
     * Fire-and-forget — errors are silently ignored.
     */
    feedInteraction: (data) => post('/notifications/feed-interaction', data).catch(() => {}),

    // Push subscription management
    getVapidKey: () => get('/notifications/push/vapid-key'),
    pushSubscribe: (subscription) => post('/notifications/push/subscribe', subscription.toJSON()),
    pushUnsubscribe: (endpoint) => request('DELETE', '/notifications/push/subscribe', { endpoint }),
};

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventsApi = {
    list: (params = {}) => get('/events', params),
    // params: { category, upcoming, search, isOfficial, isEndorsed, page, limit }

    listMine: (params = {}) => get('/events/my', params),
    listAttending: (params = {}) => get('/events/attending', params),

    get: (id) => get(`/events/${id}`),

    create: (data) => post('/events', data),

    update: (id, data) => put(`/events/${id}`, data),

    delete: (id) => del(`/events/${id}`),

    endorse: (id, endorse = true) => put(`/events/${id}/endorse`, { endorse }),

    rsvp: (id, status = 'GOING') => post(`/events/${id}/rsvp`, { status }),

    cancelRsvp: (id) => del(`/events/${id}/rsvp`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
    recordView: (projectId) => post(`/analytics/view/${projectId}`, {}),

    builderDashboard: () => get('/analytics/dashboard'),

    investorDashboard: () => get('/analytics/investor-dashboard'),

    project: (id) => get(`/analytics/project/${id}`),

    platform: () => get('/analytics/platform'),
};

// ─── Investor ─────────────────────────────────────────────────────────────────

export const investorApi = {
    requestRole: (data) => post('/investor/request', data),
};

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchApi = {
    search: (q, type = 'all', page = 1, limit = 10) =>
        get('/search', { q, type, page, limit }),

    suggestions: (q) => get('/search/suggestions', { q }),
};

// ─── Admin ────────────────────────────────────────────────────────────────────

export const adminApi = {
    users: (params = {}) => get('/admin/users', params),
    banUser: (id, banned) => put(`/admin/users/${id}/ban`, { banned }),
    setRole: (id, role) => put(`/admin/users/${id}/role`, { role }),
    verifyUser: (id) => put(`/admin/users/${id}/verify`, {}),
    featureProject: (id, featured) => put(`/admin/projects/${id}/feature`, { featured }),
    deleteProject: (id) => del(`/admin/projects/${id}`),
    changeProjectOwner: (id, newOwnerId) => put(`/admin/projects/${id}/owner`, { newOwnerId }),
    listProjects: (params = {}) => get('/admin/projects', params),
    reviewProject: (id, action) => put(`/admin/projects/${id}/review`, { action }),
    listEvents: (params = {}) => get('/admin/events', params),
    featureEvent: (id, featured) => put(`/admin/events/${id}/feature`, { featured }),
    deleteUser: (id) => del(`/admin/users/${id}`),
    trashedUsers: (params = {}) => get('/admin/users/trash', params),
    restoreUser: (id) => put(`/admin/users/${id}/restore`, {}),
    purgeUser: (id) => del(`/admin/users/${id}/purge`),
    syncAccounts: (sourceUserId, targetUserId, deleteSource) =>
        post('/admin/users/sync', { sourceUserId, targetUserId, deleteSource }),
    auditLogs: (params = {}) => get('/admin/audit-logs', params),
    broadcast: (message) => post('/admin/broadcast', { message }),
    clearCache: (pattern = '') => post('/admin/cache/clear', { pattern }),
    investorRequests: (params = {}) => get('/admin/investor-requests', params),
    updateInvestorRequest: (id, status) => put(`/admin/investor-requests/${id}`, { status }),
};

// ─── Content (Media / Blog / Resources) ──────────────────────────────────────

export const contentApi = {
    articles: (params = {}) => get('/content/articles', params),
    // params: { category, search, page, limit }

    article: (idOrSlug) => get(`/content/articles/${idOrSlug}`),

    videos: (params = {}) => get('/content/videos', params),

    resources: (params = {}) => get('/content/resources', params),
};

// ─── News Settings & Feeds ──────────────────────────────────────────────────

export const newsApi = {
    settings: () => get('/news/settings'),
    twitterFeed: () => get('/news/twitter-feed'),
    liveFeed: (keyword) => get('/news/live-feed', keyword ? { keyword } : {}),
    updateSettings: (data) => put('/news/settings', data),
};

// ─── Media (Live Feeds) ──────────────────────────────────────────────────────

export const mediaApi = {
    substack: () => get('/media/substack'),
    youtube: () => get('/media/youtube'),
    getReadState: () => get('/settings/media-read'),
    saveReadState: (data) => put('/settings/media-read', data),
};

// ─── User Preferences (persistent across login/logout) ──────────────────────

export const preferencesApi = {
    get: () => get('/settings/preferences'),
    save: (data) => put('/settings/preferences', data),
};

// ─── Health ───────────────────────────────────────────────────────────────────

export const healthApi = {
    check: () => get('/health'),
};

// ─── Coinos Wallet ───────────────────────────────────────────────────────────

export const walletApi = {
    createCoinos: (username) => post('/wallet/coinos/create', { username }),
    connectCoinos: (username, password) => post('/wallet/coinos/connect', { username, password }),
    disconnectCoinos: () => post('/wallet/coinos/disconnect'),
    coinosBalance: () => get('/wallet/coinos/balance'),
    coinosPay: (bolt11) => post('/wallet/coinos/pay', { bolt11 }),
};

// ─── WebSocket client ─────────────────────────────────────────────────────────

export class BiesWebSocket {
    constructor(onMessage, onConnect, onDisconnect) {
        this.onMessage = onMessage;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.ws = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.shouldReconnect = true;
    }

    connect() {
        const token = localStorage.getItem('bies_token');
        if (!token) return;

        const wsUrl = BASE_URL.replace(/^http/, 'ws').replace('/api', '') + `/ws?token=${token}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('[WS] Connected');
                this.reconnectDelay = 1000;
                if (this.onConnect) this.onConnect();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (this.onMessage) this.onMessage(data);
                } catch { /* ignore */ }
            };

            this.ws.onclose = () => {
                if (this.onDisconnect) this.onDisconnect();
                if (this.shouldReconnect) {
                    setTimeout(() => this.connect(), this.reconnectDelay);
                    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
                }
            };

            this.ws.onerror = () => {
                this.ws.close();
            };
        } catch { /* noop */ }
    }

    send(data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    disconnect() {
        this.shouldReconnect = false;
        this.ws?.close();
    }
}
