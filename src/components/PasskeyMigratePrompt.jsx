import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, X, Loader2, Check, Fingerprint, AlertTriangle } from 'lucide-react';
import { keytrService, isLikelyExtensionInterference, isPrfUnsupportedError, isUserCancellation } from '../services/keytrService';
import { nostrSigner } from '../services/nostrSigner';

/**
 * Post-login modal offering to migrate legacy KiH (v=3) passkeys to PRF.
 *
 * keytr 0.8.0 deprecated KiH decryption (the KiH key travelled through a
 * JS-readable userHandle); migrateToPrf() re-encrypts the nsec under a new
 * PRF passkey and retires the old event. A user may hold KiH credentials on
 * several gateways (primary + backups) — migrateFromKih is one rpId per
 * call, so we loop them sequentially, two biometric ceremonies each.
 *
 * @param {function} props.onClose - Called when user dismisses
 * @param {function} props.onMigrated - Called after all gateways migrated
 */
const PasskeyMigratePrompt = ({ onClose, onMigrated }) => {
    const { t } = useTranslation();
    const [phase, setPhase] = useState('prompt'); // prompt | migrating | success | error
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState({ current: 0, total: 0, gateway: '' });
    // Snapshot the detection once — migrateToPrf prunes it as gateways complete.
    const infoRef = useRef(keytrService.getLastLoginKihInfo());

    const uniqueRpIds = () => {
        const creds = infoRef.current?.kihCredentials || [];
        return [...new Set(creds.map(c => c.rpId))];
    };

    const handleUpgrade = async () => {
        const rpIds = uniqueRpIds();
        if (rpIds.length === 0) { onMigrated?.(); return; }
        const expectedPubkey = infoRef.current?.pubkey || nostrSigner.pubkey;

        setPhase('migrating');
        setErrorMsg('');

        let done = 0;
        for (let i = 0; i < rpIds.length; i++) {
            const rpId = rpIds[i];
            setProgress({ current: i + 1, total: rpIds.length, gateway: rpId });
            try {
                const result = await keytrService.migrateToPrf({ rpId, expectedPubkey });
                if (result.pubkeyMismatch) {
                    console.warn('[PasskeyMigrate] Migrated a passkey belonging to a different identity:', result.pubkey);
                }
                done++;
            } catch (err) {
                if (isUserCancellation(err)) {
                    // User cancelled the WebAuthn ceremony — nothing was
                    // published. (keytr wraps NotAllowedError in WebAuthnError,
                    // so err.name would not match — check the message.)
                    setPhase('prompt');
                    return;
                }
                if (isPrfUnsupportedError(err)) {
                    setPhase('error');
                    setErrorMsg(t('passkeyMigrate.prfUnsupported'));
                    return;
                }
                if ((err.message || '').includes('already a PRF credential')) {
                    setPhase('error');
                    setErrorMsg(t('passkeyMigrate.wrongPasskey', { gateway: rpId }));
                    return;
                }
                setPhase('error');
                if (done > 0) {
                    setErrorMsg(t('passkeyMigrate.partialSuccess', { done, total: rpIds.length }));
                } else {
                    setErrorMsg(err.message || 'Migration failed.');
                }
                return;
            }
        }

        setPhase('success');
        setTimeout(() => {
            onMigrated?.();
        }, 1500);
    };

    return (
        <div className="psp-overlay" onClick={(e) => { if (e.target === e.currentTarget && phase !== 'migrating') onClose(); }}>
            <div className="psp-card">
                {phase !== 'migrating' && phase !== 'success' && (
                    <button className="psp-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                )}

                {/* Prompt phase */}
                {phase === 'prompt' && (
                    <div className="psp-content">
                        <div className="psp-icon">
                            <ShieldCheck size={36} />
                        </div>
                        <h3 className="psp-title">{t('passkeyMigrate.title')}</h3>
                        <p className="psp-desc">{t('passkeyMigrate.description')}</p>

                        <button className="psp-save-btn" onClick={handleUpgrade}>
                            <Fingerprint size={18} />
                            {t('passkeyMigrate.upgradeButton')}
                        </button>
                        <button className="psp-skip-btn" onClick={onClose}>
                            {t('passkeyMigrate.notNow')}
                        </button>
                    </div>
                )}

                {/* Migrating phase */}
                {phase === 'migrating' && (
                    <div className="psp-content psp-center">
                        <Loader2 size={32} className="psp-spin" />
                        {progress.total > 1 && (
                            <p className="psp-status psp-strong">
                                {t('passkeyMigrate.migratingGateway', { current: progress.current, total: progress.total })}
                            </p>
                        )}
                        <p className="psp-status">{t('passkeyMigrate.migrating')}</p>
                        <p className="psp-status psp-hint">
                            {t('passkeyMigrate.pickOldHint', { gateway: progress.gateway })}
                        </p>
                    </div>
                )}

                {/* Success phase */}
                {phase === 'success' && (
                    <div className="psp-content psp-center">
                        <div className="psp-success-icon">
                            <Check size={32} />
                        </div>
                        <h3 className="psp-title">{t('passkeyMigrate.success')}</h3>
                        <p className="psp-status">{t('passkeyMigrate.successDesc')}</p>
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
                        <button className="psp-save-btn" onClick={handleUpgrade}>
                            {t('passkeyMigrate.tryAgain')}
                        </button>
                        <button className="psp-skip-btn" onClick={onClose}>
                            {t('passkeyMigrate.skip')}
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

                .psp-strong {
                    font-weight: 600;
                    color: var(--color-text, inherit);
                }

                .psp-hint {
                    font-size: 0.8rem;
                    color: var(--color-gray-400);
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

export default PasskeyMigratePrompt;
