import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, MapPin, Loader2, Minus, Plus, Coffee, Utensils,
    Search, ChevronDown, Clock, Check,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { coworkService } from '../../services/coworkService';
import CoworkMapModal from './CoworkMapModal';

const MENU_OPTIONS = ['good', 'ok', 'basic'];
const WIFI_OPTIONS = ['fast', 'ok', 'slow'];

// Duration slider: 30 min → 8 h in 30-min steps.
const DURATION_MIN = 30;
const DURATION_MAX = 480;
const DURATION_STEP = 30;
const DURATION_DEFAULT = 120;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * Create a server-backed cowork session.
 *
 * Collects: a required TITLE, a location (either a persisted venue picked from
 * the server list — grouped by area, searchable, with inline "add a new spot" —
 * OR a free-text "Where are you?" + drop-a-pin), a DURATION slider that maps to
 * durationMinutes, a note and amenity pills. Submit builds
 *   { title, venueId? | locationName+lat+lng, note, amenities, durationMinutes }
 * and hands it to the create action (onSubmit prop, else coworkService.create).
 *
 * Portal + idempotent scroll lock + ESC + z-index 10001 preserved; the nested
 * pin picker (CoworkMapModal) stacks above at 10002.
 */
const CheckInModal = ({ open, onClose, onSuccess, onSubmit }) => {
    const { t } = useTranslation();

    // ── Core ──────────────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState(DURATION_DEFAULT); // minutes
    const [note, setNote] = useState('');

    // ── Venue selector ────────────────────────────────────────────────────
    const [venues, setVenues] = useState([]);
    const [venuesLoading, setVenuesLoading] = useState(false);
    const [venuesError, setVenuesError] = useState(false);
    const [venueId, setVenueId] = useState('');
    const [venueOpen, setVenueOpen] = useState(false);
    const [venueSearch, setVenueSearch] = useState('');

    // Inline "add a new spot"
    const [addingVenue, setAddingVenue] = useState(false);
    const [newVenueName, setNewVenueName] = useState('');
    const [newVenueArea, setNewVenueArea] = useState('');
    const [newVenuePin, setNewVenuePin] = useState(null); // [lat, lng] | null
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addError, setAddError] = useState('');

    // ── Free-text location + pin (fallback when the spot isn't listed) ──────
    const [locationName, setLocationName] = useState('');
    const [pinLatLng, setPinLatLng] = useState(null); // [lat, lng] | null

    // Shared pin picker; routes the pick to the session or the new venue.
    const [pinTarget, setPinTarget] = useState(null); // null | 'session' | 'venue'

    // ── Amenities ─────────────────────────────────────────────────────────
    const [spaces, setSpaces] = useState(null); // null = unspecified, else 0-10
    const [menu, setMenu] = useState(null);
    const [wifi, setWifi] = useState(null);
    const [coffee, setCoffee] = useState(false);
    const [food, setFood] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fresh form every time the modal opens — a create dialog should never
    // resurrect a stale draft.
    useEffect(() => {
        if (!open) return;
        setError('');
        setSubmitting(false);
        setTitle('');
        setDuration(DURATION_DEFAULT);
        setNote('');
        setVenueId('');
        setVenueOpen(false);
        setVenueSearch('');
        setAddingVenue(false);
        setNewVenueName('');
        setNewVenueArea('');
        setNewVenuePin(null);
        setAddError('');
        setLocationName('');
        setPinLatLng(null);
        setPinTarget(null);
        setSpaces(null);
        setMenu(null);
        setWifi(null);
        setCoffee(false);
        setFood(false);
    }, [open]);

    // Load the server venue list on open.
    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;
        setVenuesLoading(true);
        setVenuesError(false);
        coworkService.listVenues()
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res) ? res : (res?.data || []);
                setVenues(list);
                setVenuesLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[Cowork] Load venues failed:', err);
                setVenuesError(true);
                setVenuesLoading(false);
            });
        return () => { cancelled = true; };
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

    // ESC: close the venue dropdown first, never mid-publish, and let the
    // nested pin picker (own ESC handler) win while it is open.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (submitting || pinTarget !== null) return;
            if (venueOpen) {
                setVenueOpen(false);
                return;
            }
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, submitting, pinTarget, venueOpen, onClose]);

    // Group the (optionally filtered) venue list by area for the dropdown.
    const filteredGroups = useMemo(() => {
        const q = venueSearch.trim().toLowerCase();
        const filtered = q
            ? venues.filter((v) =>
                (v.name || '').toLowerCase().includes(q) ||
                (v.area || '').toLowerCase().includes(q))
            : venues;
        const map = new Map();
        for (const v of filtered) {
            const key = v.area || '';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(v);
        }
        return [...map.entries()].map(([area, vs]) => ({ area, venues: vs }));
    }, [venues, venueSearch]);

    const selectedVenue = useMemo(
        () => venues.find((v) => v.id === venueId) || null,
        [venues, venueId],
    );

    // Derived duration labels.
    const endsAtLabel = timeFmt.format(new Date(Date.now() + duration * 60000));
    const durationLabel = useMemo(() => {
        if (duration < 60) return t('cowork.form.durMinutes', { defaultValue: '{{count}} min', count: duration });
        const h = Math.floor(duration / 60);
        const m = duration % 60;
        const hLabel = t('cowork.form.durHours', { defaultValue: '{{count}} h', count: h });
        if (m === 0) return hLabel;
        return `${hLabel} ${t('cowork.form.durMinutes', { defaultValue: '{{count}} min', count: m })}`;
    }, [duration, t]);

    if (!open) return null;

    const selectVenue = (id) => {
        setVenueId(id);
        // Venue defines the location — clear the free-text/pin path.
        setLocationName('');
        setPinLatLng(null);
        setVenueOpen(false);
        setVenueSearch('');
        setAddingVenue(false);
    };

    const clearVenue = () => setVenueId('');

    const handleAddVenue = async () => {
        const name = newVenueName.trim();
        if (!name) {
            setAddError(t('cowork.form.venueNameRequired', { defaultValue: 'Name the spot first.' }));
            return;
        }
        setAddSubmitting(true);
        setAddError('');
        try {
            const payload = { name, area: newVenueArea.trim() };
            if (Array.isArray(newVenuePin) && newVenuePin.length === 2) {
                payload.lat = newVenuePin[0];
                payload.lng = newVenuePin[1];
            }
            const venue = await coworkService.addVenue(payload);

            // The server reused an existing spot with the same name (empty/duplicate
            // area collapses distinct real places onto the (name, area) key). If the
            // user dropped a pin for what is clearly a different location, selecting
            // the returned venue would silently attach their session to the wrong
            // coordinates. Warn and keep the form so they can add an area to list it
            // as a separate spot, rather than dropping their pin.
            const droppedPin = Array.isArray(newVenuePin) && newVenuePin.length === 2;
            if (venue.reused && droppedPin
                && Number.isFinite(venue.lat) && Number.isFinite(venue.lng)
                && (Math.abs(venue.lat - newVenuePin[0]) > 0.05
                    || Math.abs(venue.lng - newVenuePin[1]) > 0.05)) {
                setAddError(t('cowork.form.venueExistsElsewhere', {
                    defaultValue: 'A spot with this name already exists. Add an area/neighborhood to list this as a separate place.',
                }));
                return;
            }

            setVenues((prev) => (prev.some((v) => v.id === venue.id) ? prev : [...prev, venue]));
            setNewVenueName('');
            setNewVenueArea('');
            setNewVenuePin(null);
            selectVenue(venue.id);
        } catch (err) {
            console.error('[Cowork] Add venue failed:', err);
            setAddError(t('cowork.form.addVenueError', { defaultValue: 'Could not add the spot. Try again.' }));
        } finally {
            setAddSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError(t('cowork.form.titleRequired', { defaultValue: 'Give your session a title.' }));
            return;
        }
        const hasVenue = !!venueId;
        const trimmedLoc = locationName.trim();
        const hasPin = Array.isArray(pinLatLng)
            && Number.isFinite(pinLatLng[0]) && Number.isFinite(pinLatLng[1]);
        if (!hasVenue && (!trimmedLoc || !hasPin)) {
            setError(t('cowork.form.locationRequired', {
                defaultValue: 'Pick a venue, or drop a pin and name the place.',
            }));
            return;
        }

        const amenities = [];
        if (coffee) amenities.push('coffee');
        if (food) amenities.push('food');
        if (wifi) amenities.push(`wifi_${wifi}`);
        if (menu) amenities.push(`menu_${menu}`);
        if (spaces != null) amenities.push(`seats:${spaces}`);

        const payload = {
            title: trimmedTitle,
            note: note.trim().slice(0, 280),
            amenities,
            durationMinutes: duration,
        };
        if (hasVenue) {
            payload.venueId = venueId;
        } else {
            payload.locationName = trimmedLoc;
            payload.lat = pinLatLng[0];
            payload.lng = pinLatLng[1];
        }

        setSubmitting(true);
        setError('');
        try {
            const create = (typeof onSubmit === 'function' && onSubmit)
                || coworkService.create
                || coworkService.checkIn;
            const session = await create(payload);
            if (onSuccess) onSuccess(session);
            onClose();
        } catch (err) {
            console.error('[Cowork] Create session failed:', err);
            setError(t('cowork.form.errorPublish', {
                defaultValue: 'Could not create your session. Please try again.',
            }));
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div
            className="ci-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) onClose();
            }}
        >
            <div className="ci-card" role="dialog" aria-modal="true">
                <div className="ci-header">
                    <h3 className="ci-title">
                        {t('cowork.form.newSession', { defaultValue: 'Start a cowork session' })}
                    </h3>
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
                    {/* Title */}
                    <label className="ci-field">
                        <span className="ci-label">
                            {t('cowork.form.sessionTitle', { defaultValue: 'Session title' })}
                        </span>
                        <input
                            type="text"
                            className="ci-input"
                            data-testid="cowork-title-input"
                            placeholder={t('cowork.form.titlePlaceholder', { defaultValue: 'e.g. Morning deep work' })}
                            value={title}
                            maxLength={140}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>

                    {/* Venue selector */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.venueLabel', { defaultValue: 'Venue' })}</span>
                        <div className="ci-combo">
                            <button
                                type="button"
                                className="ci-combo-trigger"
                                data-testid="cowork-venue-select"
                                aria-expanded={venueOpen}
                                onClick={() => setVenueOpen((o) => !o)}
                            >
                                <span className={selectedVenue ? 'ci-combo-value' : 'ci-combo-placeholder'}>
                                    {selectedVenue
                                        ? (selectedVenue.area
                                            ? `${selectedVenue.name} · ${selectedVenue.area}`
                                            : selectedVenue.name)
                                        : t('cowork.form.venuePlaceholder', { defaultValue: 'Choose a spot...' })}
                                </span>
                                <ChevronDown size={16} className={`ci-combo-chev ${venueOpen ? 'open' : ''}`} />
                            </button>

                            {venueOpen && (
                                <div className="ci-combo-panel">
                                    <div className="ci-combo-searchrow">
                                        <Search size={15} className="ci-combo-searchicon" />
                                        <input
                                            type="text"
                                            className="ci-combo-search"
                                            data-testid="cowork-venue-search"
                                            placeholder={t('cowork.form.venueSearch', { defaultValue: 'Search venues...' })}
                                            value={venueSearch}
                                            autoFocus
                                            onChange={(e) => setVenueSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="ci-combo-list">
                                        {venuesLoading && (
                                            <p className="ci-combo-empty">
                                                <Loader2 size={14} className="ci-spin" />
                                                {t('common.loading', { defaultValue: 'Loading...' })}
                                            </p>
                                        )}
                                        {!venuesLoading && venuesError && (
                                            <p className="ci-combo-empty">
                                                {t('cowork.form.venuesError', { defaultValue: 'Could not load venues.' })}
                                            </p>
                                        )}
                                        {!venuesLoading && !venuesError && filteredGroups.length === 0 && (
                                            <p className="ci-combo-empty">
                                                {venues.length === 0
                                                    ? t('cowork.form.noVenues', { defaultValue: 'No venues yet — add the first one below.' })
                                                    : t('cowork.form.noMatches', { defaultValue: 'No matches.' })}
                                            </p>
                                        )}
                                        {!venuesLoading && filteredGroups.map((group) => (
                                            <div key={group.area || '__other'} className="ci-combo-group">
                                                <p className="ci-combo-group-label">
                                                    {group.area || t('cowork.form.areaOther', { defaultValue: 'Other' })}
                                                </p>
                                                {group.venues.map((v) => (
                                                    <button
                                                        key={v.id}
                                                        type="button"
                                                        className={`ci-combo-option ${v.id === venueId ? 'selected' : ''}`}
                                                        data-testid={`cowork-venue-option-${v.id}`}
                                                        onClick={() => selectVenue(v.id)}
                                                    >
                                                        <span className="ci-combo-option-name">{v.name}</span>
                                                        {v.id === venueId && <Check size={14} />}
                                                    </button>
                                                ))}
                                            </div>
                                        ))}
                                    </div>

                                    {!addingVenue ? (
                                        <button
                                            type="button"
                                            className="ci-combo-add"
                                            data-testid="cowork-add-venue-toggle"
                                            onClick={() => {
                                                setAddingVenue(true);
                                                setAddError('');
                                                if (!newVenueName && venueSearch.trim()) setNewVenueName(venueSearch.trim());
                                            }}
                                        >
                                            <Plus size={15} />
                                            {t('cowork.form.addSpot', { defaultValue: 'Add a new spot' })}
                                        </button>
                                    ) : (
                                        <div className="ci-add-form">
                                            <input
                                                type="text"
                                                className="ci-input"
                                                data-testid="cowork-add-venue-name"
                                                placeholder={t('cowork.form.spotName', { defaultValue: 'Spot name (required)' })}
                                                value={newVenueName}
                                                maxLength={120}
                                                onChange={(e) => setNewVenueName(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="ci-input"
                                                data-testid="cowork-add-venue-area"
                                                placeholder={t('cowork.form.spotArea', { defaultValue: 'Area / neighborhood (optional)' })}
                                                value={newVenueArea}
                                                maxLength={80}
                                                onChange={(e) => setNewVenueArea(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="ci-loc-btn"
                                                onClick={() => setPinTarget('venue')}
                                            >
                                                <MapPin size={15} />
                                                {Array.isArray(newVenuePin)
                                                    ? `${newVenuePin[0].toFixed(4)}, ${newVenuePin[1].toFixed(4)}`
                                                    : t('cowork.form.pinOptional', { defaultValue: 'Drop a pin (optional)' })}
                                            </button>
                                            {addError && <p className="ci-error-inline">{addError}</p>}
                                            <div className="ci-add-actions">
                                                <button
                                                    type="button"
                                                    className="ci-btn-ghost"
                                                    onClick={() => {
                                                        setAddingVenue(false);
                                                        setAddError('');
                                                    }}
                                                >
                                                    {t('common.cancel', { defaultValue: 'Cancel' })}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="ci-btn-primary"
                                                    data-testid="cowork-add-venue-submit"
                                                    disabled={addSubmitting || !newVenueName.trim()}
                                                    onClick={handleAddVenue}
                                                >
                                                    {addSubmitting
                                                        ? <Loader2 size={14} className="ci-spin" />
                                                        : <Plus size={14} />}
                                                    {t('cowork.form.addSpotBtn', { defaultValue: 'Add spot' })}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Free-text location + pin (used when the spot isn't listed) */}
                    <div className="ci-divider">
                        <span>{t('cowork.form.orLabel', { defaultValue: 'or tell us where you are' })}</span>
                    </div>

                    <label className="ci-field">
                        <span className="ci-label">{t('cowork.form.placeName', { defaultValue: 'Where are you?' })}</span>
                        <input
                            type="text"
                            className="ci-input ci-input-loc"
                            data-testid="cowork-location-input"
                            placeholder={t('cowork.form.placePlaceholder', { defaultValue: 'Name the place, room or corner' })}
                            value={locationName}
                            maxLength={80}
                            onChange={(e) => {
                                setLocationName(e.target.value);
                                if (e.target.value.trim()) clearVenue();
                            }}
                        />
                    </label>

                    <div className="ci-loc-block">
                        <button
                            type="button"
                            className="ci-loc-btn"
                            data-testid="cowork-drop-pin"
                            onClick={() => setPinTarget('session')}
                        >
                            <MapPin size={16} />
                            {t('cowork.form.pinTab', { defaultValue: 'Drop a pin' })}
                        </button>
                        {Array.isArray(pinLatLng) && (
                            <p className="ci-coords">
                                <MapPin size={13} />
                                {pinLatLng[0].toFixed(5)}, {pinLatLng[1].toFixed(5)}
                            </p>
                        )}
                    </div>

                    {/* Duration slider */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.duration', { defaultValue: "I'll be here" })}</span>
                        <div className="ci-duration-head">
                            <span className="ci-duration-until">
                                <Clock size={15} />
                                {t('cowork.form.until', { defaultValue: 'until {{time}}', time: endsAtLabel })}
                            </span>
                            <span className="ci-duration-for">{durationLabel}</span>
                        </div>
                        <input
                            type="range"
                            className="ci-range"
                            data-testid="cowork-duration-slider"
                            min={DURATION_MIN}
                            max={DURATION_MAX}
                            step={DURATION_STEP}
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                        />
                        <div className="ci-range-hints">
                            <span>{t('cowork.form.durMinShort', { defaultValue: '30 min' })}</span>
                            <span>{t('cowork.form.durMaxShort', { defaultValue: '8 h' })}</span>
                        </div>
                    </div>

                    {/* Note */}
                    <label className="ci-field">
                        <span className="ci-label">{t('cowork.form.noteLabel', { defaultValue: 'Say hi / describe the spot' })}</span>
                        <textarea
                            className="ci-input ci-textarea"
                            data-testid="cowork-note-input"
                            placeholder={t('cowork.form.notePlaceholder', { defaultValue: 'Come join me! Great coffee, plenty of outlets...' })}
                            value={note}
                            maxLength={280}
                            rows={3}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <span className="ci-char-count">{note.length}/280</span>
                    </label>

                    {/* Free seats stepper */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.spaces', { defaultValue: 'Free seats' })}</span>
                        <div className="ci-stepper">
                            <button
                                type="button"
                                className="ci-stepper-btn"
                                disabled={spaces == null}
                                onClick={() => setSpaces((s) => (s == null || s <= 0) ? null : s - 1)}
                            >
                                <Minus size={16} />
                            </button>
                            <span className="ci-stepper-value">
                                {spaces == null ? '—' : spaces >= 10 ? '10+' : spaces}
                            </span>
                            <button
                                type="button"
                                className="ci-stepper-btn"
                                disabled={spaces != null && spaces >= 10}
                                onClick={() => setSpaces((s) => (s == null ? 0 : Math.min(10, s + 1)))}
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Menu segmented */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.menu', { defaultValue: 'Menu' })}</span>
                        <div className="ci-segmented">
                            {MENU_OPTIONS.map((opt) => (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`ci-segment ${menu === opt ? 'active' : ''}`}
                                    onClick={() => setMenu((m) => (m === opt ? null : opt))}
                                >
                                    {t(`cowork.chips.menu_${opt}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Wifi segmented */}
                    <div className="ci-field">
                        <span className="ci-label">{t('cowork.form.wifi', { defaultValue: 'Internet' })}</span>
                        <div className="ci-segmented">
                            {WIFI_OPTIONS.map((opt) => (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`ci-segment ${wifi === opt ? 'active' : ''}`}
                                    onClick={() => setWifi((w) => (w === opt ? null : opt))}
                                >
                                    {t(`cowork.chips.wifi_${opt}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Coffee / food pill toggles */}
                    <div className="ci-pills">
                        <button
                            type="button"
                            className={`ci-pill ${coffee ? 'active' : ''}`}
                            onClick={() => setCoffee((c) => !c)}
                        >
                            <Coffee size={15} />
                            {t('cowork.form.coffee', { defaultValue: 'Coffee' })}
                        </button>
                        <button
                            type="button"
                            className={`ci-pill ${food ? 'active' : ''}`}
                            onClick={() => setFood((f) => !f)}
                        >
                            <Utensils size={15} />
                            {t('cowork.form.food', { defaultValue: 'Food' })}
                        </button>
                    </div>

                    {error && <p className="ci-error">{error}</p>}

                    <button
                        type="button"
                        className="ci-submit"
                        data-testid="cowork-submit"
                        disabled={submitting}
                        onClick={handleSubmit}
                    >
                        {submitting
                            ? <><Loader2 size={16} className="ci-spin" /> {t('cowork.form.publishing', { defaultValue: 'Creating...' })}</>
                            : t('cowork.form.createSubmit', { defaultValue: 'Start session' })}
                    </button>
                </div>
            </div>

            <CoworkMapModal
                open={pinTarget !== null}
                onClose={() => setPinTarget(null)}
                pickMode
                onPick={(latlng) => {
                    if (pinTarget === 'venue') {
                        setNewVenuePin(latlng);
                    } else {
                        setPinLatLng(latlng);
                        clearVenue();
                    }
                }}
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
                    color: var(--color-gray-900);
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
                    /* gray-300 (not 200) so the border stays visible against the
                       dark-mode surface — fixes the invisible input. */
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    font-size: 0.875rem;
                    font-family: inherit;
                    background: var(--color-surface);
                    color: var(--color-gray-900);
                    outline: none;
                    box-sizing: border-box;
                    transition: border-color 0.15s;
                }

                .ci-input::placeholder { color: var(--color-gray-400); }
                .ci-input:focus { border-color: var(--color-primary); }

                /* The "Where are you?" field — an extra-visible outline. */
                .ci-input-loc {
                    border-color: var(--color-gray-300);
                    background: var(--color-surface);
                    color: var(--color-gray-900);
                }

                .ci-textarea { resize: vertical; }

                .ci-char-count {
                    align-self: flex-end;
                    font-size: 0.7rem;
                    color: var(--color-gray-400);
                }

                /* ── Venue combobox ─────────────────────────────────────── */
                .ci-combo { position: relative; }

                .ci-combo-trigger {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.6rem 0.75rem;
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    font-size: 0.875rem;
                    font-family: inherit;
                    text-align: left;
                    cursor: pointer;
                    transition: border-color 0.15s;
                }

                .ci-combo-trigger:hover { border-color: var(--color-primary); }
                .ci-combo-trigger[aria-expanded="true"] { border-color: var(--color-primary); }

                .ci-combo-value { color: var(--color-gray-900); }
                .ci-combo-placeholder { color: var(--color-gray-400); }

                .ci-combo-chev {
                    flex-shrink: 0;
                    color: var(--color-gray-500);
                    transition: transform 0.15s;
                }
                .ci-combo-chev.open { transform: rotate(180deg); }

                .ci-combo-panel {
                    margin-top: 0.4rem;
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    box-shadow: var(--shadow-md);
                    overflow: hidden;
                }

                .ci-combo-searchrow {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.5rem 0.65rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }

                .ci-combo-searchicon {
                    flex-shrink: 0;
                    color: var(--color-gray-400);
                }

                .ci-combo-search {
                    flex: 1;
                    border: none;
                    background: none;
                    outline: none;
                    font-size: 0.85rem;
                    font-family: inherit;
                    color: var(--color-gray-900);
                }
                .ci-combo-search::placeholder { color: var(--color-gray-400); }

                .ci-combo-list {
                    max-height: 190px;
                    overflow-y: auto;
                }

                .ci-combo-group { padding: 0.25rem 0; }

                .ci-combo-group-label {
                    margin: 0;
                    padding: 0.3rem 0.75rem 0.15rem;
                    font-size: 0.68rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-gray-400);
                }

                .ci-combo-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.5rem 0.75rem;
                    border: none;
                    background: none;
                    font-size: 0.85rem;
                    font-family: inherit;
                    text-align: left;
                    color: var(--color-gray-900);
                    cursor: pointer;
                }

                .ci-combo-option:hover { background: var(--color-gray-100); }
                .ci-combo-option.selected { color: var(--color-primary); font-weight: 600; }
                .ci-combo-option-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .ci-combo-empty {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin: 0;
                    padding: 0.75rem;
                    font-size: 0.82rem;
                    color: var(--color-gray-500);
                }

                .ci-combo-add {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    width: 100%;
                    padding: 0.6rem 0.75rem;
                    border: none;
                    border-top: 1px solid var(--color-gray-200);
                    background: none;
                    font-size: 0.85rem;
                    font-weight: 600;
                    font-family: inherit;
                    color: var(--color-primary);
                    cursor: pointer;
                }
                .ci-combo-add:hover { background: var(--color-gray-100); }

                .ci-add-form {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 0.65rem 0.75rem;
                    border-top: 1px solid var(--color-gray-200);
                }

                .ci-add-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                }

                .ci-btn-ghost {
                    padding: 0.45rem 0.8rem;
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--color-gray-600, var(--color-gray-500));
                    cursor: pointer;
                }
                .ci-btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

                .ci-btn-primary {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.45rem 0.8rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-primary);
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: white;
                    cursor: pointer;
                }
                .ci-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

                /* ── Divider ────────────────────────────────────────────── */
                .ci-divider {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin: -0.15rem 0;
                }
                .ci-divider::before,
                .ci-divider::after {
                    content: '';
                    flex: 1;
                    height: 1px;
                    background: var(--color-gray-200);
                }
                .ci-divider span {
                    font-size: 0.72rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--color-gray-400);
                }

                /* ── Location block ─────────────────────────────────────── */
                .ci-loc-block {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .ci-loc-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.6rem 0.75rem;
                    border: 1.5px dashed var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: none;
                    font-size: 0.85rem;
                    font-weight: 600;
                    font-family: inherit;
                    color: var(--color-primary);
                    cursor: pointer;
                }

                .ci-loc-btn:hover:not(:disabled) { border-color: var(--color-primary); }

                .ci-coords {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--color-gray-500);
                }

                /* ── Duration slider ────────────────────────────────────── */
                .ci-duration-head {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    gap: 0.5rem;
                }

                .ci-duration-until {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--color-gray-900);
                }

                .ci-duration-for {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--color-gray-500);
                }

                .ci-range {
                    width: 100%;
                    accent-color: var(--color-primary);
                    cursor: pointer;
                }

                .ci-range-hints {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.7rem;
                    color: var(--color-gray-400);
                }

                /* ── Steppers / segments / pills ────────────────────────── */
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
                    border: 1.5px solid var(--color-gray-300);
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
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-md);
                    background: var(--color-surface);
                    font-size: 0.78rem;
                    font-weight: 500;
                    font-family: inherit;
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
                    border: 1.5px solid var(--color-gray-300);
                    border-radius: var(--radius-full);
                    background: var(--color-surface);
                    font-size: 0.8rem;
                    font-weight: 500;
                    font-family: inherit;
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

                .ci-spin { animation: ci-spin 1s linear infinite; }

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
