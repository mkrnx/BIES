// Cowork domain service — thin wrappers over the server-backed cowork API.
//
// Cowork moved from ephemeral Nostr presence (kind-31980 replaceable events on
// the private relay) to persistent, joinable server sessions. All Nostr logic
// (event build/parse, geohash, relay subscribe) is gone; this module now just
// delegates to coworkApi so callers have a stable, intent-named surface.
//
// Session shape (from the server):
//   { id, title, host:{id,name,avatar,nostrPubkey}, venue:{id,name,area,lat,lng}|null,
//     locationName, lat, lng, note, amenities:string[], startTime, endTime,
//     status:'ACTIVE'|'ENDED', attendeeCount, isAttending, isHost }
// Venue shape:
//   { id, name, address, area, lat, lng, createdById }
import { coworkApi } from './api';

// ─── Sessions ──────────────────────────────────────────────────────────────
export const listActive = () => coworkApi.listSessions('active'); // → { data: Session[] }
export const listPast = () => coworkApi.listSessions('past');     // → { data: Session[] }
export const get = (id) => coworkApi.getSession(id);              // → Session (+ attendees[])
export const create = (data) => coworkApi.createSession(data);    // → Session
export const join = (id) => coworkApi.joinSession(id);            // → { attendeeCount, isAttending }
export const leave = (id) => coworkApi.leaveSession(id);          // → { attendeeCount, isAttending }
export const end = (id) => coworkApi.endSession(id);              // → Session (status 'ENDED')

// ─── Venues ────────────────────────────────────────────────────────────────
export const listVenues = () => coworkApi.listVenues();          // → { data, groups }
export const addVenue = (data) => coworkApi.addVenue(data);      // → Venue

// Kept as a named export so existing imports keep resolving.
export const coworkService = {
    listActive,
    listPast,
    get,
    create,
    join,
    leave,
    end,
    listVenues,
    addVenue,
};
