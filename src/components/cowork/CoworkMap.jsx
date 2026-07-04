import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { EL_SALVADOR_CENTER, EL_SALVADOR_ZOOM } from '../../data/coworkSpots';
import { getDisplayName } from '../../utils/noteUtils';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Build an avatar pin as a real DOM element (never an HTML string — XSS-safe
 * against hostile kind:0 picture URLs, and sidesteps Leaflet's broken
 * default-marker-PNG-under-bundlers issue).
 */
function buildAvatarIcon(profile, displayName) {
    const initial = ((displayName || '?').trim().charAt(0) || '?').toUpperCase();
    const pin = document.createElement('div');
    pin.className = 'cowork-pin';
    const inner = document.createElement('div');
    inner.className = 'cowork-pin-inner';
    if (profile && typeof profile.picture === 'string' && /^https?:\/\//i.test(profile.picture)) {
        const img = document.createElement('img');
        img.alt = '';
        img.onerror = () => {
            img.remove();
            inner.textContent = initial;
        };
        img.src = profile.picture;
        inner.appendChild(img);
    } else {
        inner.textContent = initial;
    }
    pin.appendChild(inner);
    return L.divIcon({
        html: pin,
        className: 'cowork-pin-anchor',
        iconSize: [44, 52],
        iconAnchor: [22, 52],
    });
}

/** Simple orange pin for the drop-a-pin picker. */
function buildPickIcon() {
    const pin = document.createElement('div');
    pin.className = 'cowork-pick-pin';
    const dot = document.createElement('div');
    dot.className = 'cowork-pick-pin-dot';
    pin.appendChild(dot);
    return L.divIcon({
        html: pin,
        className: 'cowork-pin-anchor',
        iconSize: [24, 32],
        iconAnchor: [12, 32],
    });
}

/**
 * Plain-Leaflet map wrapper (react-leaflet v5 needs React 19; app is React 18).
 * The non-interactive thumbnail is the same component with every interaction
 * handler disabled.
 */
const CoworkMap = ({
    sessions = [],
    profiles = {},
    interactive = false,
    pickMode = false,
    pickedLatLng = null,
    onPick,
    center = EL_SALVADOR_CENTER,
    zoom = EL_SALVADOR_ZOOM,
    height = '200px',
    fit = true,
    focusPubkey = null,
}) => {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersLayerRef = useRef(null);
    const pickMarkerRef = useRef(null);
    const onPickRef = useRef(onPick);
    // Snapshot of create-time options — the map is created exactly once.
    const initOptionsRef = useRef({ center, zoom, interactive });

    useEffect(() => {
        onPickRef.current = onPick;
    }, [onPick]);

    // Create the map once (StrictMode-safe: cleanup removes it and nulls refs).
    useEffect(() => {
        if (mapRef.current || !containerRef.current) return undefined;
        const opts = initOptionsRef.current;
        const map = L.map(containerRef.current, {
            center: opts.center,
            zoom: opts.zoom,
            dragging: opts.interactive,
            scrollWheelZoom: opts.interactive,
            touchZoom: opts.interactive,
            doubleClickZoom: opts.interactive,
            boxZoom: opts.interactive,
            keyboard: opts.interactive,
            zoomControl: opts.interactive,
            tap: opts.interactive,
        });
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(map);
        markersLayerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        // Portal modals mount before layout settles — recompute the size.
        const rafId = requestAnimationFrame(() => map.invalidateSize());
        return () => {
            cancelAnimationFrame(rafId);
            map.remove();
            mapRef.current = null;
            markersLayerRef.current = null;
            pickMarkerRef.current = null;
        };
    }, []);

    // Rebuild avatar markers whenever sessions or profiles change.
    useEffect(() => {
        const map = mapRef.current;
        const layer = markersLayerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();
        const coords = [];
        for (const session of sessions) {
            const displayName = getDisplayName(session.pubkey, profiles);
            const icon = buildAvatarIcon(profiles[session.pubkey], displayName);
            L.marker([session.lat, session.lng], { icon })
                .bindTooltip(displayName)
                .addTo(layer);
            coords.push([session.lat, session.lng]);
        }
        const focused = focusPubkey ? sessions.find(s => s.pubkey === focusPubkey) : null;
        if (focused) {
            map.setView([focused.lat, focused.lng], 15);
        } else if (fit && sessions.length > 0) {
            map.fitBounds(L.latLngBounds(coords).pad(0.25), { maxZoom: 15 });
        }
    }, [sessions, profiles, fit, focusPubkey]);

    // Pick mode: forward map clicks as [lat, lng].
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !pickMode) return undefined;
        const handleClick = (e) => {
            if (onPickRef.current) onPickRef.current([e.latlng.lat, e.latlng.lng]);
        };
        map.on('click', handleClick);
        return () => {
            map.off('click', handleClick);
        };
    }, [pickMode]);

    // Pick mode: render a single marker at the picked position.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (pickMarkerRef.current) {
            pickMarkerRef.current.remove();
            pickMarkerRef.current = null;
        }
        if (pickMode && Array.isArray(pickedLatLng) && pickedLatLng.length === 2) {
            pickMarkerRef.current = L.marker(pickedLatLng, { icon: buildPickIcon() }).addTo(map);
        }
    }, [pickMode, pickedLatLng]);

    return (
        <>
            <div
                ref={containerRef}
                className="cowork-map-container"
                data-testid="cowork-map"
                style={{ height, width: '100%' }}
            />
            <style jsx global>{`
                /* Contain leaflet's internal z-indexes (up to ~700) so the map
                   never floats above the app chrome. */
                .cowork-map-container {
                    position: relative;
                    z-index: 0;
                    background: var(--color-gray-100);
                }

                .cowork-pin-anchor {
                    background: transparent;
                    border: none;
                }

                .cowork-pin {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 44px;
                    height: 52px;
                }

                .cowork-pin::after {
                    content: '';
                    width: 0;
                    height: 0;
                    border-left: 6px solid transparent;
                    border-right: 6px solid transparent;
                    border-top: 8px solid var(--color-secondary, #FF5B00);
                }

                .cowork-pin-inner {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    border: 3px solid var(--color-secondary, #FF5B00);
                    background: var(--color-surface, #fff);
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--color-primary, #0047AB);
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
                    box-sizing: border-box;
                }

                .cowork-pin-inner img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .cowork-pick-pin {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 24px;
                    height: 32px;
                }

                .cowork-pick-pin::after {
                    content: '';
                    width: 0;
                    height: 0;
                    border-left: 5px solid transparent;
                    border-right: 5px solid transparent;
                    border-top: 8px solid var(--color-secondary, #FF5B00);
                }

                .cowork-pick-pin-dot {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: var(--color-secondary, #FF5B00);
                    border: 3px solid #fff;
                    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
                    box-sizing: border-box;
                }

                /* Dark mode: invert the raster tiles only — pins stay untouched. */
                [data-theme='dark'] .leaflet-tile-pane {
                    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
                }
            `}</style>
        </>
    );
};

export default CoworkMap;
