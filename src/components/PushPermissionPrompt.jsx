import { useState } from 'react';
import { Bell, X, Loader2, Check } from 'lucide-react';
import { requestNotificationPermission, subscribeToPush } from '../utils/notificationManager';
import { notificationsApi } from '../services/api';

/**
 * Non-blocking banner prompting the user to enable web push notifications.
 * Shown after login when Notification.permission === 'default'. The actual
 * requestPermission() call must be triggered from a click handler — browsers
 * block permission prompts that aren't tied to a user gesture.
 */
const PushPermissionPrompt = ({ onClose }) => {
    const [phase, setPhase] = useState('prompt'); // prompt | working | success | error

    const handleEnable = async () => {
        setPhase('working');
        try {
            const perm = await requestNotificationPermission();
            if (perm !== 'granted') {
                // User denied or dismissed — don't nag further this session
                onClose();
                return;
            }
            const { publicKey } = await notificationsApi.getVapidKey();
            if (!publicKey) { onClose(); return; }
            const sub = await subscribeToPush(publicKey);
            if (sub) {
                await notificationsApi.pushSubscribe(sub);
                setPhase('success');
                setTimeout(onClose, 1500);
            } else {
                onClose();
            }
        } catch {
            setPhase('error');
            setTimeout(onClose, 2000);
        }
    };

    return (
        <div className="ppp-banner" role="dialog" aria-live="polite">
            <div className="ppp-icon">
                <Bell size={20} />
            </div>
            <div className="ppp-body">
                {phase === 'prompt' && (
                    <>
                        <div className="ppp-title">Enable push notifications</div>
                        <div className="ppp-desc">Get notified about messages, comments, and project updates even when BIES isn't open.</div>
                    </>
                )}
                {phase === 'working' && (
                    <div className="ppp-title">Enabling…</div>
                )}
                {phase === 'success' && (
                    <div className="ppp-title">Notifications enabled</div>
                )}
                {phase === 'error' && (
                    <div className="ppp-title">Could not enable notifications</div>
                )}
            </div>
            <div className="ppp-actions">
                {phase === 'prompt' && (
                    <>
                        <button className="ppp-enable" onClick={handleEnable}>Enable</button>
                        <button className="ppp-close" onClick={onClose} aria-label="Dismiss">
                            <X size={16} />
                        </button>
                    </>
                )}
                {phase === 'working' && <Loader2 size={18} className="ppp-spin" />}
                {phase === 'success' && <Check size={18} className="ppp-check" />}
            </div>

            <style jsx>{`
                .ppp-banner {
                    position: fixed;
                    left: 50%;
                    bottom: 5rem;
                    transform: translateX(-50%);
                    z-index: 9998;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.85rem 1rem;
                    background: var(--color-surface, #ffffff);
                    border: 1px solid var(--color-gray-200, #e5e7eb);
                    border-radius: 0.85rem;
                    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
                    max-width: 92vw;
                    width: 420px;
                    animation: ppp-slide-up 0.25s ease;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                }

                @keyframes ppp-slide-up {
                    from { transform: translate(-50%, 16px); opacity: 0; }
                    to   { transform: translate(-50%, 0);    opacity: 1; }
                }

                .ppp-icon {
                    flex-shrink: 0;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .ppp-body {
                    flex: 1;
                    min-width: 0;
                }

                .ppp-title {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-text, inherit);
                    line-height: 1.2;
                }

                .ppp-desc {
                    font-size: 0.78rem;
                    color: var(--color-gray-500);
                    margin-top: 0.2rem;
                    line-height: 1.35;
                }

                .ppp-actions {
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .ppp-enable {
                    background: #1e1b4b;
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    padding: 0.5rem 0.95rem;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: inherit;
                    transition: opacity 0.15s;
                }
                .ppp-enable:hover { opacity: 0.9; }

                .ppp-close {
                    background: none;
                    border: none;
                    color: var(--color-gray-400);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                }
                .ppp-close:hover {
                    color: var(--color-gray-600);
                    background: var(--color-gray-100, #f3f4f6);
                }

                .ppp-spin {
                    animation: ppp-spin 1s linear infinite;
                    color: #4338ca;
                }
                @keyframes ppp-spin {
                    to { transform: rotate(360deg); }
                }

                .ppp-check { color: #10b981; }

                /* Mobile: full-width banner at the bottom above the nav */
                @media (max-width: 540px) {
                    .ppp-banner {
                        left: 0.75rem;
                        right: 0.75rem;
                        width: auto;
                        max-width: none;
                        transform: none;
                        bottom: 5.25rem;
                    }
                    @keyframes ppp-slide-up {
                        from { transform: translateY(16px); opacity: 0; }
                        to   { transform: translateY(0);    opacity: 1; }
                    }
                }
            `}</style>
        </div>
    );
};

export default PushPermissionPrompt;
