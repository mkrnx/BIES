/**
 * Primal Caching API Service
 *
 * Connects to Primal's caching WebSocket API to fetch trending/explore feeds.
 * This is read-only — all write operations (post, react, repost, zap) still
 * go through nostrService and the regular relay pool.
 */

const PRIMAL_CACHE_URL = 'wss://cache2.primal.net/v1';

// Primal custom event kinds in responses
const PRIMAL_KIND = {
    NOTE_STATS: 10000100,
    FEED_RANGE: 10000113,
    NOTE_ACTIONS: 10000115,
    LINK_METADATA: 10000128,
};

// Timeframe configs: { label, timeframe, created_after_seconds }
export const EXPLORE_VIEWS = [
    { key: 'trending_24h', label: 'Past 24 Hours', timeframe: 'trending', scope: 'global', createdAfterSec: 86400 },
    { key: 'trending_4h', label: 'Trending 4h', timeframe: 'trending', scope: 'global', createdAfterSec: 14400 },
    { key: 'trending_48h', label: 'Past 48 Hours', timeframe: 'trending', scope: 'global', createdAfterSec: 172800 },
    { key: 'trending_7d', label: 'Past 7 Days', timeframe: 'trending', scope: 'global', createdAfterSec: 604800 },
    { key: 'mostzapped', label: 'Most Zapped', timeframe: 'mostzapped', scope: 'global', createdAfterSec: 86400 },
    { key: 'popular', label: 'Popular', timeframe: 'popular', scope: 'global', createdAfterSec: null },
    { key: 'latest', label: 'Latest', timeframe: 'latest', scope: 'global', createdAfterSec: null },
];

let _subCounter = 0;
function nextSubId() {
    return `bies_explore_${++_subCounter}_${Date.now()}`;
}

class PrimalService {
    constructor() {
        this._ws = null;
        this._pending = new Map(); // subId -> { resolve, reject, notes, profiles, stats }
        this._connectPromise = null;
    }

    /**
     * Ensure WebSocket is connected. Returns existing connection if open.
     */
    _connect() {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            return Promise.resolve(this._ws);
        }
        if (this._connectPromise) return this._connectPromise;

        this._connectPromise = new Promise((resolve, reject) => {
            const ws = new WebSocket(PRIMAL_CACHE_URL);

            ws.onopen = () => {
                this._ws = ws;
                this._connectPromise = null;
                resolve(ws);
            };

            ws.onerror = (err) => {
                console.error('[Primal] WebSocket error:', err);
                this._connectPromise = null;
                reject(new Error('Failed to connect to Primal cache'));
            };

            ws.onclose = () => {
                this._ws = null;
                this._connectPromise = null;
                // Reject all pending requests
                for (const [subId, pending] of this._pending) {
                    pending.reject(new Error('Primal WebSocket closed'));
                    this._pending.delete(subId);
                }
            };

            ws.onmessage = (msg) => {
                this._handleMessage(msg.data);
            };
        });

