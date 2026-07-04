import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, Maximize2, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCoworkSessions } from '../hooks/useCoworkSessions';
import { coworkService } from '../services/coworkService';
import CoworkMap from '../components/cowork/CoworkMap';
import CoworkMapModal from '../components/cowork/CoworkMapModal';
import CheckInModal from '../components/cowork/CheckInModal';
import CoworkerCard from '../components/cowork/CoworkerCard';

/**
 * /cowork — who's coworking where across the BIES network.
 * Map thumbnail (expands to a fullscreen navigable map) + live coworker list.
 * Check-ins are pure Nostr, broadcast to the private BIES relay only.
 */
const Cowork = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { sessions, profiles, loading, addOptimistic } = useCoworkSessions();

    const [showCheckIn, setShowCheckIn] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapFocusPubkey, setMapFocusPubkey] = useState(null);
    const [checkoutError, setCheckoutError] = useState('');

    const mySession = sessions.find(s => s.pubkey === user?.nostrPubkey);

    const openMap = (focusPubkey = null) => {
        setMapFocusPubkey(focusPubkey);
        setShowMap(true);
    };

    const handleCheckOut = async () => {
        if (!window.confirm(t('cowork.confirmCheckout'))) return;
        setCheckoutError('');
        try {
            const event = await coworkService.checkOut();
            addOptimistic(event);
        } catch (err) {
            // Keep the session visible — never optimistically remove on failure.
            console.error('[Cowork] Check-out publish failed:', err);
            setCheckoutError(t('cowork.form.errorPublish'));
        }
    };

    return (
        <div className="cowork-page" data-testid="cowork-page">
            {/* Header */}
            <div className="cw-header">
                <div className="cw-title-block">
                    <Coffee size={26} className="cw-title-icon" />
                    <h1>{t('cowork.title')}</h1>
                </div>
                <span className="cw-count-pill">
                    {t('cowork.activeCount', { count: sessions.length })}
                </span>
            </div>

            {/* Map thumbnail (non-interactive, expands to fullscreen) */}
            <div className="cw-map-thumb">
                <CoworkMap sessions={sessions} profiles={profiles} height="200px" />
                <button
                    className="cw-map-expand"
                    data-testid="cowork-map-thumbnail"
                    aria-label={t('cowork.expandMap')}
                    onClick={() => openMap(null)}
                />
                <span className="cw-map-badge" aria-hidden="true">
                    <Maximize2 size={15} />
                </span>
            </div>

            {/* CTA / your check-in banner */}
            {mySession ? (
                <div className="cw-my-banner">
                    <span className="cw-my-text">
                        {t('cowork.yourCheckIn', { venue: mySession.venueName })}
                    </span>
                    <button className="cw-banner-checkout" onClick={handleCheckOut}>
                        <LogOut size={15} />
                        {t('cowork.checkOut')}
                    </button>
                </div>
            ) : (
                <button
                    className="cw-checkin-cta"
                    data-testid="cowork-checkin-btn"
                    onClick={() => setShowCheckIn(true)}
                >
                    <Coffee size={18} />
                    {t('cowork.checkIn')}
                </button>
            )}
            {checkoutError && <p className="cw-error">{checkoutError}</p>}

            {/* Coworker list */}
            <div className="cw-list" data-testid="cowork-list">
                {sessions.map(session => (
                    <CoworkerCard
                        key={session.pubkey}
                        session={session}
                        profile={profiles[session.pubkey]}
                        isMe={session.pubkey === user?.nostrPubkey}
                        onLocate={(pk) => openMap(pk)}
                        onCheckOut={handleCheckOut}
                    />
                ))}
            </div>

            {loading && sessions.length === 0 && (
                <div className="cw-loading">
                    <Loader2 size={28} className="cw-spin" />
                </div>
            )}

            {!loading && sessions.length === 0 && (
                <div className="cw-empty" data-testid="cowork-empty">
                    <Coffee size={48} className="cw-empty-icon" />
                    <h3>{t('cowork.emptyTitle')}</h3>
                    <p>{t('cowork.emptyBody')}</p>
                    <button className="cw-empty-cta" onClick={() => setShowCheckIn(true)}>
                        <Coffee size={16} />
                        {t('cowork.checkIn')}
                    </button>
                </div>
            )}

            <CheckInModal
                open={showCheckIn}
                onClose={() => setShowCheckIn(false)}
                onSuccess={(evt) => {
                    addOptimistic(evt);
                    setShowCheckIn(false);
                }}
            />

            <CoworkMapModal
                open={showMap}
                onClose={() => {
                    setShowMap(false);
                    setMapFocusPubkey(null);
                }}
                sessions={sessions}
                profiles={profiles}
                focusPubkey={mapFocusPubkey}
            />

            <style jsx>{`
                .cowork-page {
                    max-width: 720px;
                    width: 100%;
                    margin: 0 auto;
                    padding: 2rem 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .cw-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                }

                .cw-title-block {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                }

                .cw-title-block h1 {
                    margin: 0;
                    font-size: 1.6rem;
                }

                .cw-title-icon {
                    color: var(--color-secondary);
                    flex-shrink: 0;
                }

                .cw-count-pill {
                    flex-shrink: 0;
                    padding: 0.25rem 0.75rem;
                    border-radius: var(--radius-full);
                    background: var(--color-gray-100);
                    color: var(--color-gray-600, var(--color-gray-500));
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .cw-map-thumb {
                    position: relative;
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    border: 1px solid var(--color-gray-200);
                    box-shadow: var(--shadow-sm);
                }

                .cw-map-expand {
                    position: absolute;
                    inset: 0;
                    z-index: 1;
                    border: none;
                    background: transparent;
                    cursor: pointer;
                    padding: 0;
                }

                .cw-map-badge {
                    position: absolute;
                    right: 10px;
                    bottom: 10px;
                    z-index: 2;
                    pointer-events: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: var(--radius-sm);
                    background: var(--color-surface);
                    color: var(--color-gray-600, var(--color-gray-500));
                    box-shadow: var(--shadow-md);
                }

                .cw-checkin-cta {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.85rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-secondary);
                    color: white;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .cw-checkin-cta:hover {
                    background: var(--color-secondary-dark, #CC4A00);
                }

                .cw-my-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.85rem 1rem;
                    border-radius: var(--radius-md);
                    border: 1.5px solid var(--color-secondary);
                    background: rgba(255, 91, 0, 0.06);
                }

                .cw-my-text {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-gray-900);
                    min-width: 0;
                }

                .cw-banner-checkout {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.45rem 0.9rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-secondary);
                    color: white;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .cw-banner-checkout:hover {
                    background: var(--color-secondary-dark, #CC4A00);
                }

                .cw-error {
                    margin: 0;
                    font-size: 0.85rem;
                    color: var(--color-error, #EF4444);
                }

                .cw-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .cw-loading {
                    display: flex;
                    justify-content: center;
                    padding: 2.5rem 0;
                    color: var(--color-primary);
                }

                .cw-spin {
                    animation: cw-spin 1s linear infinite;
                }

                @keyframes cw-spin {
                    to { transform: rotate(360deg); }
                }

                .cw-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    text-align: center;
                    padding: 3rem 1.5rem;
                    color: var(--color-gray-500);
                }

                .cw-empty h3 {
                    margin: 0;
                    color: var(--color-gray-900);
                }

                .cw-empty p {
                    margin: 0;
                    font-size: 0.9rem;
                    max-width: 340px;
                }

                .cw-empty-icon {
                    color: var(--color-gray-300, var(--color-gray-200));
                }

                .cw-empty-cta {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    margin-top: 0.75rem;
                    padding: 0.6rem 1.4rem;
                    border: none;
                    border-radius: var(--radius-md);
                    background: var(--color-secondary);
                    color: white;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .cw-empty-cta:hover {
                    background: var(--color-secondary-dark, #CC4A00);
                }

                @media (max-width: 768px) {
                    .cowork-page {
                        padding-bottom: calc(90px + env(safe-area-inset-bottom));
                    }
                }
            `}</style>
        </div>
    );
};

export default Cowork;
