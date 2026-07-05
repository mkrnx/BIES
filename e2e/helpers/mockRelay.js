/**
 * mockRelay — minimal in-process Nostr relay for E2E tests.
 *
 * Speaks just enough NIP-01 for NIP-46 rendezvous traffic (kind 24133):
 * EVENT (store + broadcast + OK), REQ (replay matching + EOSE + live), CLOSE.
 * No auth, no write policy — unlike the docker strfry relay, which enforces a
 * pubkey whitelist and would reject ephemeral test keys.
 */

import { WebSocketServer } from 'ws';

function matchesFilter(event, filter) {
    if (filter.ids && !filter.ids.includes(event.id)) return false;
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;
    for (const [key, values] of Object.entries(filter)) {
        if (!key.startsWith('#')) continue;
        const tagName = key.slice(1);
        const tagValues = event.tags.filter(t => t[0] === tagName).map(t => t[1]);
        if (!values.some(v => tagValues.includes(v))) return false;
    }
    return true;
}

function matchesAny(event, filters) {
    return filters.some(f => matchesFilter(event, f));
}

/**
 * Start the relay. Returns { url, port, events, close() }.
 */
export function startMockRelay(port = 7799) {
    const wss = new WebSocketServer({ port });
    const events = []; // all accepted events, in order
    const subs = new Map(); // ws -> Map(subId -> filters)

    wss.on('connection', (ws) => {
        subs.set(ws, new Map());

        ws.on('message', (data) => {
            let msg;
            try { msg = JSON.parse(data.toString()); } catch { return; }
            const [type, ...rest] = msg;

            if (type === 'EVENT') {
                const event = rest[0];
                events.push(event);
                ws.send(JSON.stringify(['OK', event.id, true, '']));
                // Broadcast to every matching live subscription
                for (const [client, clientSubs] of subs.entries()) {
                    if (client.readyState !== 1) continue;
                    for (const [subId, filters] of clientSubs.entries()) {
                        if (matchesAny(event, filters)) {
                            client.send(JSON.stringify(['EVENT', subId, event]));
                        }
                    }
                }
            } else if (type === 'REQ') {
                const [subId, ...filters] = rest;
                subs.get(ws)?.set(subId, filters);
                for (const event of events) {
                    if (matchesAny(event, filters)) {
                        ws.send(JSON.stringify(['EVENT', subId, event]));
                    }
                }
                ws.send(JSON.stringify(['EOSE', subId]));
            } else if (type === 'CLOSE') {
                subs.get(ws)?.delete(rest[0]);
            }
        });

        ws.on('close', () => subs.delete(ws));
    });

    return {
        url: `ws://localhost:${port}`,
        port,
        events,
        close: () => new Promise((resolve) => {
            for (const client of wss.clients) client.terminate();
            wss.close(() => resolve());
        }),
    };
}
