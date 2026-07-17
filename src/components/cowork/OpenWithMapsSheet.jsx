import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Map, MapPin, Navigation } from 'lucide-react';
import { getMapAppOptions, openMapApp } from '../../utils/mapApps';

const OPTION_ICONS = { apple: Map, google: MapPin, waze: Navigation };

/**
 * "Open with" chooser for a coordinate — lists the map apps that make sense
 * on this device (see utils/mapApps.js) and hands the pick to a universal
 * link. Rendered above the session-detail modal (10001) and the fullscreen
 * map modal (10002), hence z-index 10003. The parent modal owns body scroll
 * locking already, so this sheet does not add its own.
 */
const OpenWithMapsSheet = ({ open, onClose, lat, lng, label }) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const options = getMapAppOptions();

    const pick = (option) => {
        openMapApp(option, { lat, lng, label });
        onClose();
    };

    return createPortal(
        <div
            className="mws-overlay"
            data-testid="maps-open-with-sheet"
            onClick={onClose}
        >
            <div className="mws-card" onClick={(e) => e.stopPropagation()}>
                <div className="mws-head">
                    <span className="mws-title">{t('cowork.maps.openWith', 'Open with')}</span>
                    <button className="mws-close" onClick={onClose} aria-label={t('common.close', 'Close')}>
                        <X size={18} />
                    </button>
                </div>
                {options.map((option) => {
                    const Icon = OPTION_ICONS[option.id] || MapPin;
                    return (
                        <button
                            key={option.id}
                            className="mws-option"
                            data-testid={`maps-option-${option.id}`}
                            onClick={() => pick(option)}
                        >
                            <span className={`mws-icon mws-icon-${option.id}`}>
                                <Icon size={18} />
                            </span>
                            {option.label}
                        </button>
                    );
                })}
            </div>

            <style jsx>{`
                .mws-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10003; /* above session modal (10001) + map modal (10002) */
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                }
                .mws-card {
                    width: 100%;
                    max-width: 340px;
                    background: var(--bg-card, #fff);
                    color: var(--text-primary, #111);
                    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12));
                    border-radius: 16px;
                    padding: 0.5rem;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
                }
                .mws-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0.5rem 0.75rem 0.25rem;
                }
                .mws-title {
                    font-weight: 600;
                    font-size: 0.95rem;
                }
                .mws-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    min-height: 0;
                    border: none;
                    border-radius: 50%;
                    background: transparent;
                    color: var(--text-secondary, #666);
                    cursor: pointer;
                }
                .mws-close:hover {
                    background: var(--bg-hover, rgba(0, 0, 0, 0.06));
                }
                .mws-option {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    width: 100%;
                    padding: 0.75rem;
                    border: none;
                    border-radius: 12px;
                    background: transparent;
                    color: inherit;
                    font-size: 0.95rem;
                    font-weight: 500;
                    text-align: left;
                    cursor: pointer;
                }
                .mws-option:hover {
                    background: var(--bg-hover, rgba(0, 0, 0, 0.06));
                }
                .mws-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    flex-shrink: 0;
                    color: #fff;
                }
                .mws-icon-apple { background: #007aff; }
                .mws-icon-google { background: #34a853; }
                .mws-icon-waze { background: #33ccff; }

                @media (max-width: 768px) {
                    .mws-overlay {
                        align-items: flex-end;
                        padding: 0;
                    }
                    .mws-card {
                        max-width: none;
                        border-radius: 16px 16px 0 0;
                        border-bottom: none;
                        padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
                    }
                }
            `}</style>
        </div>,
        document.body,
    );
};

export default OpenWithMapsSheet;
