import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CoworkMap from './CoworkMap';

/**
 * Fullscreen map modal. z-index 10002 — deliberately above MobileBottomNav's
 * 10000 AND CheckInModal's 10001, so the map covers the bottom bar and the
 * drop-a-pin picker stacks above the check-in sheet it is nested under.
 * Doubles as the drop-a-pin picker via `pickMode` (nested under CheckInModal,
 * hence the idempotent body scroll lock: only the modal that locked the body
 * restores it).
 */
const CoworkMapModal = ({
    open,
    onClose,
    sessions = [],
    profiles = {},
    pickMode = false,
    onPick,
    focusPubkey = null,
}) => {
    const { t } = useTranslation();
    const [pickedLatLng, setPickedLatLng] = useState(null);

    // Reset the pin every time the picker opens.
    useEffect(() => {
        if (open) setPickedLatLng(null);
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

    // ESC closes.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const handleConfirm = () => {
        if (pickedLatLng && onPick) onPick(pickedLatLng);
        onClose();
    };

    return createPortal(
        <div className="cmm-overlay" data-testid="cowork-map-modal" role="dialog" aria-modal="true">
            <div className="cmm-header">
                <h3 className="cmm-title">
                    {t(pickMode ? 'cowork.pickOnMapHint' : 'cowork.mapTitle')}
                </h3>
                <button
                    className="cmm-close"
                    data-testid="cowork-map-modal-close"
                    aria-label={t('common.close')}
                    onClick={onClose}
                >
                    <X size={22} />
                </button>
            </div>
            <div className="cmm-body">
                <CoworkMap
                    sessions={sessions}
                    profiles={profiles}
                    interactive
                    pickMode={pickMode}
                    pickedLatLng={pickedLatLng}
                    onPick={setPickedLatLng}
                    height="100%"
                    fit={!pickMode}
                    focusPubkey={focusPubkey}
                />
            </div>
            {pickMode && (
                <div className="cmm-footer">
                    <button
                        className="cmm-confirm"
                        data-testid="cowork-pick-confirm"
                        disabled={!pickedLatLng}
                        onClick={handleConfirm}
                    >
                        <Check size={16} />
                        {t('common.save')}
                    </button>
                </div>
            )}

            <style jsx>{`
                .cmm-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10002;
                    display: flex;
                    flex-direction: column;
                    background: var(--color-surface);
                }

                .cmm-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    padding-top: calc(0.75rem + env(safe-area-inset-top));
                    border-bottom: 1px solid var(--color-gray-200);
                    flex-shrink: 0;
                }

                .cmm-title {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--color-gray-900);
                }

                .cmm-close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px;
                    border: none;
                    background: none;
                    border-radius: var(--radius-sm);
                    color: var(--color-gray-500);
                    cursor: pointer;
                }

                .cmm-close:hover {
                    background: var(--color-gray-100);
                    color: var(--color-gray-900);
                }

                .cmm-body {
                    flex: 1;
                    min-height: 0;
                }

                .cmm-footer {
                    flex-shrink: 0;
                    padding: 0.75rem 1rem;
                    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
                    border-top: 1px solid var(--color-gray-200);
                    background: var(--color-surface);
                }

                .cmm-confirm {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.75rem;
                    background: var(--color-secondary);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                }

                .cmm-confirm:hover:not(:disabled) {
                    background: var(--color-secondary-dark, #CC4A00);
                }

                .cmm-confirm:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </div>,
        document.body,
    );
};

export default CoworkMapModal;
