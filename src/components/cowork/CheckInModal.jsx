import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, MapPin, LocateFixed, Loader2, Minus, Plus, Coffee, Utensils } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { COWORK_SPOTS } from '../../data/coworkSpots';
import { coworkService } from '../../services/coworkService';
import CoworkMapModal from './CoworkMapModal';

const MENU_OPTIONS = ['good', 'ok', 'basic'];
const WIFI_OPTIONS = ['fast', 'ok', 'slow'];
const DURATION_OPTIONS = [2, 4, 8];

/**
 * Check-in form modal — portal, bottom sheet on mobile (<=768px).
 * Location via 3 tabs: curated venue list / drop-a-pin (nested CoworkMapModal
 * in pickMode) / GPS with a 10s timeout and a graceful error.
 */
const CheckInModal = ({ open, onClose, onSuccess }) => {
    const { t } = useTranslation();

    // Location
    const [tab, setTab] = useState('venue'); // 'venue' | 'pin' | 'gps'
    const [venueId, setVenueId] = useState('');
    const [pinLatLng, setPinLatLng] = useState(null);
    const [pinPickerOpen, setPinPickerOpen] = useState(false);
    const [gpsLatLng, setGpsLatLng] = useState(null);
    const [gpsStatus, setGpsStatus] = useState('idle'); // idle | loading | done | error
    const [placeName, setPlaceName] = useState('');

    // Details
    const [note, setNote] = useState('');
    const [spaces, setSpaces] = useState(null); // null = not specified, else 0-10
    const [menu, setMenu] = useState(null);
    const [wifi, setWifi] = useState(null);
    const [coffee, setCoffee] = useState(false);
    const [food, setFood] = useState(false);
    const [duration, setDuration] = useState(8);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Reset transient state whenever the modal reopens. Venue/amenity choices
    // are deliberately remembered; a stale pin, GPS fix or note must not be.
    useEffect(() => {
        if (open) {
            setError('');
            setSubmitting(false);
            setNote('');
            setPinLatLng(null);
            setGpsLatLng(null);
            setGpsStatus('idle');
        }
    }, [open]);

    // Idempotent body scroll lock — skip if another modal already locked it.
    useEffect(() => {
        if (!open) return undefined;
        if (document.body.style.position === 'fixed') return undefined;
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            window.scrollTo(0, scrollY);
        };
    }, [open]);

    // ESC closes — never mid-publish, and not while the nested pin picker is
    // open (it has its own ESC handler and must close first).
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape' && !submitting && !pinPickerOpen) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, submitting, pinPickerOpen, onClose]);

    const venuesByCity = useMemo(() => {
        const groups = new Map();
        for (const spot of COWORK_SPOTS) {
            if (!groups.has(spot.city)) groups.set(spot.city, []);
            groups.get(spot.city).push(spot);
        }
        return [...groups.entries()];
    }, []);

    if (!open) return null;

    const requestGps = () => {
        if (!navigator.geolocation) {
            setGpsStatus('error');
            return;
        }
        setGpsStatus('loading');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsLatLng([pos.coords.latitude, pos.coords.longitude]);
                setGpsStatus('done');
            },
            () => setGpsStatus('error'),
            { timeout: 10000, enableHighAccuracy: true },
        );
    };

    const resolveLocation = () => {
        if (tab === 'venue') {
            const spot = COWORK_SPOTS.find(s => s.id === venueId);
            if (!spot) return null;
            return { lat: spot.lat, lng: spot.lng, venueName: spot.name, venueId: spot.id, city: spot.city };
        }
        const latlng = tab === 'pin' ? pinLatLng : gpsLatLng;
        if (!Array.isArray(latlng) || latlng.length !== 2) return null;
        return { lat: latlng[0], lng: latlng[1], venueName: placeName, venueId: null, city: null };
    };

    const handleSubmit = async () => {
        const loc = resolveLocation();
        if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng) || !loc.venueName || !loc.venueName.trim()) {
            setError(t('cowork.form.locationRequired'));
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const event = await coworkService.checkIn({
                venueName: loc.venueName.trim(),
                venueId: loc.venueId,
                city: loc.city,
                lat: loc.lat,
                lng: loc.lng,
                note: note.trim().slice(0, 280),
                spaces,
                menu,
                coffee: coffee ? 'yes' : null,
                food: food ? 'yes' : null,
                wifi,
                durationHours: duration,
            });
            if (onSuccess) onSuccess(event);
            onClose();
        } catch (err) {
            console.error('[Cowork] Check-in publish failed:', err);
            setError(t('cowork.form.errorPublish'));
        } finally {
            setSubmitting(false);
        }
    };

    const renderPlaceNameInput = () => (
        <label className="ci-field">
            <span className="ci-label">{t('cowork.form.placeName')}</span>
            <input
                type="text"
                className="ci-input"
                value={placeName}
                maxLength={80}
                onChange={(e) => setPlaceName(e.target.value)}
            />
        </label>
    );

    return createPortal(
        <div
            className="ci-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
        >
            <div className="ci-card" role="dialog" aria-modal="true">
                <div className="ci-header">
                    <h3 className="ci-title">{t('cowork.form.title')}</h3>
                    <button
                        className="ci-close"
                        aria-label={t('common.close')}
                        disabled={submitting}
                        onClick={onClose}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="ci-body">
                    {/* Location tabs */}
                    <div className="ci-tabs">
                        <button
                            className={`ci-tab ${tab === 'venue' ? 'active' : ''}`}
                            onClick={() => setTab('venue')}
                        >
                            {t('cowork.form.venueTab')}
                        </button>
                        <button
                            className={`ci-tab ${tab === 'pin' ? 'active' : ''}`}
                            onClick={() => setTab('pin')}
                        >
                            {t('cowork.form.pinTab')}
                        </button>
                        <button
                            className={`ci-tab ${tab === 'gps' ? 'active' : ''}`}
                            onClick={() => setTab('gps')}
                        >
                            {t('cowork.form.gpsTab')}
                        </button>
                    </div>

                    {tab === 'venue' && (
                        <select
                            className="ci-input"
                            data-testid="cowork-venue-select"
                            value={venueId}
                            onChange={(e) => setVenueId(e.target.value)}
                        >
                            <option value="">{t('cowork.form.venuePlaceholder')}</option>
                            {venuesByCity.map(([city, spots]) => (
                                <optgroup key={city} label={city}>
                                    {spots.map(spot => (
                                        <option key={spot.id} value={spot.id}>{spot.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    )}

                    {tab === 'pin' && (
                        <div className="ci-loc-block">
                            <button className="ci-loc-btn" onClick={() => setPinPickerOpen(true)}>
                                <MapPin size={16} />
                                {t('cowork.form.pinTab')}
                            </button>
                            {Array.isArray(pinLatLng) && (
                                <p className="ci-coords">
                                    <MapPin size={13} />
                                    {pinLatLng[0].toFixed(5)}, {pinLatLng[1].toFixed(5)}
                                </p>
                            )}
                            {renderPlaceNameInput()}
                        </div>
                    )}

                    {tab === 'gps' && (
                        <div className="ci-loc-block">
                            <button
                                className="ci-loc-btn"
                                onClick={requestGps}
                                disabled={gpsStatus === 'loading'}
                            >
                                {gpsStatus === 'loading'
                                    ? <Loader2 size={16} className="ci-spin" />
                                    : <LocateFixed size={16} />}
                                {t('cowork.form.useGps')}
                            </button>
                            {gpsStatus === 'done' && Array.isArray(gpsLatLng) && (
                                <p className="ci-coords">
                                    <MapPin size={13} />
                                    {gpsLatLng[0].toFixed(5)}, {gpsLatLng[1].toFixed(5)}
                                </p>
                            )}
                            {gpsStatus === 'error' && (
                                <p className="ci-error-inline">{t('cowork.form.gpsError')}</p>
                            )}
                            {renderPlaceNameInput()}
                        </div>
                    )}

                    {/* Note */}
                    <label className="ci-field">
                        <span className="ci-label">{t('cowork.form.noteLabel')}</span>
                        <textarea
                            className="ci-input ci-textarea"
                            data-testid="cowork-note-input"
                            placeholder={t('cowork.form.notePlaceholder')}
                            value={note}
                            maxLength={280}
                            rows={3}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <span className="ci-char-count">{note.length}/280</span>
                    </label>

                    {/* Free seats stepper */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.spaces')}</span>
                        <div className="ci-stepper">
                            <button
                                className="ci-stepper-btn"
                                disabled={spaces == null}
                                onClick={() => setSpaces(s => (s == null || s <= 0) ? null : s - 1)}
                            >
                                <Minus size={16} />
                            </button>
                            <span className="ci-stepper-value">
                                {spaces == null ? '—' : spaces >= 10 ? '10+' : spaces}
                            </span>
                            <button
                                className="ci-stepper-btn"
                                disabled={spaces != null && spaces >= 10}
                                onClick={() => setSpaces(s => (s == null ? 0 : Math.min(10, s + 1)))}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Menu segmented */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.menu')}</span>
                        <div className="ci-segmented">
                            {MENU_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    className={`ci-segment ${menu === opt ? 'active' : ''}`}
                                    onClick={() => setMenu(m => (m === opt ? null : opt))}
                                >
                                    {t('cowork.chips.menu_' + opt)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Wifi segmented */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.wifi')}</span>
                        <div className="ci-segmented">
                            {WIFI_OPTIONS.map(opt => (
                                <button
                                    key={opt}
                                    className={`ci-segment ${wifi === opt ? 'active' : ''}`}
                                    onClick={() => setWifi(w => (w === opt ? null : opt))}
                                >
                                    {t('cowork.chips.wifi_' + opt)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Coffee / food pill toggles */}
                    <div className="ci-pills">
                        <button
                            className={`ci-pill ${coffee ? 'active' : ''}`}
                            onClick={() => setCoffee(c => !c)}
                        >
                            <Coffee size={15} />
                            {t('cowork.form.coffee')}
                        </button>
                        <button
                            className={`ci-pill ${food ? 'active' : ''}`}
                            onClick={() => setFood(f => !f)}
                        >
                            <Utensils size={15} />
                            {t('cowork.form.food')}
                        </button>
                    </div>

                    {/* Duration */}
                    <label className="ci-field">
                        <span className="ci-label">{t('cowork.form.duration')}</span>
                        <select
                            className="ci-input"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                        >
                            {DURATION_OPTIONS.map(h => (
                                <option key={h} value={h}>{t('cowork.form.hours', { count: h })}</option>
                            ))}
                        </select>
                    </label>

                    {error && <p className="ci-error">{error}</p>}

                    <button
                        className="ci-submit"
                        data-testid="cowork-submit"
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        {submitting
                            ? <><Loader2 size={16} className="ci-spin" /> {t('cowork.form.publishing')}</>
                            : t('cowork.form.submit')}
                    </button>
                </div>
            </div>

            <CoworkMapModal
                open={pinPickerOpen}
                onClose={() => setPinPickerOpen(false)}
                pickMode
                onPick={(latlng) => setPinLatLng(latlng)}
            />

            <style jsx>{`
                .ci-overlay {
                    position: fixed;
                    inset: 0;
                    /* Above MobileBottomNav's 10000 so the fixed bottom nav
                       never occludes the sheet (or steals taps); the nested
                       pin picker stacks above at 10002. */
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                }

                .ci-card {
                    background: var(--color-surface);
                    border-radius: var(--radius-lg);
                    width: 92vw;
                    max-width: 440px;
                    max-height: 90vh; /* fallback for pre-dvh browsers */
                    max-height: calc(100dvh - 2rem);
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-lg);
                    overflow: hidden;
                }

                .ci-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--color-gray-200);
                    flex-shrink: 0;
                }

                .ci-title {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                }

                .ci-close {
                    display: flex;
                    padding: 4px;
                    border: none;
                    background: none;
                    color: var(--color-gray-500);
                    cursor: pointer;
                }

                .ci-close:hover:not(:disabled) { color: var(--color-gray-900); }
                .ci-close:disabled { opacity: 0.5; cursor: default; }

                .ci-body {
                    padding: 1.25rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .ci-tabs {
                    display: flex;
                    gap: 0.35rem;
                    background: var(--color-gray-100);
                    border-radius: var(--radius-md);
                    padding: 0.25rem;
                }

                .ci-tab {
                    flex: 1;
                    padding: 0.45rem 0.5rem;
                    border: none;
                    background: none;
                    border-radius: var(--radius-sm);
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-gray-500);
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .ci-tab.active {
                    background: var(--color-surface);
                    color: var(--color-primary);
                    box-shadow: var(--shadow-sm);
                }

                .ci-loc-block {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .ci-loc-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.6rem 0.75rem;
                    border: 1.5px dashed var(--color-gray-300, var(--color-gray-200));
                    border-radius: var(--radius-md);
                    background: none;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-primary);
                    cursor: pointer;
                }

                .ci-loc-btn:hover:not(:disabled) { border-color: var(--color-primary); }
                .ci-loc-btn:disabled { opacity: 0.6; cursor: wait; }

                .ci-coords {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--color-gray-500);
                }

                .ci-field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    position: relative;
                }

                .ci-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--color-gray-500);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .ci-input {
                    width: 100%;
                    padding: 0.6rem 0.75rem;
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-family: inherit;
                    background: var(--color-surface);
                    color: var(--color-gray-900);
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.15s;
                }

                .ci-input:focus { border-color: var(--color-primary); }

                .ci-textarea { resize: vertical; }

                .ci-char-count {
                    align-self: flex-end;
                    font-size: 0.7rem;
                    color: var(--color-gray-400, var(--color-gray-500));
                }

                .ci-stepper {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .ci-stepper-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    min-height: 0; /* keep the circle round despite the global
                                      mobile button { min-height: 36px } rule */
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-full);
                    background: var(--color-surface);
                    color: var(--color-gray-600, var(--color-gray-500));
                    cursor: pointer;
                }

                .ci-stepper-btn:hover:not(:disabled) {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }

                .ci-stepper-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                .ci-stepper-value {
                    min-width: 2.5rem;
                    text-align: center;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--color-gray-900);
                }

                .ci-segmented {
                    display: flex;
                    gap: 0.35rem;
                }

                .ci-segment {
                    flex: 1;
                    padding: 0.45rem 0.4rem;
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    font-size: 0.78rem;
                    font-weight: 500;
                    color: var(--color-gray-600, var(--color-gray-500));
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .ci-segment:hover { border-color: var(--color-primary); }

                .ci-segment.active {
                    background: var(--color-primary);
                    border-color: var(--color-primary);
                    color: white;
                }

                .ci-pills {
                    display: flex;
                    gap: 0.5rem;
                }

                .ci-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.45rem 0.9rem;
                    border: 1.5px solid var(--color-gray-200);
                    border-radius: var(--radius-full);
                    background: var(--color-surface);
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--color-gray-600, var(--color-gray-500));
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .ci-pill:hover { border-color: var(--color-secondary); }

                .ci-pill.active {
                    background: var(--color-secondary);
                    border-color: var(--color-secondary);
                    color: white;
                }

                .ci-error,
                .ci-error-inline {
                    margin: 0;
                    font-size: 0.82rem;
                    color: var(--color-error, #EF4444);
                }

                .ci-submit {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    width: 100%;
                    padding: 0.8rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-secondary);
                    color: white;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .ci-submit:hover:not(:disabled) {
                    background: var(--color-secondary-dark, #CC4A00);
                }

                .ci-submit:disabled { opacity: 0.6; cursor: wait; }

                .ci-spin {
                    animation: ci-spin 1s linear infinite;
                }

                @keyframes ci-spin {
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 768px) {
                    .ci-overlay {
                        align-items: flex-end;
                    }

                    .ci-card {
                        width: 100%;
                        max-width: none;
                        max-height: 92vh; /* fallback for pre-dvh browsers */
                        max-height: calc(100dvh - env(safe-area-inset-top, 0px) - 0.5rem);
                        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                    }

                    .ci-body {
                        padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
                    }
                }
            `}</style>
        </div>,
        document.body,
    );
};

export default CheckInModal;
