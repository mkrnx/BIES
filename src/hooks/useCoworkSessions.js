import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { coworkService, parseCoworkEvent, isActive } from '../services/coworkService';
import { nostrService } from '../services/nostrService';

/**
 * Live cowork check-in sessions from the BIES relay.
 *
 * Dedupes events per pubkey (highest created_at wins — mirrors the relay's
 * replaceable-event semantics), ticks every 60s so expired pins drop live,
 * and resolves author profiles via the shared nostrService profile cache.
 *
 * @param {boolean} [enabled=true]
 * @returns {{ sessions: Array, profiles: Object, loading: boolean, error: boolean, retry: Function, addOptimistic: Function }}
 */
export function useCoworkSessions(enabled = true) {
    const [eventsByPubkey, setEventsByPubkey] = useState(() => new Map());
    const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);

    // Keep the newest event per pubkey. Subscription events only replace on a
    // strictly newer created_at; optimistic inserts (replaceTies) also win ties
    // so a check-out published in the same second as the check-in shows up.
    const upsert = useCallback((evt, replaceTies) => {
        if (!evt || !evt.pubkey) return;
        setEventsByPubkey(prev => {
            const existing = prev.get(evt.pubkey);
            if (existing && (replaceTies
                ? existing.created_at > evt.created_at
                : existing.created_at >= evt.created_at)) {
                return prev;
            }
            const next = new Map(prev);
            next.set(evt.pubkey, evt);
            return next;
        });
    }, []);

    const addOptimistic = useCallback((evt) => upsert(evt, true), [upsert]);

    // Re-run the subscription effect after a relay failure.
    const retry = useCallback(() => setRetryNonce(n => n + 1), []);

    // Subscribe on mount. StrictMode double-invokes the effect, but the
    // cleanup closes the subscription and clears the timers, so no duplicate
    // subscription survives.
    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        setError(false);
        let closed = false;
        const sub = coworkService.subscribe((evt) => upsert(evt, false), {
            // EOSE = the relay finished replaying stored events.
            oneose: () => setLoading(false),
            // Relay unreachable, AUTH rejected, or the sub was dropped.
            onclose: () => {
                if (closed) return;
                setLoading(false);
                setError(true);
            },
        });
        // Fallback only — EOSE normally clears loading well before this fires.
        const settleTimer = setTimeout(() => setLoading(false), 8000);
        const ticker = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60000);
        return () => {
            closed = true;
            sub.close();
            clearTimeout(settleTimer);
            clearInterval(ticker);
        };
    }, [enabled, upsert, retryNonce]);

    const allSessions = useMemo(() => {
        return [...eventsByPubkey.values()]
            .map(parseCoworkEvent)
            .filter(Boolean)
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [eventsByPubkey]);

    // Apply the expiry filter in a second pass that keeps the array identity
    // stable across the 60s tick — consumers (e.g. the fullscreen map) must
    // not see a "new" sessions array every minute when nothing changed.
    const prevSessionsRef = useRef([]);
    const sessions = useMemo(() => {
        const active = allSessions.filter(s => isActive(s, nowSec));
        const prev = prevSessionsRef.current;
        const unchanged = active.length === prev.length
            && active.every((s, i) => s.pubkey === prev[i].pubkey && s.createdAt === prev[i].createdAt);
        if (unchanged) return prev;
        prevSessionsRef.current = active;
        return active;
    }, [allSessions, nowSec]);

    // Resolve profiles whenever the set of visible pubkeys changes.
    const pubkeysKey = useMemo(
        () => sessions.map(s => s.pubkey).sort().join(','),
        [sessions],
    );

    useEffect(() => {
        if (!pubkeysKey) return undefined;
        let cancelled = false;
        const pubkeys = pubkeysKey.split(',');
        nostrService.getProfiles(pubkeys)
            .then(profileMap => {
                if (cancelled || !profileMap || profileMap.size === 0) return;
                setProfiles(prev => {
                    const next = { ...prev };
                    for (const [pk, profile] of profileMap) next[pk] = profile;
                    return next;
                });
            })
            .catch(() => { /* profiles are best-effort */ });
        return () => { cancelled = true; };
    }, [pubkeysKey]);

    return { sessions, profiles, loading, error, retry, addOptimistic };
}
