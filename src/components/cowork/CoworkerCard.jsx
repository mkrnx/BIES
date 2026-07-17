import { useTranslation } from 'react-i18next';
import { MapPin, Users, Clock, ChevronRight, Coffee, Utensils, Wifi, Armchair, Tag } from 'lucide-react';

/**
 * Map a server amenity token (e.g. "coffee", "wifi_fast", "menu_good",
 * "seats:6") to a display icon + label. Unknown tokens degrade gracefully to a
 * prettified string so the card never renders a raw machine token.
 */
const AMENITY_META = {
    coffee: { Icon: Coffee, key: 'cowork.chips.coffee', fallback: 'Coffee' },
    food: { Icon: Utensils, key: 'cowork.chips.food', fallback: 'Food' },
    wifi_fast: { Icon: Wifi, key: 'cowork.chips.wifi_fast', fallback: 'Fast wifi' },
    wifi_ok: { Icon: Wifi, key: 'cowork.chips.wifi_ok', fallback: 'OK wifi' },
    wifi_slow: { Icon: Wifi, key: 'cowork.chips.wifi_slow', fallback: 'Slow wifi' },
    menu_good: { Icon: Utensils, key: 'cowork.chips.menu_good', fallback: 'Great menu' },
    menu_ok: { Icon: Utensils, key: 'cowork.chips.menu_ok', fallback: 'OK menu' },
    menu_basic: { Icon: Utensils, key: 'cowork.chips.menu_basic', fallback: 'Basic menu' },
};

export function formatAmenity(token, t) {
    if (typeof token !== 'string' || !token.trim()) return null;
    const raw = token.trim().slice(0, 40);
    const meta = AMENITY_META[raw];
    if (meta) return { Icon: meta.Icon, label: t ? t(meta.key, meta.fallback) : meta.fallback };
    if (raw.startsWith('seats:')) {
        const n = raw.slice(6).replace(/[^0-9]/g, '') || raw.slice(6);
        return { Icon: Armchair, label: t ? t('cowork.chips.seats', { count: Number(n) || n }) : `${n} seats free` };
    }
    return { Icon: Tag, label: raw.replace(/_/g, ' ').replace(/:/g, ' ') };
}

/** "5:30 PM" — the readable clock a session runs until. */
export function formatClock(iso) {
    if (!iso) return '';
    try {
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
    } catch { return ''; }
}

/** "Jul 14, 5:30 PM" — for ended sessions in the Past tab. */
export function formatDayTime(iso) {
    if (!iso) return '';
    try {
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
    } catch { return ''; }
}

/**
 * One cowork session in the list. Title-first (host is secondary), an attendee
 * count badge, venue/location, amenities, and a time line. The whole card is a
 * single clickable target that opens the session detail modal.
 */
const CoworkerCard = ({ session, onOpen }) => {
    const { t } = useTranslation();
    if (!session) return null;

    const hostName = session.host?.name?.trim() || t('cowork.card.communityMember', 'BIES member');
    const count = Number.isFinite(session.attendeeCount) ? session.attendeeCount : 0;
    const ended = session.status === 'ENDED';

    const locationLabel = session.venue?.name
        ? `${session.venue.name}${session.venue.area ? ` · ${session.venue.area}` : ''}`
        : (session.locationName || t('cowork.card.locationTbd', 'Location to be shared'));

    const note = typeof session.note === 'string' && session.note.length > 200
        ? session.note.slice(0, 200) + '…'
        : (session.note || '');

    const amenities = (Array.isArray(session.amenities) ? session.amenities : [])
        .map((a) => formatAmenity(a, t))
        .filter(Boolean)
        .slice(0, 5);

    const timeLabel = ended
        ? t('cowork.card.endedAt', { time: formatDayTime(session.endTime), defaultValue: 'Ended · {{time}}' })
        : session.endTime
            ? t('cowork.card.untilTime', { time: formatClock(session.endTime), defaultValue: 'Until {{time}}' })
            : t('cowork.card.ongoing', 'Ongoing');

    const open = () => onOpen && onOpen(session.id);

    return (
        <div
            className={`cw-card ${ended ? 'ended' : ''}`}
            role="button"
            tabIndex={0}
            data-testid={'cowork-card-' + session.id}
            onClick={open}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
            }}
        >
            <div className="cw-head">
                <div className="cw-titles">
                    <span className="cw-title">{session.title}</span>
                    <span className="cw-host">{t('cowork.card.hostedBy', { name: hostName, defaultValue: 'Hosted by {{name}}' })}</span>
                </div>
                <span className="cw-count" title={t('cowork.card.attendingCount', { count, defaultValue: '{{count}} attending' })}>
                    <Users size={14} />
                    {t('cowork.card.attendingCount', { count, defaultValue: '{{count}} attending' })}
                </span>
            </div>

            <div className="cw-loc">
                <MapPin size={14} />
                <span className="cw-loc-text">{locationLabel}</span>
            </div>

            {note && <p className="cw-note">{note}</p>}

            {amenities.length > 0 && (
                <div className="cw-chips">
                    {amenities.map(({ Icon, label }, i) => (
                        <span key={i} className="cw-chip">
                            <Icon size={13} />
                            {label}
                        </span>
                    ))}
                </div>
            )}

            <div className="cw-foot">
                <span className="cw-time">
                    <Clock size={13} />
                    {timeLabel}
                </span>
                <span className="cw-open">
                    {t('cowork.card.viewDetails', 'View details')}
                    <ChevronRight size={15} />
                </span>
            </div>

            <style jsx>{`
                .cw-card {
                    background: var(--color-surface);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    padding: 1rem 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                    box-shadow: var(--shadow-sm);
                    cursor: pointer;
                    text-align: left;
                    transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
                    outline: none;
                }

                .cw-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                    border-color: var(--color-secondary);
                }

                .cw-card:focus-visible {
                    border-color: var(--color-secondary);
                    box-shadow: 0 0 0 3px rgba(255, 91, 0, 0.25);
                }

                .cw-card.ended {
                    opacity: 0.92;
                    border-left: 4px solid var(--color-gray-300, var(--color-gray-200));
                }

                .cw-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 0.75rem;
                }

                .cw-titles {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                    min-width: 0;
                }

                .cw-title {
                    font-weight: 700;
                    font-size: 1.02rem;
                    line-height: 1.25;
                    color: var(--color-gray-900);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .cw-host {
                    font-size: 0.82rem;
                    color: var(--color-gray-500);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .cw-count {
                    flex-shrink: 0;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: var(--radius-full);
                    background: var(--color-gray-100);
                    color: var(--color-gray-600, var(--color-gray-500));
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .cw-loc {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    color: var(--color-primary);
                    font-size: 0.85rem;
                    font-weight: 500;
                    min-width: 0;
                }

                .cw-loc-text {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .cw-note {
                    margin: 0;
                    font-size: 0.875rem;
                    line-height: 1.5;
                    color: var(--color-gray-600, var(--color-gray-500));
                    white-space: pre-wrap;
                    word-break: break-word;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .cw-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.4rem;
                }

                .cw-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.2rem 0.6rem;
                    border-radius: var(--radius-full);
                    background: var(--color-gray-100);
                    color: var(--color-gray-600, var(--color-gray-500));
                    font-size: 0.75rem;
                    font-weight: 500;
                }

                .cw-foot {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                    margin-top: 0.1rem;
                }

                .cw-time {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    font-size: 0.78rem;
                    color: var(--color-gray-400, var(--color-gray-500));
                }

                .cw-open {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.15rem;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--color-secondary);
                }
            `}</style>
        </div>
    );
};

export default CoworkerCard;
