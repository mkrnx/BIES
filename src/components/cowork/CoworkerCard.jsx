import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Wifi, Coffee, Utensils, Armchair, LogOut, Loader2 } from 'lucide-react';
import { getDisplayName, formatTime } from '../../utils/noteUtils';

const MENU_VALUES = ['good', 'ok', 'basic'];
const WIFI_VALUES = ['fast', 'ok', 'slow'];

/**
 * One coworker in the list: avatar, name, venue (tap to locate on the map),
 * note, amenity chips, and — for the current user — a checkout button.
 */
const CoworkerCard = ({ session, profile, isMe = false, onLocate, onCheckOut, checkingOut = false }) => {
    const { t } = useTranslation();
    const [imgError, setImgError] = useState(false);

    const displayName = getDisplayName(session.pubkey, { [session.pubkey]: profile });
    const initial = ((displayName || '?').trim().charAt(0) || '?').toUpperCase();
    const note = typeof session.note === 'string' && session.note.length > 280
        ? session.note.slice(0, 280) + '…'
        : session.note;

    const chips = [];
    if (session.spaces != null && Number.isFinite(session.spaces)) {
        chips.push({ key: 'seats', Icon: Armchair, label: t('cowork.chips.seats', { count: session.spaces }) });
    }
    if (MENU_VALUES.includes(session.menu)) {
        chips.push({ key: 'menu', Icon: Utensils, label: t('cowork.chips.menu_' + session.menu) });
    }
    if (session.coffee === 'yes') {
        chips.push({ key: 'coffee', Icon: Coffee, label: t('cowork.chips.coffee') });
    }
    if (session.food === 'yes') {
        chips.push({ key: 'food', Icon: Utensils, label: t('cowork.chips.food') });
    }
    if (WIFI_VALUES.includes(session.wifi)) {
        chips.push({ key: 'wifi', Icon: Wifi, label: t('cowork.chips.wifi_' + session.wifi) });
    }

    return (
        <div className={`cw-card ${isMe ? 'me' : ''}`} data-testid={'cowork-card-' + session.pubkey}>
            <div className="cw-top">
                <div className="cw-avatar">
                    {profile?.picture && !imgError
                        ? <img src={profile.picture} alt="" onError={() => setImgError(true)} />
                        : <span>{initial}</span>}
                </div>
                <div className="cw-who">
                    <div className="cw-name-row">
                        <span className="cw-name">{displayName}</span>
                        {isMe && <span className="cw-you-badge">{t('cowork.card.you')}</span>}
                    </div>
                    <button className="cw-venue" onClick={() => onLocate && onLocate(session.pubkey)}>
                        <MapPin size={14} />
                        <span className="cw-venue-text">
                            {session.venueName}
                            {session.city ? ` · ${session.city}` : ''}
                        </span>
                    </button>
                </div>
            </div>

            {note && <p className="cw-note">{note}</p>}

            {chips.length > 0 && (
                <div className="cw-chips">
                    {chips.map(({ key, Icon, label }) => (
                        <span key={key} className="cw-chip">
                            <Icon size={13} />
                            {label}
                        </span>
                    ))}
                </div>
            )}

            <div className="cw-footer">
                <span className="cw-time">
                    {t('cowork.card.checkedIn')} · {formatTime(session.createdAt)}
                </span>
                {isMe && (
                    <button
                        className="cw-checkout"
                        data-testid="cowork-checkout-btn"
                        disabled={checkingOut}
                        onClick={() => onCheckOut && onCheckOut()}
                    >
                        {checkingOut
                            ? <Loader2 size={14} className="cw-spin" />
                            : <LogOut size={14} />}
                        {t('cowork.checkOut')}
                    </button>
                )}
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
                }

                .cw-card.me {
                    border-left: 4px solid var(--color-secondary);
                }

                .cw-top {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .cw-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    overflow: hidden;
                    background: var(--color-gray-100);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    color: var(--color-primary);
                    flex-shrink: 0;
                }

                .cw-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .cw-who {
                    display: flex;
                    flex-direction: column;
                    gap: 0.15rem;
                    min-width: 0;
                }

                .cw-name-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    min-width: 0;
                }

                .cw-name {
                    font-weight: 700;
                    font-size: 0.95rem;
                    color: var(--color-gray-900);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .cw-you-badge {
                    flex-shrink: 0;
                    padding: 0.1rem 0.5rem;
                    border-radius: var(--radius-full);
                    background: var(--color-secondary);
                    color: white;
                    font-size: 0.68rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }

                .cw-venue {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0;
                    border: none;
                    background: none;
                    color: var(--color-primary);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    text-align: left;
                    min-width: 0;
                    min-height: 0; /* opt out of the global mobile button min-height */
                }

                .cw-venue:hover .cw-venue-text { text-decoration: underline; }

                .cw-venue-text {
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

                .cw-footer {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                }

                .cw-time {
                    font-size: 0.78rem;
                    color: var(--color-gray-400, var(--color-gray-500));
                }

                .cw-checkout {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.35rem 0.8rem;
                    border: 1.5px solid var(--color-secondary);
                    border-radius: var(--radius-md);
                    background: none;
                    color: var(--color-secondary);
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .cw-checkout:hover:not(:disabled) {
                    background: var(--color-secondary);
                    color: white;
                }

                .cw-checkout:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }

                .cw-spin {
                    animation: cw-spin 1s linear infinite;
                }

                @keyframes cw-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default CoworkerCard;
