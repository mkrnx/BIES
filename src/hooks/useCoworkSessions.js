import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { coworkApi } from '../services/api';

/**
 * Server-backed active cowork sessions.
 *
 * Fetches `GET /cowork/sessions?filter=active` on mount and polls every 25s
 * (skipping polls while the tab is hidden). The user's OWN actions apply
 * optimistically for instant feedback, then reconcile from the API response and
 * roll back on error; other users' joins/leaves/new sessions self-heal on the
 * next poll.
 *
 * Session shape (per session in `sessions`):
 *   { id, title, host, venue, locationName, lat, lng, note, amenities,
 *     startTime, endTime, status, attendeeCount, isAttending, isHost }
 *
 * @param {boolean} [enabled=true] - when false, skips fetching/polling.
 * @returns {{
 *   sessions: Array, mySession: Object|null, loading: boolean, error: Error|null,
 *   retry: Function,
 *   checkIn: (data) => Promise, createSession: (data) => Promise,
 *   checkOut: (id) => Promise, endSession: (id) => Promise,
 *   joinSession: (id) => Promise, leaveSession: (id) => Promise,
 *   addSession: (session) => void, addOptimistic: (session) => void,
 *   fetchPast: () => Promise
 * }}
 */
export function useCoworkSessions(enabled = true) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState(null);

    const mountedRef = useRef(false);

    // ── Fetch active sessions (initial load + each poll) ────────────────────
    const load = useCallback(async () => {
        try {
            const res = await coworkApi.listSessions('active');
            if (!mountedRef.current) return;
            setSessions(Array.isArray(res?.data) ? res.data : []);
            setError(null);
        } catch (err) {
            if (mountedRef.current) setError(err);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    // Force an immediate refetch (e.g. after an error, or when a tab changes).
    const retry = useCallback(() => {
        setLoading(true);
        setError(null);
        load();
    }, [load]);

    useEffect(() => {
        mountedRef.current = true;
        if (!enabled) {
            setLoading(false);
            return () => { mountedRef.current = false; };
        }
        setLoading(true);
        load();
        const interval = setInterval(() => {
            // Skip work while the tab is hidden; the next visible poll reconciles.
            if (typeof document !== 'undefined' && document.hidden) return;
            load();
        }, 25000);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [enabled, load]);

    // ── Local list mutation helpers ─────────────────────────────────────────
    // Insert an already-created session at the top (dedupe by id). Used by
    // callers that created the session themselves (e.g. CheckInModal).
    const addSession = useCallback((session) => {
        if (!session?.id) return;
        setSessions((prev) => {
            if (prev.some((s) => s.id === session.id)) {
                return prev.map((s) => (s.id === session.id ? session : s));
            }
            return [session, ...prev];
        });
    }, []);

    // ── Actions (optimistic where it helps, always reconciling) ─────────────

    // Create a session and drop it into the list immediately. The server returns
    // the full Session (attendeeCount:1, isHost:true, isAttending:true).
    const checkIn = useCallback(async (data) => {
        const session = await coworkApi.createSession(data);
        if (mountedRef.current) addSession(session);
        return session;
    }, [addSession]);

    // End (host/admin) — optimistically drop from the active list, restore on error.
    const checkOut = useCallback(async (id) => {
        let snapshot;
        setSessions((prev) => {
            snapshot = prev.find((s) => s.id === id);
            return prev.filter((s) => s.id !== id);
        });
        try {
            return await coworkApi.endSession(id);
        } catch (err) {
            if (mountedRef.current && snapshot) {
                setSessions((prev) =>
                    prev.some((s) => s.id === id) ? prev : [snapshot, ...prev],
                );
            }
            throw err;
        }
    }, []);

    // Join — bump count + set isAttending optimistically, reconcile from response.
    const joinSession = useCallback(async (id) => {
        let snapshot;
        setSessions((prev) =>
            prev.map((s) => {
                if (s.id !== id) return s;
                snapshot = s;
                return { ...s, attendeeCount: (s.attendeeCount || 0) + 1, isAttending: true };
            }),
        );
        try {
            const res = await coworkApi.joinSession(id);
            if (mountedRef.current) {
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === id
                            ? { ...s, attendeeCount: res.attendeeCount, isAttending: res.isAttending }
                            : s,
                    ),
                );
            }
            return res;
        } catch (err) {
            if (mountedRef.current && snapshot) {
                setSessions((prev) => prev.map((s) => (s.id === id ? snapshot : s)));
            }
            throw err;
        }
    }, []);

    // Leave — decrement count + clear isAttending optimistically, reconcile.
    const leaveSession = useCallback(async (id) => {
        let snapshot;
        setSessions((prev) =>
            prev.map((s) => {
                if (s.id !== id) return s;
                snapshot = s;
                return { ...s, attendeeCount: Math.max(0, (s.attendeeCount || 0) - 1), isAttending: false };
            }),
        );
        try {
            const res = await coworkApi.leaveSession(id);
            if (mountedRef.current) {
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === id
                            ? { ...s, attendeeCount: res.attendeeCount, isAttending: res.isAttending }
                            : s,
                    ),
                );
            }
            return res;
        } catch (err) {
            if (mountedRef.current && snapshot) {
                setSessions((prev) => prev.map((s) => (s.id === id ? snapshot : s)));
            }
            throw err;
        }
    }, []);

    // Convenience: on-demand fetch of ended sessions for the Past tab (not polled).
    const fetchPast = useCallback(() => coworkApi.listSessions('past'), []);

    // The active session the current user hosts (server flags isHost).
    const mySession = useMemo(() => sessions.find((s) => s.isHost) || null, [sessions]);

    return {
        sessions,
        mySession,
        loading,
        error,
        retry,
        // create
        checkIn,
        createSession: checkIn,
        addSession,
        addOptimistic: addSession,
        // end
        checkOut,
        endSession: checkOut,
        // attend
        joinSession,
        leaveSession,
        // past
        fetchPast,
    };
}