        return this._connectPromise;
    }

    _handleMessage(raw) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }

        const type = parsed[0];
        const subId = parsed[1];
        const pending = this._pending.get(subId);
        if (!pending) return;

        if (type === 'EVENT') {
            const event = parsed[2];
            if (!event) return;

            if (event.kind === 0) {
                // Profile metadata
                try {
                    const profile = JSON.parse(event.content);
                    pending.profiles[event.pubkey] = profile;
                } catch { /* skip malformed */ }
            } else if (event.kind === 1) {
                // Text note
                pending.notes.push(event);
            } else if (event.kind === PRIMAL_KIND.NOTE_STATS) {
                // Stats for a note: content is JSON with event_id + stats
                try {
                    const stats = JSON.parse(event.content);
                    if (stats.event_id) {
                        pending.stats[stats.event_id] = stats;
                    }
                } catch { /* skip */ }
            } else if (event.kind === PRIMAL_KIND.NOTE_ACTIONS) {
                try {
                    const actions = JSON.parse(event.content);
                    if (actions.event_id) {
                        pending.actions[actions.event_id] = actions;
                    }
                } catch { /* skip */ }
            }
        } else if (type === 'EVENTS') {
            // Batch format — array of events
            const events = parsed[2];
            if (Array.isArray(events)) {
                for (const event of events) {
                    // Re-dispatch as individual EVENT
                    this._handleMessage(JSON.stringify(['EVENT', subId, event]));
                }
            }
        } else if (type === 'EOSE') {
            // End of stored events — resolve
            this._pending.delete(subId);
            pending.resolve({
                notes: pending.notes,
                profiles: pending.profiles,
                stats: pending.stats,
                actions: pending.actions,
            });
        } else if (type === 'NOTICE') {
            console.warn('[Primal] NOTICE:', parsed[2]);
        }
    }

    /**
     * Fetch explore/trending feed from Primal cache.
     *
     * @param {Object} view - One of EXPLORE_VIEWS entries
     * @param {Object} opts - { limit, until, userPubkey }
     * @returns {Promise<{ notes, profiles, stats, actions }>}
     */
    async fetchExploreFeed(view, opts = {}) {
        const ws = await this._connect();
        const subId = nextSubId();
        const limit = opts.limit || 20;

        const payload = {
            timeframe: view.timeframe,
            scope: view.scope,
            limit,
        };

        if (view.createdAfterSec) {
            payload.created_after = Math.floor(Date.now() / 1000) - view.createdAfterSec;
        }
        if (opts.until) {
            payload.until = opts.until;
        }
        if (opts.userPubkey) {
            payload.user_pubkey = opts.userPubkey;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pending.delete(subId);
                reject(new Error('Primal request timed out'));
            }, 15000);

            this._pending.set(subId, {
                resolve: (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                },
                notes: [],
                profiles: {},
                stats: {},
                actions: {},
            });

            const req = JSON.stringify(['REQ', subId, { cache: ['explore', payload] }]);
            ws.send(req);
        });
    }

    /**
     * Load more (pagination). Uses `until` from the last note's sort value.
     */
    async loadMore(view, lastNotes, lastStats, opts = {}) {
        if (!lastNotes.length) return { notes: [], profiles: {}, stats: {}, actions: {} };

        const lastNote = lastNotes[lastNotes.length - 1];
        const noteStats = lastStats[lastNote.id];
        let until;

        if (view.timeframe === 'trending') {
            until = noteStats?.score24h || lastNote.created_at;
        } else if (view.timeframe === 'popular') {
            until = noteStats?.score || lastNote.created_at;
        } else if (view.timeframe === 'mostzapped') {
            until = noteStats?.satszapped || lastNote.created_at;
        } else {
            until = lastNote.created_at;
        }

        return this.fetchExploreFeed(view, { ...opts, until });
    }

    /**
     * Fetch replies to a specific note using Primal's thread_view cache.
     *
     * @param {string} eventId - The note ID to fetch replies for
     * @param {Object} opts - { limit, userPubkey }
     * @returns {Promise<{ notes, profiles, stats, actions }>}
     */
    async fetchReplies(eventId, opts = {}) {
        const ws = await this._connect();
        const subId = nextSubId();
        const limit = opts.limit || 100;

        const payload = {
            event_id: eventId,
            limit,
        };

        if (opts.userPubkey) {
            payload.user_pubkey = opts.userPubkey;
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this._pending.delete(subId);
                reject(new Error('Primal thread request timed out'));
            }, 15000);

            this._pending.set(subId, {
                resolve: (result) => {
                    clearTimeout(timeout);
                    // Filter to only direct replies (kind:1 events that aren't the root)
                    const replies = result.notes.filter(n => n.id !== eventId);
                    resolve({ ...result, notes: replies });
                },
                reject: (err) => {
                    clearTimeout(timeout);
                    reject(err);
                },
                notes: [],
                profiles: {},
                stats: {},
                actions: {},
            });

            const req = JSON.stringify(['REQ', subId, { cache: ['thread_view', payload] }]);
            ws.send(req);
        });
    }

    /**
     * Close WebSocket connection.
     */
    disconnect() {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
    }
}

export const primalService = new PrimalService();
