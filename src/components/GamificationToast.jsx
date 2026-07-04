import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Crown, X } from 'lucide-react';

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 6000;

/**
 * GamificationToast — global stacked toasts for gamification broadcasts
 * (level-ups, monthly winners). Listens for the `bies:gamification`
 * CustomEvent dispatched by the AuthContext WebSocket handler.
 */
const GamificationToast = () => {
    const { t } = useTranslation();
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);
    const timersRef = useRef({});

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
    }, []);

    useEffect(() => {
        const timers = timersRef.current;
        const onGamification = (e) => {
            const detail = e.detail || {};
            if (detail.event !== 'level_up' && detail.event !== 'monthly_winners') return;
            const id = ++idRef.current;
            setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { id, detail }]);
            timers[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
        };
        window.addEventListener('bies:gamification', onGamification);
        return () => {
            window.removeEventListener('bies:gamification', onGamification);
            Object.values(timers).forEach(clearTimeout);
        };
    }, [dismiss]);

    if (toasts.length === 0) return null;

    const message = (detail) => {
        if (detail.event === 'level_up') {
            return t('points.toast.levelUp', {
                name: detail.name || t('common.unnamed', 'A member'),
                level: detail.level,
                title: detail.titleKey ? t(detail.titleKey) : '',
            });
        }
        const winners = (detail.winners || [])
            .map((w) => w.name || t('common.unnamed', 'A member'))
            .join(', ');
        return t('points.toast.monthlyWinners', { winners });
    };

    return (
        <div className="gt-root" role="status" aria-live="polite">
            {toasts.map(({ id, detail }) => (
                <div key={id} className="gt-toast" data-testid="gamification-toast">
                    <span className="gt-icon">
                        {detail.event === 'level_up'
                            ? <Trophy size={18} style={{ color: '#D97706' }} />
                            : <Crown size={18} style={{ color: '#D97706' }} />}
                    </span>
                    <p className="gt-text">{message(detail)}</p>
                    <button className="gt-close" aria-label={t('common.close', 'Close')} onClick={() => dismiss(id)}>
                        <X size={14} />
                    </button>
                </div>
            ))}

            {/*
              Toast rows come out of a .map inside JSX; to stay safe with the
              styled-jsx babel plugin every descendant rule is written as
              `.gt-root :global(...)` — `.gt-root` itself gets the scope hash.
            */}
            <style jsx>{`
                .gt-root {
                    position: fixed;
                    left: 50%;
                    transform: translateX(-50%);
                    bottom: 24px;
                    z-index: 10500; /* above the mobile bottom nav (10000) */
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: min(420px, calc(100vw - 32px));
                    pointer-events: none;
                }

                .gt-root :global(.gt-toast) {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: var(--color-surface);
                    color: var(--color-gray-900);
                    border: 1px solid var(--color-gray-200);
                    border-radius: var(--radius-md);
                    box-shadow: var(--shadow-lg);
                    padding: 10px 12px;
                    pointer-events: auto;
                    animation: gt-slide-up 0.25s ease-out;
                }

                @keyframes gt-slide-up {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .gt-root :global(.gt-icon) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: var(--color-orange-tint);
                    flex-shrink: 0;
                }

                .gt-root :global(.gt-text) {
                    flex: 1;
                    margin: 0;
                    font-size: 0.875rem;
                    line-height: 1.4;
                    font-weight: 500;
                    min-width: 0;
                }

                .gt-root :global(.gt-close) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    color: var(--color-gray-400);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: var(--radius-sm);
                    flex-shrink: 0;
                    transition: background 0.15s, color 0.15s;
                }

                .gt-root :global(.gt-close:hover) {
                    background: var(--color-gray-100);
                    color: var(--color-gray-700);
                }

                @media (max-width: 768px) {
                    .gt-root {
                        bottom: calc(76px + env(safe-area-inset-bottom, 0px));
                    }
                }
            `}</style>
        </div>
    );
};

export default GamificationToast;
