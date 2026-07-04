import { useState, useEffect, useMemo, useCallback } from 'react';
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
 * @returns {{ sessions: Array, profiles: Object, loading: boolean, addOptimistic: Function }}
 */
export function useCoworkSessions(enabled = true) {
    const [eventsByPubkey, setEventsByPubkey] = useState(() => new Map());
    const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(true);

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

    // Subscribe on mount. StrictMode double-invokes the effect, but the
    // cleanup closes the subscription and clears the timers, so no duplicate
    // subscription survives.
    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return undefined;
        }
        setLoading(true);
        const sub = coworkService.subscribe((evt) => upsert(evt, false));
        // The subscribe wrapper surfaces no EOSE — a short settle timer avoids
        // flashing the empty state before the initial events stream in.
        const settleTimer = setTimeout(() => setLoading(false), 1500);
        const ticker = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 60000);
        return () => {
            sub.close();
            clearTimeout(settleTimer);
            clearInterval(ticker);
        };
    }, [enabled, upsert]);

    const sessions = useMemo(() => {
        return [...eventsByPubkey.values()]
            .map(parseCoworkEvent)
            .filter(s => s && isActive(s, nowSec))
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [eventsByPubkey, nowSec]);

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

    return { sessions, profiles, loading, addOptimistic };
}
