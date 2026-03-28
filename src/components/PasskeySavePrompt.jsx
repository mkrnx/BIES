import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Fingerprint, X, Loader2, Check, Shield, AlertTriangle } from 'lucide-react';
import { keytrService, isLikelyExtensionInterference } from '../services/keytrService';
import { nostrSigner } from '../services/nostrSigner';

/**
 * Post-login modal prompting users who logged in with nsec/seed/email
 * to save their key with a NIP-K1 passkey via keytr for easier future logins.
 *
 * @param {function} props.onClose - Called when user dismisses
 * @param {function} props.onSaved - Called after passkey saved successfully
 */
const PasskeySavePrompt = ({ onClose, onSaved }) => {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('prompt'); // prompt | saving | success | error
    const [errorMsg, setErrorMsg] = useState('');

    const handleSave = async () => {
        setPhase('saving');
        setErrorMsg('');
        try {
            const nsec = nostrSigner.getNsec();
            const pubkey = nostrSigner.pubkey;
            if (!nsec || !pubkey) throw new Error('Key not available');
            await keytrService.saveWithPasskey(nsec, pubkey);
            setPhase('success');
            setTimeout(() => {
                onSaved?.();
            }, 1500);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                // User cancelled the WebAuthn prompt
                setPhase('prompt');
                return;
            }
            setPhase('error');
            setErrorMsg(err.message || 'Failed to save passkey.');
        }
    };

    return (
        <div className="psp-overlay" onClick={(e) => { if (e.target === e.currentTarget && phase !== 'saving') onClose(); }}>
            <div className="psp-card">
                {/* Close button (hidden during save) */}
                {phase !== 'saving' && phase !== 'success' && (
                    <button className="psp-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                )}

                {/* Prompt phase */}
                {phase === 'prompt' && (
                    <div className="psp-content">
                        <div className="psp-icon">
                            <Fingerprint size={36} />
                        </div>
                        <h3 className="psp-title">{t('passkeySave.title')}</h3>
                        <p className="psp-desc">{t('passkeySave.description')}</p>

                        <div className="psp-benefits">
                            <div className="psp-benefit">
                                <Shield size={16} />
                                <span>{t('passkeySave.benefitEncrypted')}</span>
                            </div>
                            <div className="psp-benefit">
                                <Fingerprint size={16} />
                                <span>{t('passkeySave.benefitBiometric')}</span>
                            </div>
                        </div>

                        <button className="psp-save-btn" onClick={handleSave}>
                            <Fingerprint size={18} />
                            {t('passkeySave.saveButton')}
                        </button>
                        <button className="psp-skip-btn" onClick={onClose}>
                            {t('passkeySave.notNow')}
                        </button>
                    </div>
                )}

                {/* Saving phase */}
                {phase === 'saving' && (
                    <div className="psp-content psp-center">
                        <Loader2 size={32} className="psp-spin" />
                        <p className="psp-status">{t('passkeySave.saving')}</p>
                    </div>
                )}

                {/* Success phase */}
                {phase === 'success' && (
                    <div className="psp-content psp-center">
                        <div className="psp-success-icon">
                            <Check size={32} />
                        </div>
                        <h3 className="psp-title">{t('passkeySave.saved')}</h3>
                        <p className="psp-status">{t('passkeySave.savedDesc')}</p>
                    </div>
                )}

                {/* Error phase */}
                {phase === 'error' && (
                    <div className="psp-content psp-center">
                        <p className="psp-error">{errorMsg}</p>
                        {isLikelyExtensionInterference(errorMsg) && (
                            <div className="psp-ext-hint">
                                <AlertTriangle size={16} />
                                <span>This error is usually caused by a password manager browser extension (such as Bitwarden, 1Password, or Dashlane) intercepting the passkey request. Try disabling your password manager's passkey/WebAuthn feature and retry.</span>
                            </div>
                        )}
                        <button className="psp-save-btn" onClick={handleSave}>
                            {t('passkeySave.tryAgain')}
                        </button>
                        <button className="psp-skip-btn" onClick={onClose}>
                            {t('passkeySave.skip')}
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                .psp-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.6);
                    backdrop-filter: blur(4px);
                    animation: psp-fade-in 0.2s ease;
                }

                @keyframes psp-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .psp-card {
                    position: relative;
                    background: var(--color-surface);
                    border-radius: 1.25rem;
                    width: 90vw;
                    max-width: 380px;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                    animation: psp-slide-up 0.25s ease;
                }

                @keyframes psp-slide-up {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .psp-close {
                    position: absolute;
                    top: 0.75rem;
                    right: 0.75rem;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--color-gray-400);
                    padding: 4px;
                    display: flex;
                    z-index: 1;
                }
                .psp-close:hover { color: var(--color-gray-600); }

                .psp-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 2rem 1.5rem 1.5rem;
                }

                .psp-center {
                    padding: 2.5rem 1.5rem;
                    gap: 0.75rem;
                }

                .psp-icon {
                    width: 68px;
                    height: 68px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1rem;
                }

                .psp-title {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--color-text, inherit);
                    margin: 0 0 0.5rem;
                    text-align: center;
                    font-family: var(--font-display, 'PP Formula Narrow', sans-serif);
                }

                .psp-desc {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                    text-align: center;
                    margin: 0 0 1.25rem;
                    line-height: 1.5;
                }

                .psp-benefits {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                }

                .psp-benefit {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.6rem 0.75rem;
                    background: var(--color-gray-100);
                    border-radius: 0.6rem;
                    font-size: 0.8rem;
                    color: var(--color-gray-600);
                }

                .psp-benefit svg { flex-shrink: 0; color: #4338ca; }

                .psp-save-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    padding: 0.85rem;
                    background: #1e1b4b;
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                    transition: opacity 0.15s;
                }
                .psp-save-btn:hover { opacity: 0.9; }

                .psp-skip-btn {
                    margin-top: 0.75rem;
                    background: none;
                    border: none;
                    color: var(--color-gray-500);
                    font-size: 0.85rem;
                    cursor: pointer;
                    padding: 0.5rem 1rem;
                    font-family: var(--font-sans, 'Inter', sans-serif);
                }
                .psp-skip-btn:hover { color: var(--color-gray-700); }

                .psp-spin {
                    animation: psp-spin 1s linear infinite;
                    color: #4338ca;
                }
                @keyframes psp-spin {
                    to { transform: rotate(360deg); }
                }

                .psp-status {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                    text-align: center;
                    margin: 0;
                }

                .psp-success-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .psp-error {
                    font-size: 0.875rem;
                    color: var(--color-error, #ef4444);
                    text-align: center;
                    margin: 0 0 1rem;
                }

                .psp-ext-hint {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    font-size: 0.8rem;
                    color: var(--color-gray-600);
                    background: var(--color-gray-100, #f3f4f6);
                    padding: 0.75rem;
                    border-radius: 0.6rem;
                    width: 100%;
                    line-height: 1.4;
                    text-align: left;
                    margin-bottom: 0.5rem;
                }
                .psp-ext-hint svg { flex-shrink: 0; margin-top: 2px; color: var(--color-gray-400); }
            `}</style>
        </div>
    );
};

export default PasskeySavePrompt;
