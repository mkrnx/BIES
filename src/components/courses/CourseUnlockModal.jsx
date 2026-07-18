import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, CheckCircle, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ZapModal from '../ZapModal';
import { coursesApi } from '../../services/api';

const CLAIM_POLL_INTERVAL_MS = 6000;
const CLAIM_POLL_MAX_TRIES = 20; // ~2 minutes

/**
 * Paid-course unlock flow: zap the instructor for the course price, then
 * poll the server's claim endpoint until the zap receipt is verified and
 * the purchase is confirmed.
 *
 * @param {Object} props.course - needs { id, title, priceSats }
 * @param {Object} props.purchaseInfo - GET /courses/:id/purchase payload
 *   ({ authorPubkey, lightningAddress, zapCoordinate, priceSats })
 * @param {string} [props.instructorName]
 * @param {string} [props.instructorAvatar]
 * @param {function} props.onClose
 * @param {function} props.onUnlocked - purchase confirmed; caller refetches
 */
const CourseUnlockModal = ({ course, purchaseInfo, instructorName, instructorAvatar, onClose, onUnlocked }) => {
    const { t } = useTranslation();
    // intro | zap | confirming | done | timeout
    const [stage, setStage] = useState('intro');
    const pollRef = useRef({ timer: null, tries: 0, active: false });

    const stopPolling = useCallback(() => {
        pollRef.current.active = false;
        if (pollRef.current.timer) clearTimeout(pollRef.current.timer);
    }, []);

    useEffect(() => () => stopPolling(), [stopPolling]);

    const pollClaim = useCallback(async () => {
        if (!pollRef.current.active) return;
        pollRef.current.tries += 1;
        try {
            const result = await coursesApi.claimPurchase(course.id);
            if (result?.purchased) {
                stopPolling();
                setStage('done');
                return;
            }
        } catch {
            // transient (rate limit / network) — keep polling
        }
        if (pollRef.current.tries >= CLAIM_POLL_MAX_TRIES) {
            stopPolling();
            setStage('timeout');
            return;
        }
        pollRef.current.timer = setTimeout(pollClaim, CLAIM_POLL_INTERVAL_MS);
    }, [course.id, stopPolling]);

    const startPolling = useCallback(() => {
        stopPolling();
        pollRef.current = { timer: null, tries: 0, active: true };
        pollClaim();
    }, [pollClaim, stopPolling]);

    // ZapModal reports payment progress: 'paid' (wallet paid) → confirming
    // view; 'qr' (manual invoice shown) → keep the QR open, poll behind it.
    const handlePaid = useCallback((mode) => {
        if (mode === 'paid') setStage('confirming');
        startPolling();
    }, [startPolling]);

    const handleZapClose = useCallback(() => {
        // If a payment might be in flight (polling active), fall back to the
        // confirming view instead of abandoning the purchase.
        if (pollRef.current.active) setStage('confirming');
        else onClose();
    }, [onClose]);

    const manualRefresh = async () => {
        setStage('confirming');
        startPolling();
    };

    if (stage === 'zap') {
        return (
            <ZapModal
                recipients={[{
                    pubkey: purchaseInfo.authorPubkey,
                    name: instructorName || t('courses.instructor'),
                    avatar: instructorAvatar,
                    lud16: purchaseInfo.lightningAddress || '',
                }]}
                fixedAmount={purchaseInfo.priceSats || course.priceSats}
                aTag={purchaseInfo.zapCoordinate}
                onPaid={handlePaid}
                onClose={handleZapClose}
            />
        );
    }

    return createPortal(
        <div className="unlock-overlay" onClick={(e) => { if (e.target === e.currentTarget && stage !== 'confirming') onClose(); }}>
            <div className="unlock-card">
                <div className="unlock-header">
                    <h3 className="unlock-title">
                        <Zap size={18} style={{ color: '#f7931a' }} />
                        {t('courses.unlock.title')}
                    </h3>
                    <button className="unlock-close" onClick={stage === 'done' ? () => { onUnlocked?.(); onClose(); } : onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="unlock-body">
                    {stage === 'intro' && (
                        <>
                            <p className="unlock-text">{t('courses.unlock.body')}</p>
                            <div className="unlock-price">⚡ {t('courses.priceSats', { n: (purchaseInfo.priceSats || course.priceSats)?.toLocaleString() })}</div>
                            {purchaseInfo.lightningAddress ? (
                                <button className="unlock-btn" onClick={() => setStage('zap')}>
                                    <Zap size={16} />
                                    {t('courses.unlockFor', { n: (purchaseInfo.priceSats || course.priceSats)?.toLocaleString() })}
                                </button>
                            ) : (
                                <p className="unlock-warn">
                                    <AlertCircle size={15} />
                                    {t('courses.unlock.noLightning')}
                                </p>
                            )}
                        </>
                    )}

                    {stage === 'confirming' && (
                        <div className="unlock-center">
                            <Loader2 size={28} className="unlock-spin" />
                            <p className="unlock-text">{t('courses.unlock.confirming')}</p>
                            <p className="unlock-hint">{t('courses.unlock.pendingBody')}</p>
                        </div>
                    )}

                    {stage === 'done' && (
                        <div className="unlock-center">
                            <CheckCircle size={36} style={{ color: '#10b981' }} />
                            <p className="unlock-text unlock-success">{t('courses.unlock.success')}</p>
                            <button className="unlock-btn" onClick={() => { onUnlocked?.(); onClose(); }}>
                                {t('courses.startCourse')}
                            </button>
                        </div>
                    )}

                    {stage === 'timeout' && (
                        <div className="unlock-center">
                            <AlertCircle size={28} style={{ color: '#f59e0b' }} />
                            <p className="unlock-text">{t('courses.unlock.pendingBody')}</p>
                            <button className="unlock-btn secondary" onClick={manualRefresh}>
                                <RefreshCw size={15} />
                                {t('courses.unlock.refresh')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .unlock-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                }
                .unlock-card {
                    background: var(--color-surface);
                    border-radius: 16px;
                    width: 90vw;
                    max-width: 400px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                }
                .unlock-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem 1.25rem;
                    border-bottom: 1px solid var(--color-gray-200);
                }
                .unlock-title {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 700;
                    font-size: 1.1rem;
                    font-family: var(--font-display, 'PP Formula Narrow', sans-serif);
                    margin: 0;
                }
                .unlock-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-gray-500);
                    padding: 4px;
                    display: flex;
                }
                .unlock-body { padding: 1.5rem 1.25rem; }
                .unlock-center {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 0;
                }
                .unlock-text {
                    color: var(--color-gray-600);
                    font-size: 0.9rem;
                    text-align: center;
                    margin: 0;
                }
                .unlock-hint {
                    color: var(--color-gray-500);
                    font-size: 0.8rem;
                    text-align: center;
                    margin: 0;
                }
                .unlock-success {
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: var(--color-gray-900);
                }
                .unlock-price {
                    text-align: center;
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #f7931a;
                    margin: 1rem 0;
                }
                .unlock-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    padding: 0.75rem;
                    background: #f7931a;
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                }
                .unlock-btn:hover { background: #e8841a; }
                .unlock-btn.secondary {
                    background: var(--color-surface);
                    color: var(--color-gray-600);
                    border: 1.5px solid var(--color-gray-200);
                }
                .unlock-btn.secondary:hover { border-color: #f7931a; color: #f7931a; }
                .unlock-warn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    color: #f59e0b;
                    font-size: 0.85rem;
                    margin: 0;
                }
                .unlock-spin {
                    animation: unlock-spin 1s linear infinite;
                    color: #f7931a;
                }
                @keyframes unlock-spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>,
        document.body
    );
};

export default CourseUnlockModal;
