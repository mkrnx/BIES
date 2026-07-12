import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { AlertCircle, CheckCircle, Copy, Globe, Loader2, Zap } from 'lucide-react';
import { voucherApi } from '../services/api';
import logoIcon from '../assets/logo-icon.svg';

// Simple client-side check: npub1... (bech32) or 64-char hex pubkey.
const PUBKEY_REGEX = /^(npub1[a-z0-9]{58}|[0-9a-fA-F]{64})$/;

// 5s keeps a full 20-min polling session under the global /api rate limit
// (300 req/15min/IP); 3s polling would exhaust it before the timeout.
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000; // stop polling after 20 minutes

/**
 * VoucherRedeem — public relay-access voucher redemption page (/access/:code).
 *
 * Usable logged-out. Fetches voucher info on mount; ONBOARDING codes are
 * forwarded to the /join/:code landing page. RELAY_ACCESS codes show a
 * pubkey form; free vouchers complete immediately, paid ones render a
 * Lightning invoice (QR + copy + wallet deep link) and poll for payment.
 */
const VoucherRedeem = () => {
    const { code } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Phases: loading | unknown | blocked | form | paying | success | timeout
    const [phase, setPhase] = useState('loading');
    const [info, setInfo] = useState(null);
    const [blockReason, setBlockReason] = useState('invalid'); // invalid | revoked | expired | exhausted
    const [pubkeyInput, setPubkeyInput] = useState('');
    const [inputError, setInputError] = useState('');
    const [error, setError] = useState('');
    const [redeeming, setRedeeming] = useState(false);
    const [payment, setPayment] = useState(null); // { redemptionId, bolt11, amountSats }
    const [relayUrl, setRelayUrl] = useState('');
    const [copied, setCopied] = useState(''); // 'relay' | 'invoice'
    const [hasNostrExtension, setHasNostrExtension] = useState(
        typeof window !== 'undefined' && !!window.nostr
    );
    const isMember = !!localStorage.getItem('bies_token');

    // Extensions inject window.nostr asynchronously — poll briefly (same
    // pattern as Login.jsx).
    useEffect(() => {
        if (hasNostrExtension) return;
        const check = setInterval(() => {
            if (window.nostr) {
                setHasNostrExtension(true);
                clearInterval(check);
            }
        }, 100);
        const timeout = setTimeout(() => clearInterval(check), 3000);
        return () => {
            clearInterval(check);
            clearTimeout(timeout);
        };
    }, [hasNostrExtension]);

    // Fetch voucher info on mount
    useEffect(() => {
        let cancelled = false;
        setPhase('loading');
        voucherApi.info(code)
            .then((res) => {
                if (cancelled) return;
                if (res.type === 'ONBOARDING') {
                    navigate(`/join/${code}`, { replace: true });
                    return;
                }
                setInfo(res);
                if (!res.valid) {
                    setBlockReason(
                        ['revoked', 'expired', 'exhausted'].includes(res.reason)
                            ? res.reason
                            : 'invalid'
                    );
                    setPhase('blocked');
                } else {
                    setPhase('form');
                }
            })
            .catch(() => {
                if (!cancelled) setPhase('unknown');
            });
        return () => { cancelled = true; };
    }, [code, navigate]);

    // Poll payment status while an invoice is pending
    useEffect(() => {
        if (phase !== 'paying' || !payment?.redemptionId) return;
        const startedAt = Date.now();
        const interval = setInterval(async () => {
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                clearInterval(interval);
                setPhase('timeout');
                return;
            }
            try {
                const res = await voucherApi.redemptionStatus(payment.redemptionId);
                if (res.status === 'COMPLETED') {
                    clearInterval(interval);
                    setRelayUrl(res.relayUrl || '');
                    setPhase('success');
                } else if (res.status === 'EXPIRED') {
                    clearInterval(interval);
                    setPhase('timeout');
                } else if (res.status === 'REVOKED') {
                    clearInterval(interval);
                    setBlockReason('revoked');
                    setPhase('blocked');
                }
            } catch {
                // transient error — keep polling
            }
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [phase, payment]);

    const copyText = (text, which) => {
        navigator.clipboard.writeText(text);
        setCopied(which);
        setTimeout(() => setCopied(''), 2000);
    };

    const handleUseExtension = async () => {
        try {
            const pk = await window.nostr.getPublicKey();
            if (pk) {
                setPubkeyInput(pk);
                setInputError('');
            }
        } catch {
            // user rejected the extension prompt — nothing to do
        }
    };

    const handleRedeem = async (e) => {
        e.preventDefault();
        const pk = pubkeyInput.trim();
        if (!PUBKEY_REGEX.test(pk)) {
            setInputError(t('voucher.invalidPubkey'));
            return;
        }
        setInputError('');
        setError('');
        setRedeeming(true);
        try {
            const res = await voucherApi.redeem(code, pk);
            if (res.status === 'completed') {
                setRelayUrl(res.relayUrl || '');
                setPhase('success');
            } else if (res.status === 'pending_payment') {
                setPayment(res);
                setPhase('paying');
            } else {
                setError(t('voucher.invalid'));
            }
        } catch (err) {
            setError(err.message || t('voucher.invalid'));
        } finally {
            setRedeeming(false);
        }
    };

    const renderSuccess = () => (
        <div className="vr-panel">
            <CheckCircle size={40} className="vr-success-icon" />
            <h2 className="vr-heading">{t('voucher.success')}</h2>
            {relayUrl && (
                <div className="vr-relay-box">
                    <span className="vr-relay-label">{t('voucher.relayUrlLabel')}</span>
                    <div className="vr-relay-row">
                        <span className="vr-relay-url">{relayUrl}</span>
                        <button
                            type="button"
                            className="vr-copy-btn"
                            onClick={() => copyText(relayUrl, 'relay')}
                        >
                            {copied === 'relay'
                                ? <><CheckCircle size={14} /> {t('voucher.copied')}</>
                                : <><Copy size={14} /> {t('voucher.copy')}</>}
                        </button>
                    </div>
                </div>
            )}
            <p className="vr-instructions">{t('voucher.relayInstructions')}</p>
        </div>
    );

    const renderPaying = () => (
        <div className="vr-panel">
            <h2 className="vr-heading">
                <Zap size={20} className="vr-zap-icon" /> {t('voucher.payTitle')}
            </h2>
            {info?.label && <p className="vr-subtext">{info.label}</p>}
            <p className="vr-amount">
                {t('voucher.payAmount')}: <strong>{payment.amountSats?.toLocaleString()} sats</strong>
            </p>
            <div className="vr-qr-wrapper">
                <QRCodeSVG value={payment.bolt11.toUpperCase()} size={220} />
            </div>
            <div className="vr-pay-actions">
                <button
                    type="button"
                    className="vr-copy-btn"
                    onClick={() => copyText(payment.bolt11, 'invoice')}
                >
                    {copied === 'invoice'
                        ? <><CheckCircle size={14} /> {t('voucher.copied')}</>
                        : <><Copy size={14} /> {t('voucher.copyInvoice')}</>}
                </button>
                <a className="vr-wallet-link" href={`lightning:${payment.bolt11}`}>
                    <Zap size={14} /> {t('voucher.openWallet')}
                </a>
            </div>
            <p className="vr-waiting">
                <Loader2 size={14} className="vr-spin" /> {t('voucher.waitingPayment')}
            </p>
        </div>
    );

    const renderForm = () => (
        <form onSubmit={handleRedeem} className="vr-form">
            <h2 className="vr-heading">{t('voucher.title')}</h2>
            <p className="vr-subtext">{t('voucher.subtitle')}</p>
            {info?.label && <p className="vr-voucher-label">{info.label}</p>}
            {info?.priceSats > 0 && (
                <p className="vr-amount">
                    <Zap size={14} className="vr-zap-icon" />{' '}
                    {t('voucher.payAmount')}: <strong>{info.priceSats.toLocaleString()} sats</strong>
                </p>
            )}
            {isMember && <p className="vr-member-note">{t('voucher.alreadyMember')}</p>}

            {error && (
                <div className="vr-error-banner">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            <label className="vr-label" htmlFor="vr-pubkey">{t('voucher.enterPubkey')}</label>
            <input
                id="vr-pubkey"
                type="text"
                className="vr-input"
                placeholder={t('voucher.pubkeyPlaceholder')}
                value={pubkeyInput}
                onChange={(e) => { setPubkeyInput(e.target.value); setInputError(''); }}
                autoComplete="off"
                spellCheck="false"
            />
            {inputError && <p className="vr-input-error">{inputError}</p>}

            {hasNostrExtension && (
                <button
                    type="button"
                    className="vr-extension-btn"
                    onClick={handleUseExtension}
                    disabled={redeeming}
                >
                    <Globe size={16} /> {t('voucher.useExtension')}
                </button>
            )}

            <button
                type="submit"
                className="vr-redeem-btn"
                disabled={redeeming || !pubkeyInput.trim()}
            >
                {redeeming
                    ? <><Loader2 size={18} className="vr-spin" /> {t('voucher.redeeming')}</>
                    : t('voucher.redeem')}
            </button>
        </form>
    );

    return (
        <div className="vr-page">
            <div className="vr-card">
                <div className="vr-logo">
                    <img src={logoIcon} alt="BIES" style={{ height: '56px', width: 'auto' }} />
                </div>

                {phase === 'loading' && (
                    <div className="vr-loading">
                        <Loader2 size={28} className="vr-spin" />
                    </div>
                )}

                {phase === 'unknown' && (
                    <div className="vr-panel">
                        <AlertCircle size={36} className="vr-block-icon" />
                        <p className="vr-block-text">{t('voucher.invalid')}</p>
                    </div>
                )}

                {phase === 'blocked' && (
                    <div className="vr-panel">
                        <AlertCircle size={36} className="vr-block-icon" />
                        <p className="vr-block-text">{t(`voucher.${blockReason}`)}</p>
                    </div>
                )}

                {phase === 'timeout' && (
                    <div className="vr-panel">
                        <AlertCircle size={36} className="vr-block-icon" />
                        <p className="vr-block-text">{t('voucher.paymentTimeout')}</p>
                    </div>
                )}

                {phase === 'form' && renderForm()}
                {phase === 'paying' && renderPaying()}
                {phase === 'success' && renderSuccess()}
            </div>

            {/*
              Panels are produced by helper closures, which the styled-jsx
              babel plugin does not scope — so every descendant rule is
              written as `.vr-page :global(...)` (same pattern as
              Leaderboard.jsx). `.vr-page` itself sits directly in this
              component's JSX and gets the scope hash.
            */}
            <style jsx>{`
                .vr-page {
                    min-height: calc(100vh - 150px);
                    min-height: calc(100dvh - 150px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--color-gray-50);
                    padding: clamp(1rem, 3vh, 2rem) clamp(0.5rem, 2vh, 1rem);
                }

                .vr-page :global(.vr-card) {
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                    padding: clamp(1.25rem, 2.5vh, 2rem);
                    border-radius: 1.5rem;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
                    border: 1px solid var(--color-gray-200);
                    width: 100%;
                    max-width: 440px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .vr-page :global(.vr-logo) {
                    margin-bottom: 1.25rem;
                }

                .vr-page :global(.vr-loading) {
                    display: flex;
                    justify-content: center;
                    padding: 2.5rem 0;
                    color: var(--color-gray-500);
                }

                .vr-page :global(.vr-panel) {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.75rem;
                    text-align: center;
                }

                .vr-page :global(.vr-form) {
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .vr-page :global(.vr-heading) {
                    font-size: 1.35rem;
                    font-weight: 700;
                    margin: 0;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.4rem;
                    color: var(--color-text, inherit);
                }

                .vr-page :global(.vr-subtext) {
                    font-size: 0.875rem;
                    color: var(--color-gray-500);
                    text-align: center;
                    margin: 0;
                }

                .vr-page :global(.vr-voucher-label) {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-primary);
                    text-align: center;
                    margin: 0;
                }

                .vr-page :global(.vr-amount) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.3rem;
                    font-size: 0.9rem;
                    color: var(--color-gray-700);
                    margin: 0;
                }

                .vr-page :global(.vr-zap-icon) {
                    color: #f7931a;
                    flex-shrink: 0;
                }

                .vr-page :global(.vr-member-note) {
                    font-size: 0.75rem;
                    color: var(--color-gray-400);
                    text-align: center;
                    margin: 0;
                }

                .vr-page :global(.vr-label) {
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: var(--color-gray-700);
                    margin-top: 0.25rem;
                }

                .vr-page :global(.vr-input) {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 0.75rem 1rem;
                    border: 1px solid var(--color-gray-200);
                    border-radius: 9999px;
                    font-size: 0.875rem;
                    font-family: monospace;
                    background: var(--color-surface);
                    color: var(--color-text, inherit);
                    outline: none;
                    transition: border-color 0.2s;
                }
                .vr-page :global(.vr-input:focus) {
                    border-color: var(--color-primary);
                }

                .vr-page :global(.vr-input-error) {
                    font-size: 0.75rem;
                    color: var(--color-error);
                    margin: 0;
                }

                .vr-page :global(.vr-extension-btn) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.65rem 1.25rem;
                    background: transparent;
                    border: 1px solid var(--color-gray-300);
                    border-radius: 9999px;
                    color: var(--color-gray-600);
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .vr-page :global(.vr-extension-btn:hover) {
                    border-color: var(--color-primary);
                    color: var(--color-primary);
                }
                .vr-page :global(.vr-extension-btn:disabled) {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .vr-page :global(.vr-redeem-btn) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: clamp(0.75rem, 2vh, 1rem) 1.5rem;
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    border-radius: 9999px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .vr-page :global(.vr-redeem-btn:hover) { opacity: 0.9; }
                .vr-page :global(.vr-redeem-btn:disabled) {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .vr-page :global(.vr-error-banner) {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--color-red-tint);
                    color: var(--color-error);
                    padding: 0.75rem 1rem;
                    border-radius: 0.75rem;
                    font-size: 0.875rem;
                    width: 100%;
                    border: 1px solid var(--badge-error-bg);
                }

                .vr-page :global(.vr-block-icon) {
                    color: var(--color-error);
                }

                .vr-page :global(.vr-block-text) {
                    font-size: 0.95rem;
                    color: var(--color-gray-600);
                    margin: 0;
                    max-width: 320px;
                }

                .vr-page :global(.vr-success-icon) {
                    color: var(--color-success, #16a34a);
                }

                .vr-page :global(.vr-relay-box) {
                    width: 100%;
                    background: var(--color-gray-50);
                    border: 1px solid var(--color-gray-200);
                    border-radius: 1rem;
                    padding: 0.75rem 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    text-align: left;
                }

                .vr-page :global(.vr-relay-label) {
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    color: var(--color-gray-400);
                }

                .vr-page :global(.vr-relay-row) {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 0.5rem;
                    min-width: 0;
                }

                .vr-page :global(.vr-relay-url) {
                    font-family: monospace;
                    font-size: 0.85rem;
                    color: var(--color-text, inherit);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                    min-width: 0;
                }

                .vr-page :global(.vr-copy-btn) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: none;
                    border: 1px solid var(--color-gray-300);
                    border-radius: 9999px;
                    padding: 0.4rem 0.9rem;
                    font-size: 0.8rem;
                    color: var(--color-gray-600);
                    cursor: pointer;
                    flex-shrink: 0;
                    white-space: nowrap;
                }
                .vr-page :global(.vr-copy-btn:hover) {
                    border-color: var(--color-gray-400);
                }

                .vr-page :global(.vr-instructions) {
                    font-size: 0.85rem;
                    color: var(--color-gray-500);
                    line-height: 1.5;
                    background: var(--color-blue-tint);
                    border-radius: 0.75rem;
                    padding: 0.75rem 1rem;
                    margin: 0;
                    text-align: left;
                }

                .vr-page :global(.vr-qr-wrapper) {
                    background: #ffffff;
                    padding: 12px;
                    border-radius: 0.75rem;
                    border: 1px solid var(--color-gray-200);
                    line-height: 0;
                }

                .vr-page :global(.vr-pay-actions) {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .vr-page :global(.vr-wallet-link) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: #1e1b4b;
                    color: white;
                    border-radius: 9999px;
                    padding: 0.4rem 1rem;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-decoration: none;
                }
                .vr-page :global(.vr-wallet-link:hover) { opacity: 0.9; }

                .vr-page :global(.vr-waiting) {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.85rem;
                    color: var(--color-gray-500);
                    margin: 0;
                }

                .vr-page :global(.vr-spin) {
                    animation: vr-spin 1s linear infinite;
                }
                @keyframes vr-spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default VoucherRedeem;
